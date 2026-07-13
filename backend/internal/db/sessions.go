package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"moodflix/internal/models"
)

// CreateSession creates a new session in the database with answers_a and returns the generated session ID.
func CreateSession(ctx context.Context, pool *pgxpool.Pool, answersA map[string]string) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO sessions (answers_a)
		VALUES ($1)
		RETURNING id::text
	`, answersA).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create session: %w", err)
	}
	return id, nil
}

// GetSessionByID fetches a session by its UUID and returns the session state along with populated recommendation movies if they exist.
func GetSessionByID(ctx context.Context, pool *pgxpool.Pool, id string) (*models.SessionResponse, error) {
	var session models.SessionResponse
	var recIDs []int
	var answersA, answersB map[string]string
	var mergedMood *string
	var moodProfile *models.MoodProfile

	err := pool.QueryRow(ctx, `
		SELECT id::text, answers_a, answers_b, merged_mood, mood_profile, recommendations
		FROM sessions
		WHERE id = $1
	`, id).Scan(&session.ID, &answersA, &answersB, &mergedMood, &moodProfile, &recIDs)
	if err != nil {
		return nil, fmt.Errorf("get session by id: %w", err)
	}

	session.AnswersA = answersA
	session.AnswersB = answersB
	if mergedMood != nil {
		session.MergedMood = *mergedMood
	}
	session.MoodProfile = moodProfile

	if len(recIDs) > 0 {
		// Fetch recommendations preserving the order of recIDs
		movieMap := make(map[int]models.Movie)
		for _, mID := range recIDs {
			m, err := GetMovieByID(ctx, pool, mID)
			if err == nil {
				movieMap[mID] = *m
			}
		}
		
		movies := make([]models.Movie, 0, len(recIDs))
		for _, mID := range recIDs {
			if m, ok := movieMap[mID]; ok {
				movies = append(movies, m)
			}
		}
		session.Recommendations = movies
		session.IsComplete = true
	} else {
		session.IsComplete = false
	}

	return &session, nil
}

// UpdateSessionB updates the session with answers_b, merged_mood, mood_profile, and recommendations.
func UpdateSessionB(ctx context.Context, pool *pgxpool.Pool, id string, answersB map[string]string, mergedMood string, moodProfile *models.MoodProfile, recommendations []int) error {
	_, err := pool.Exec(ctx, `
		UPDATE sessions
		SET answers_b = $1, merged_mood = $2, mood_profile = $3, recommendations = $4
		WHERE id = $5
	`, answersB, mergedMood, moodProfile, recommendations, id)
	if err != nil {
		return fmt.Errorf("update session: %w", err)
	}
	return nil
}

// CreateRecommendationSession creates a new session in the database with answers, mood_profile, and recommendations and returns the generated session ID.
func CreateRecommendationSession(ctx context.Context, pool *pgxpool.Pool, answers map[string]string, moodProfile *models.MoodProfile, recommendations []int) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO sessions (answers, mood_profile, recommendations)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, answers, moodProfile, recommendations).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create recommendation session: %w", err)
	}
	return id, nil
}

// UpdateSessionRating updates the session with a user rating and notes.
func UpdateSessionRating(ctx context.Context, pool *pgxpool.Pool, id string, rating int, userNotes string) error {
	tag, err := pool.Exec(ctx, `
		UPDATE sessions
		SET rating = $1, user_notes = $2
		WHERE id = $3
	`, rating, userNotes, id)
	if err != nil {
		return fmt.Errorf("update session rating: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("session not found")
	}
	return nil
}
