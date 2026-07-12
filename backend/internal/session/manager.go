package session

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"moodflix/internal/db"
	"moodflix/internal/models"
	"moodflix/internal/recommendation"
)

type Manager interface {
	StartSession(ctx context.Context, answersA map[string]string) (string, error)
	GetSession(ctx context.Context, id string) (*models.SessionResponse, error)
	CompleteSession(ctx context.Context, id string, answersB map[string]string) (*models.FriendRecommendResponse, error)
	RateSession(ctx context.Context, id string, rating int, notes string) error
}

type manager struct {
	engine recommendation.RecommendationEngine
	pool   *pgxpool.Pool
}

func NewManager(engine recommendation.RecommendationEngine, pool *pgxpool.Pool) Manager {
	return &manager{engine: engine, pool: pool}
}

func (m *manager) StartSession(ctx context.Context, answersA map[string]string) (string, error) {
	return db.CreateSession(ctx, m.pool, answersA)
}

func (m *manager) GetSession(ctx context.Context, id string) (*models.SessionResponse, error) {
	return db.GetSessionByID(ctx, m.pool, id)
}

func (m *manager) CompleteSession(ctx context.Context, id string, answersB map[string]string) (*models.FriendRecommendResponse, error) {
	sess, err := db.GetSessionByID(ctx, m.pool, id)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}
	if len(sess.AnswersA) == 0 {
		return nil, fmt.Errorf("session is invalid: answers_a is missing")
	}

	resp, err := m.engine.GetFriendRecommendations(ctx, sess.AnswersA, answersB)
	if err != nil {
		return nil, err
	}

	recommendationIDs := make([]int, len(resp.Recommendations))
	for i, movie := range resp.Recommendations {
		recommendationIDs[i] = movie.ID
	}

	err = db.UpdateSessionB(ctx, m.pool, id, answersB, resp.MergedMood, resp.MoodProfile, recommendationIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to save session results: %w", err)
	}

	resp.SessionID = id
	return resp, nil
}

func (m *manager) RateSession(ctx context.Context, id string, rating int, notes string) error {
	return db.UpdateSessionRating(ctx, m.pool, id, rating, notes)
}
