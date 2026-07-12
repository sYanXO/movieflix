package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"
	"moodflix/internal/models"
)

// HybridSearch returns the top `limit` movies by cosine similarity, strictly filtered by genres if provided.
func HybridSearch(ctx context.Context, pool *pgxpool.Pool, embedding []float32, genres []string, limit int) ([]models.Movie, error) {
	vec := pgvector.NewVector(embedding)

	var query string
	var args []interface{}

	if len(genres) > 0 {
		query = `
			SELECT
				id, COALESCE(tmdb_id, 0), title, COALESCE(year, 0),
				COALESCE(overview, ''), COALESCE(genres, '{}'),
				COALESCE(keywords, '{}'), COALESCE(runtime, 0),
				COALESCE(language, ''), COALESCE(rating, 0.0),
				COALESCE(poster_url, '')
			FROM movies
			WHERE embedding IS NOT NULL AND genres && $2
			ORDER BY embedding <=> $1
			LIMIT $3
		`
		args = []interface{}{vec, genres, limit}
	} else {
		query = `
			SELECT
				id, COALESCE(tmdb_id, 0), title, COALESCE(year, 0),
				COALESCE(overview, ''), COALESCE(genres, '{}'),
				COALESCE(keywords, '{}'), COALESCE(runtime, 0),
				COALESCE(language, ''), COALESCE(rating, 0.0),
				COALESCE(poster_url, '')
			FROM movies
			WHERE embedding IS NOT NULL
			ORDER BY embedding <=> $1
			LIMIT $2
		`
		args = []interface{}{vec, limit}
	}

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("hybrid search query: %w", err)
	}
	defer rows.Close()

	var movies []models.Movie
	for rows.Next() {
		var m models.Movie
		if err := rows.Scan(
			&m.ID, &m.TmdbID, &m.Title, &m.Year,
			&m.Overview, &m.Genres, &m.Keywords,
			&m.Runtime, &m.Language, &m.Rating, &m.PosterURL,
		); err != nil {
			return nil, fmt.Errorf("scanning movie row: %w", err)
		}
		movies = append(movies, m)
	}
	
	// Fallback to pure vector search if genre filtering is too strict and returns nothing
	if len(movies) == 0 && len(genres) > 0 {
		return HybridSearch(ctx, pool, embedding, nil, limit)
	}

	return movies, rows.Err()
}

// GetMovieByID fetches a single movie by its internal ID.
func GetMovieByID(ctx context.Context, pool *pgxpool.Pool, id int) (*models.Movie, error) {
	var m models.Movie
	err := pool.QueryRow(ctx, `
		SELECT
			id, COALESCE(tmdb_id, 0), title, COALESCE(year, 0),
			COALESCE(overview, ''), COALESCE(genres, '{}'),
			COALESCE(keywords, '{}'), COALESCE(runtime, 0),
			COALESCE(language, ''), COALESCE(rating, 0.0),
			COALESCE(poster_url, '')
		FROM movies WHERE id = $1
	`, id).Scan(
		&m.ID, &m.TmdbID, &m.Title, &m.Year,
		&m.Overview, &m.Genres, &m.Keywords,
		&m.Runtime, &m.Language, &m.Rating, &m.PosterURL,
	)
	if err != nil {
		return nil, fmt.Errorf("get movie by id: %w", err)
	}
	return &m, nil
}

// FilterDealbreakers removes movies that conflict with the user's dealbreaker list.
func FilterDealbreakers(movies []models.Movie, dealbreakers []string) []models.Movie {
	if len(dealbreakers) == 0 {
		return movies
	}

	// Map dealbreaker labels to genre/keyword patterns to exclude
	excludeMap := map[string][]string{
		"gore":      {"horror", "gore", "slasher"},
		"romance":   {"romance", "romantic"},
		"subtitles": {}, // handled by language field separately
	}

	var filtered []models.Movie
	for _, m := range movies {
		exclude := false
		for _, db := range dealbreakers {
			lower := strings.ToLower(db)
			if patterns, ok := excludeMap[lower]; ok {
				for _, pattern := range patterns {
					for _, g := range m.Genres {
						if strings.Contains(strings.ToLower(g), pattern) {
							exclude = true
							break
						}
					}
					if exclude {
						break
					}
					for _, k := range m.Keywords {
						if strings.Contains(strings.ToLower(k), pattern) {
							exclude = true
							break
						}
					}
				}
			}
			// Subtitles: exclude non-English
			if lower == "subtitles" && m.Language != "en" && m.Language != "" {
				exclude = true
			}
			if exclude {
				break
			}
		}
		if !exclude {
			filtered = append(filtered, m)
		}
	}
	return filtered
}

// GenreAndRatingSearch returns top `limit` movies filtered by genres, ordered by popularity/rating.
// Used as a fallback when the vector embedding API is rate limited.
func GenreAndRatingSearch(ctx context.Context, pool *pgxpool.Pool, genres []string, limit int) ([]models.Movie, error) {
	var query string
	var args []interface{}

	if len(genres) > 0 {
		query = `
			SELECT
				id, COALESCE(tmdb_id, 0), title, COALESCE(year, 0),
				COALESCE(overview, ''), COALESCE(genres, '{}'),
				COALESCE(keywords, '{}'), COALESCE(runtime, 0),
				COALESCE(language, ''), COALESCE(rating, 0.0),
				COALESCE(poster_url, '')
			FROM movies
			WHERE genres && $1
			ORDER BY popularity DESC, rating DESC
			LIMIT $2
		`
		args = []interface{}{genres, limit}
	} else {
		query = `
			SELECT
				id, COALESCE(tmdb_id, 0), title, COALESCE(year, 0),
				COALESCE(overview, ''), COALESCE(genres, '{}'),
				COALESCE(keywords, '{}'), COALESCE(runtime, 0),
				COALESCE(language, ''), COALESCE(rating, 0.0),
				COALESCE(poster_url, '')
			FROM movies
			ORDER BY popularity DESC, rating DESC
			LIMIT $1
		`
		args = []interface{}{limit}
	}

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("fallback search query: %w", err)
	}
	defer rows.Close()

	var movies []models.Movie
	for rows.Next() {
		var m models.Movie
		if err := rows.Scan(
			&m.ID, &m.TmdbID, &m.Title, &m.Year,
			&m.Overview, &m.Genres, &m.Keywords,
			&m.Runtime, &m.Language, &m.Rating, &m.PosterURL,
		); err != nil {
			return nil, fmt.Errorf("scanning movie row: %w", err)
		}
		movies = append(movies, m)
	}

	// Fallback to anything if genre filtering returned nothing
	if len(movies) == 0 && len(genres) > 0 {
		return GenreAndRatingSearch(ctx, pool, nil, limit)
	}

	return movies, rows.Err()
}

