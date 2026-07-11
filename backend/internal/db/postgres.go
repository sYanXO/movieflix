package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

const initSQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS movies (
  id          SERIAL PRIMARY KEY,
  tmdb_id     INT UNIQUE,
  title       VARCHAR(255) NOT NULL,
  year        INT,
  overview    TEXT,
  genres      TEXT[],
  keywords    TEXT[],
  runtime     INT,
  director    VARCHAR(255),
  "cast"      TEXT[],
  language    VARCHAR(10),
  rating      FLOAT,
  popularity  FLOAT,
  poster_url  TEXT,
  embedding   vector(768)
);

CREATE INDEX IF NOT EXISTS movies_embedding_idx
  ON movies USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE IF NOT EXISTS sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMP DEFAULT NOW(),
  answers         JSONB,
  mood_profile    JSONB,
  recommendations INT[],
  user_notes      TEXT
);
`

// NewPool creates a pgxpool connection pool from a DSN string.
func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("creating pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("pinging db: %w", err)
	}
	return pool, nil
}

// RunMigrations executes the embedded 001_init.sql on the database pool.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, initSQL)
	if err != nil {
		return fmt.Errorf("executing migration sql: %w", err)
	}
	return nil
}
