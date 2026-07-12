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

INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'ReRank',
  'User mood profile:\n%s\n\nI''ve found these candidate movies (sorted by vector similarity):\n%s\n\nRank the top 5 that best match the user''s mood. Avoid movies that conflict with dealbreakers.\nRespond ONLY with valid JSON (no markdown):\n{\n  "top_5": [\n    { "movie_id": 123, "title": "Movie Title", "score": 95 },\n    ...\n  ],\n  "reasoning": "Brief overall reasoning"\n}',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;

INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'Explain',
  'User answered:\n%s\n\nThis generated mood profile:\n%s\n\nMovie we''re explaining:\nTitle: %s\nPlot: %s\nGenres: %s\n\nWhy did we pick this? Respond in 1-2 sentences, casual and enthusiastic tone. No bullet points, just plain text.',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;

INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'MoodBreakdown',
  'Given this cinematic mood profile:\n%s\n\nScore 6-8 cinematic attributes as percentages (0-100) that describe this viewer''s taste.\nAlso assign a fun, evocative cinematic persona label (e.g. "The Brooding Auteur", "The Cozy Escapist", "The Adrenaline Junkie", "The Quiet Philosopher").\n\nChoose attributes relevant to the profile — examples: Thriller, Drama, Comedy, Action, Horror, Sci-Fi, Romance, Slow Burn, Fast Paced, Dark Tone, Light Tone, Thought-Provoking, Feel-Good, Edge-of-Seat, Emotional Depth, Visually Stunning.\n\nRespond ONLY with valid JSON (no markdown):\n{\n  "attributes": [\n    { "label": "Thriller", "score": 85 },\n    { "label": "Dark Tone", "score": 75 },\n    ...\n  ],\n  "persona": "The Brooding Auteur"\n}',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;

INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'MergeMoodProfiles',
  'Two friends want to watch a movie together. Here are their individual mood profiles:\n\nPerson A: %s\n\nPerson B: %s\n\nCreate a single MERGED mood profile that would satisfy BOTH people. Prioritize overlap. If they conflict, find a middle ground. Respect dealbreakers from BOTH — union of dealbreakers. Also write a short "merged_mood" string (e.g. "A tense thriller you can both get lost in") that captures the shared vibe.\n\nRespond ONLY with valid JSON (no markdown):\n{\n  "merged_mood": "A tense thriller you can both get lost in",\n  "profile": {\n    "mood": "...",\n    "pace": "fast|slow|any",\n    "tone": "...",\n    "ending": "happy|sad|dark|any",\n    "violence": "low|medium|high|none",\n    "focus_required": "full|background",\n    "genres": ["genre1", "genre2"],\n    "dealbreakers": [],\n    "keywords_to_boost": [],\n    "keywords_to_avoid": []\n  }\n}',
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
