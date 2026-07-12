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

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS answers_a JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS answers_b JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS merged_mood TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS rating INT;

CREATE TABLE IF NOT EXISTS prompts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  version INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_prompt ON prompts (name) WHERE status = 'active';

INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'GenerateAdaptiveQuiz',
  'The user was asked: "How would you describe your week so far?"\nThey answered: "%s"\n\nGenerate exactly 3 highly creative, personalized, multi-choice questions to narrow down what movie they should watch. \nEach question should have 3-4 options. \n\nRespond ONLY with valid JSON (no markdown):\n[\n  {\n    "question": "exact question text",\n    "options": ["option1", "option2", ...],\n    "is_final": false\n  },\n  ...\n]',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;

INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'ParseMoodProfile',
  'The user answered these questions about their movie mood:\n%s\n\nRespond ONLY with JSON (no markdown):\n{\n  "mood": "short description of overall vibe",\n  "pace": "fast|slow|any",\n  "tone": "light|dark|gritty|uplifting|tense|scary|etc",\n  "ending": "happy|sad|dark|any",\n  "violence": "low|medium|high|none",\n  "focus_required": "full|background",\n  "genres": ["genre1", "genre2"],\n  "dealbreakers": ["gore", "romance"] or [],\n  "keywords_to_boost": ["heist", "psychological"],\n  "keywords_to_avoid": []\n}',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;
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
