package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/pgvector/pgvector-go"
	"moodflix/internal/db"
	"moodflix/internal/llm"
)

const (
	progressFile = "ingest_progress.json"
	rateLimit    = 650 * time.Millisecond // Stay under Gemini Free Tier's 100 RPM (Requests Per Minute)
)

type Progress struct {
	ProcessedIDs map[string]bool `json:"processed_ids"`
}

type RawMovie struct {
	TmdbID    int
	Title     string
	Overview  string
	Genres    []string
	Year      int
	Runtime   int
	Language  string
	Rating    float64
	Popularity float64
	PosterURL string
}

func main() {
	_ = godotenv.Load()

	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey == "" {
		log.Fatal("GEMINI_API_KEY required")
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://moodflix:moodflix@localhost:5433/moodflix"
	}

	// Find data file
	_, filename, _, _ := runtime.Caller(0)
	scriptDir := filepath.Dir(filename)
	csvPath := filepath.Join(scriptDir, "../../data/movies_metadata.csv")
	if len(os.Args) > 1 {
		csvPath = os.Args[1]
	}

	ctx := context.Background()

	// Init LLM client
	llmClient, err := llm.NewClient(geminiKey)
	if err != nil {
		log.Fatalf("LLM client: %v", err)
	}

	// Init DB
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("DB pool: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("DB ping: %v", err)
	}
	log.Println("✅ Connected to DB")

	if err := db.RunMigrations(ctx, pool); err != nil {
		log.Fatalf("Running migrations: %v", err)
	}
	log.Println("✅ Database migrated successfully")

	// Load progress
	progress := loadProgress()
	log.Printf("📁 Resuming from %d already-processed movies", len(progress.ProcessedIDs))

	// Open CSV
	f, err := os.Open(csvPath)
	if err != nil {
		log.Fatalf("opening CSV (%s): %v\nPlace movies_metadata.csv at backend/data/movies_metadata.csv", csvPath, err)
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1 // variable fields

	// Read header
	header, err := reader.Read()
	if err != nil {
		log.Fatalf("reading header: %v", err)
	}
	colIdx := make(map[string]int)
	for i, h := range header {
		colIdx[h] = i
	}

	// Required columns check
	for _, col := range []string{"id", "title", "overview", "genres", "release_date"} {
		if _, ok := colIdx[col]; !ok {
			log.Fatalf("missing required column: %s", col)
		}
	}

	// Load ALL valid rows into memory so we can sort by popularity before ingesting.
	// This ensures that even a partial run gives a rich spread of popular movies
	// across all eras instead of only the oldest films (lowest TMDB IDs).
	log.Println("📖 Loading CSV into memory for sorting...")
	var allMovies []RawMovie
	skippedLoad := 0
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Printf("⚠️  CSV read error (skipping row): %v", err)
			continue
		}
		movie, ok := parseRecord(record, colIdx)
		if !ok {
			skippedLoad++
			continue
		}
		allMovies = append(allMovies, movie)
	}

	// Sort by popularity descending — most popular (and typically well-known across all eras) first
	sort.Slice(allMovies, func(i, j int) bool {
		return allMovies[i].Popularity > allMovies[j].Popularity
	})
	log.Printf("📊 Loaded %d valid movies, sorted by popularity. Starting embed+insert...", len(allMovies))

	processed := 0
	skipped := skippedLoad
	errCount := 0
	ticker := time.NewTicker(rateLimit)
	defer ticker.Stop()

	log.Println("🎬 Starting ingestion...")

	for i := 0; i < len(allMovies); i++ {
		movie := allMovies[i]
		idStr := strconv.Itoa(movie.TmdbID)
		if progress.ProcessedIDs[idStr] {
			continue
		}

		// Build embedding text
		embText := buildEmbedText(movie)

		// Rate limit
		<-ticker.C

		// Embed
		embedding, err := llmClient.EmbedText(ctx, embText)
		if err != nil {
			errStr := strings.ToLower(err.Error())
			if strings.Contains(errStr, "429") || strings.Contains(errStr, "quota") || strings.Contains(errStr, "limit") || strings.Contains(errStr, "exhausted") {
				log.Printf("⚠️ Rate limit hit for %q. Waiting 25 seconds before retrying...", movie.Title)
				time.Sleep(25 * time.Second)
				i-- // Decrement index to retry this movie on the next iteration
				continue
			}

			log.Printf("⚠️  Embed error for %q: %v", movie.Title, err)
			errCount++
			if errCount > 10 {
				log.Fatal("Too many embedding errors — check API key and quota")
			}
			continue
		}

		// Insert into DB
		vec := pgvector.NewVector(embedding)
		_, err = pool.Exec(ctx, `
			INSERT INTO movies (tmdb_id, title, year, overview, genres, runtime, language, rating, popularity, poster_url, embedding)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (tmdb_id) DO UPDATE SET
				embedding = EXCLUDED.embedding,
				overview = EXCLUDED.overview
		`,
			movie.TmdbID, movie.Title, movie.Year, movie.Overview,
			movie.Genres, movie.Runtime, movie.Language,
			movie.Rating, movie.Popularity, movie.PosterURL, vec,
		)
		if err != nil {
			log.Printf("⚠️  DB insert error for %q: %v", movie.Title, err)
			continue
		}

		progress.ProcessedIDs[idStr] = true
		processed++

		if processed%50 == 0 {
			saveProgress(progress)
			log.Printf("✅ %d movies embedded and saved (skipped: %d)", processed, skipped)
		}
	}

	saveProgress(progress)
	log.Printf("\n🎉 Done! Total processed: %d | Skipped: %d | Errors: %d", processed, skipped, errCount)
}

