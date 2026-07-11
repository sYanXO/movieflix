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

-- IVFFlat index for approximate nearest-neighbour search (cosine distance)
-- lists = 100 is a good default for ~5k movies
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
