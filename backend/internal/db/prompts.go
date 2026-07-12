package db

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PromptManager handles fetching and caching LLM prompts from the database.
type PromptManager struct {
	pool       *pgxpool.Pool
	cache      map[string]cachedPrompt
	mu         sync.RWMutex
	ttl        time.Duration
}

type cachedPrompt struct {
	content   string
	fetchedAt time.Time
}

// NewPromptManager creates a new PromptManager with a specified TTL.
func NewPromptManager(pool *pgxpool.Pool, ttl time.Duration) *PromptManager {
	return &PromptManager{
		pool:  pool,
		cache: make(map[string]cachedPrompt),
		ttl:   ttl,
	}
}

// GetActivePrompt returns the active prompt content for the given name.
// It uses an in-memory cache to avoid querying the DB on every request.
func (m *PromptManager) GetActivePrompt(ctx context.Context, name string, fallback string) (string, error) {
	m.mu.RLock()
	cached, ok := m.cache[name]
	m.mu.RUnlock()

	// Return cached if still valid
	if ok && time.Since(cached.fetchedAt) < m.ttl {
		return cached.content, nil
	}

	// Otherwise fetch from DB
	var content string
	err := m.pool.QueryRow(ctx, `
		SELECT content FROM prompts 
		WHERE name = $1 AND status = 'active'
	`, name).Scan(&content)

	if err != nil {
		// Log error, and return fallback string instead of failing the whole request
		fmt.Printf("Warning: failed to fetch prompt '%s' from DB, using fallback. Error: %v\n", name, err)
		return fallback, nil
	}

	// Update cache
	m.mu.Lock()
	m.cache[name] = cachedPrompt{
		content:   content,
		fetchedAt: time.Now(),
	}
	m.mu.Unlock()

	return content, nil
}