func parseRecord(record []string, colIdx map[string]int) (RawMovie, bool) {
	get := func(col string) string {
		idx, ok := colIdx[col]
		if !ok || idx >= len(record) {
			return ""
		}
		return strings.TrimSpace(record[idx])
	}

	title := get("title")
	overview := get("overview")
	if title == "" || len(overview) < 50 {
		return RawMovie{}, false
	}

	// Filter: English only
	lang := get("original_language")
	if lang != "en" {
		return RawMovie{}, false
	}

	// TMDB ID
	idStr := get("id")
	tmdbID, err := strconv.Atoi(idStr)
	if err != nil || tmdbID == 0 {
		return RawMovie{}, false
	}

	// Rating
	ratingStr := get("vote_average")
	rating, _ := strconv.ParseFloat(ratingStr, 64)
	if rating < 5.0 {
		return RawMovie{}, false // skip low-quality films
	}

	// Year
	releaseDate := get("release_date")
	year := 0
	if len(releaseDate) >= 4 {
		year, _ = strconv.Atoi(releaseDate[:4])
	}

	// Runtime
	runtime, _ := strconv.Atoi(get("runtime"))

	// Popularity
	pop, _ := strconv.ParseFloat(get("popularity"), 64)

	// Genres — stored as JSON array of objects: [{"id":28,"name":"Action"},...]
	genres := parseGenres(get("genres"))

	// Poster URL
	posterPath := get("poster_path")
	posterURL := ""
	if posterPath != "" && posterPath != "None" {
		posterURL = "https://image.tmdb.org/t/p/w500" + posterPath
	}

	return RawMovie{
		TmdbID:     tmdbID,
		Title:      title,
		Overview:   overview,
		Genres:     genres,
		Year:       year,
		Runtime:    runtime,
		Language:   lang,
		Rating:     rating,
		Popularity: pop,
		PosterURL:  posterURL,
	}, true
}

func parseGenres(raw string) []string {
	// Try JSON array of objects format first
	var genreObjs []struct {
		Name string `json:"name"`
	}
	// Replace single quotes with double quotes (Python dict format)
	clean := strings.ReplaceAll(raw, "'", "\"")
	if err := json.Unmarshal([]byte(clean), &genreObjs); err == nil {
		var names []string
		for _, g := range genreObjs {
			if g.Name != "" {
				names = append(names, g.Name)
			}
		}
		return names
	}
	return nil
}

func buildEmbedText(m RawMovie) string {
	genres := strings.Join(m.Genres, ", ")
	return fmt.Sprintf("%s. %s. Genres: %s.", m.Title, m.Overview, genres)
}

func loadProgress() Progress {
	p := Progress{ProcessedIDs: make(map[string]bool)}
	data, err := os.ReadFile(progressFile)
	if err != nil {
		return p
	}
	_ = json.Unmarshal(data, &p)
	return p
}

func saveProgress(p Progress) {
	data, _ := json.Marshal(p)
	_ = os.WriteFile(progressFile, data, 0644)
}
