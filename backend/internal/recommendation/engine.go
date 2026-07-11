package recommendation

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"sort"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
	"moodflix/internal/db"
	"moodflix/internal/llm"
	"moodflix/internal/models"
)

// RecommendationEngine defines the seam for requesting recommendations.
type RecommendationEngine interface {
	GetRecommendations(ctx context.Context, answers map[string]string) (*models.RecommendResponse, error)
}

// DefaultRecommendationEngine implements the recommendations pipeline.
type DefaultRecommendationEngine struct {
	llmClient *llm.Client
	dbPool    *pgxpool.Pool
}

// NewEngine creates a new DefaultRecommendationEngine.
func NewEngine(llmClient *llm.Client, dbPool *pgxpool.Pool) *DefaultRecommendationEngine {
	return &DefaultRecommendationEngine{
		llmClient: llmClient,
		dbPool:    dbPool,
	}
}

// GetRecommendations executes parallel LLM calls, DB vector search, and reranking.
func (e *DefaultRecommendationEngine) GetRecommendations(ctx context.Context, answers map[string]string) (*models.RecommendResponse, error) {
	if len(answers) == 0 {
		return nil, fmt.Errorf("answers cannot be empty")
	}

	var (
		profile       *models.MoodProfile
		embedding     []float32
		parseErr      error
		embedErr      error
		isRateLimited = false
		wg            sync.WaitGroup
	)

	wg.Add(2)

	// Goroutine A: Parse answers into structured MoodProfile
	go func() {
		defer wg.Done()
		profile, parseErr = e.llmClient.ParseMoodProfile(ctx, answers)
	}()

	// Goroutine B: Embed raw answers text in parallel
	go func() {
		defer wg.Done()
		rawText := buildRawAnswersText(answers)
		embedding, embedErr = e.llmClient.EmbedText(ctx, rawText)
	}()

	wg.Wait()

	// Handle Parse Mood Profile rate limits/errors
	if parseErr != nil {
		parseErrStr := strings.ToLower(parseErr.Error())
		if strings.Contains(parseErrStr, "429") || strings.Contains(parseErrStr, "quota") || strings.Contains(parseErrStr, "limit") {
			log.Println("⚠️ Gemini ParseMoodProfile rate-limited (429). Falling back to local heuristic parser...")
			profile = parseMoodProfileHeuristic(answers)
			isRateLimited = true
		} else {
			return nil, fmt.Errorf("mood parsing failed: %w", parseErr)
		}
	}

	var candidates []models.Movie
	var err error

	if isRateLimited {
		// Run DB genre fallback directly
		candidates, err = db.GenreAndRatingSearch(ctx, e.dbPool, profile.Genres, 50)
		if err != nil {
			return nil, fmt.Errorf("database fallback query failed: %w", err)
		}
	} else {
		// Handle Embed Text rate limits/errors
		if embedErr != nil {
			embedErrStr := strings.ToLower(embedErr.Error())
			if strings.Contains(embedErrStr, "429") || strings.Contains(embedErrStr, "quota") || strings.Contains(embedErrStr, "limit") {
				log.Println("⚠️ Gemini EmbedText rate-limited (429). Falling back to database SQL search...")
				candidates, err = db.GenreAndRatingSearch(ctx, e.dbPool, profile.Genres, 50)
				if err != nil {
					return nil, fmt.Errorf("database fallback query failed: %w", err)
				}
				isRateLimited = true
			} else {
				return nil, fmt.Errorf("embedding failed: %w", embedErr)
			}
		} else {
			// Vector Search
			candidates, err = db.VectorSearch(ctx, e.dbPool, embedding, 50)
			if err != nil {
				return nil, fmt.Errorf("vector search failed: %w", err)
			}
		}
	}

	if len(candidates) == 0 {
		return &models.RecommendResponse{
			Recommendations: []models.Movie{},
			MoodProfile:     profile,
		}, nil
	}

	// Filter dealbreakers
	filtered := db.FilterDealbreakers(candidates, profile.Dealbreakers)
	if len(filtered) == 0 {
		filtered = candidates
	}

	// ReRank candidates using LLM (if not rate limited)
	var top5 []models.Movie
	if !isRateLimited {
		top5, err = e.llmClient.ReRank(ctx, profile, filtered)
		if err != nil {
			// Fallback: return first 5 from vector search
			top5 = filtered
			if len(top5) > 5 {
				top5 = top5[:5]
			}
		}
	} else {
		// Fallback: shuffle candidates and return top 5
		candidatesToShuffle := filtered
		if len(candidatesToShuffle) > 50 {
			candidatesToShuffle = filtered[:50]
		}
		rand.Shuffle(len(candidatesToShuffle), func(i, j int) {
			candidatesToShuffle[i], candidatesToShuffle[j] = candidatesToShuffle[j], candidatesToShuffle[i]
		})
		top5 = candidatesToShuffle
		if len(top5) > 5 {
			top5 = top5[:5]
		}
	}

	return &models.RecommendResponse{
		Recommendations: top5,
		MoodProfile:     profile,
	}, nil
}

// CachedRecommendationEngine wraps an engine with in-memory caching.
type CachedRecommendationEngine struct {
	inner RecommendationEngine
	cache map[string]*models.RecommendResponse
	mu    sync.RWMutex
}

// NewCachedEngine creates a new CachedRecommendationEngine.
func NewCachedEngine(inner RecommendationEngine) *CachedRecommendationEngine {
	return &CachedRecommendationEngine{
		inner: inner,
		cache: make(map[string]*models.RecommendResponse),
	}
}

// GetRecommendations returns cached recommendations or delegates to inner engine on cache miss.
func (c *CachedRecommendationEngine) GetRecommendations(ctx context.Context, answers map[string]string) (*models.RecommendResponse, error) {
	key := getCacheKey(answers)

	c.mu.RLock()
	cached, hit := c.cache[key]
	c.mu.RUnlock()

	if hit {
		log.Println("⚡ Recommendation cache hit! Returning cached recommendations.")
		return cached, nil
	}

	log.Println("🐢 Recommendation cache miss. Fetching fresh recommendations...")
	response, err := c.inner.GetRecommendations(ctx, answers)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache[key] = response
	c.mu.Unlock()

	return response, nil
}

// buildRawAnswersText concatenates answers into a descriptive string.
func buildRawAnswersText(answers map[string]string) string {
	var sb strings.Builder
	keys := []string{"q1", "q2", "q3", "q4", "q5"}
	for _, k := range keys {
		if v, ok := answers[k]; ok && v != "" {
			sb.WriteString(v)
			sb.WriteString(". ")
		}
	}
	return strings.TrimSpace(sb.String())
}

// getCacheKey builds a unique key representing the quiz answers.
func getCacheKey(answers map[string]string) string {
	var keys []string
	for k := range answers {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var sb strings.Builder
	for _, k := range keys {
		sb.WriteString(fmt.Sprintf("%s:%s|", k, answers[k]))
	}
	return sb.String()
}

// parseMoodProfileHeuristic maps user answers to a MoodProfile without an LLM.
func parseMoodProfileHeuristic(answers map[string]string) *models.MoodProfile {
	profile := &models.MoodProfile{
		Pace:          "any",
		Tone:          "any",
		Ending:        "any",
		FocusRequired: "any",
		Genres:        []string{},
		Dealbreakers:  []string{},
	}

	getAns := func(shortKey, longKey string) string {
		for k, v := range answers {
			if strings.EqualFold(k, shortKey) || strings.EqualFold(k, longKey) {
				return v
			}
		}
		return ""
	}

	q1 := strings.ToLower(getAns("q1", "What are you in the mood for?"))
	if strings.Contains(q1, "brain") {
		profile.Mood = "Lighthearted entertainment"
		profile.Tone = "light, funny"
		profile.Genres = []string{"Comedy", "Adventure", "Family"}
	} else if strings.Contains(q1, "intense") {
		profile.Mood = "Tense thriller"
		profile.Tone = "intense, thrilling"
		profile.Genres = []string{"Action", "Thriller", "Crime"}
	} else if strings.Contains(q1, "think") {
		profile.Mood = "Thought-provoking drama"
		profile.Tone = "deep, intellectual"
		profile.Genres = []string{"Drama", "Mystery", "Science Fiction"}
	} else if strings.Contains(q1, "scare") {
		profile.Mood = "Spooky horror"
		profile.Tone = "scary, suspenseful"
		profile.Genres = []string{"Horror", "Thriller"}
	} else {
		profile.Mood = "General entertainment"
		profile.Tone = "entertaining"
		profile.Genres = []string{"Drama", "Comedy", "Action"}
	}

	q2 := strings.ToLower(getAns("q2", "Pace preference?"))
	if strings.Contains(q2, "fast") {
		profile.Pace = "fast"
	} else if strings.Contains(q2, "slow") {
		profile.Pace = "slow"
	}

	q3 := strings.ToLower(getAns("q3", "How much attention can you give?"))
	if strings.Contains(q3, "full") {
		profile.FocusRequired = "full"
	} else if strings.Contains(q3, "half") || strings.Contains(q3, "phone") {
		profile.FocusRequired = "background"
	}

	q4 := strings.ToLower(getAns("q4", "Ending vibes?"))
	if strings.Contains(q4, "happy") {
		profile.Ending = "happy"
	} else if strings.Contains(q4, "sad") || strings.Contains(q4, "dark") {
		profile.Ending = "sad"
	}

	q5 := strings.ToLower(getAns("q5", "Any dealbreakers?"))
	if strings.Contains(q5, "gore") {
		profile.Dealbreakers = append(profile.Dealbreakers, "gore")
	}
	if strings.Contains(q5, "romance") {
		profile.Dealbreakers = append(profile.Dealbreakers, "romance")
	}
	if strings.Contains(q5, "subtitles") {
		profile.Dealbreakers = append(profile.Dealbreakers, "subtitles")
	}

	return profile
}
