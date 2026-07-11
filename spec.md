# MoodFlix Spec

**One-liner:** Ask what mood you're in (max 5 questions), LLM figures out what movie you actually want.

---

## User Flow

```
Landing → Click "Find me a movie"
        → Questions (adaptive, stops when confident)
        → LLM generates mood profile
        → Search + rank movies
        → Show 5 recommendations
        → (Optional) Click "Why this?" for explanation
```

---

## Questions (Adaptive)

Don't ask all 5 upfront. LLM decides the next question based on prior answers.

**Q1 (Always)**
"What are you in the mood for?"
- Turn my brain off
- Something intense
- Make me think
- Scare me
- Surprise me

**Q2 (If needed)**
"Pace preference?"
- Fast paced
- Slow burn

**Q3 (If needed)**
"How much attention?"
- Full focus
- Half-watching on my phone

**Q4 (If needed)**
"Ending vibes?"
- Happy
- Sad/dark
- Doesn't matter

**Q5 (Last resort)**
"Any dealbreakers?"
- Gore
- Romance
- Subtitles
- Nope

Stop asking once LLM has enough confidence to make good picks.

---

## Backend Flow

### Parse Answers
User's answers → LLM prompt → JSON mood profile

```json
{
  "mood": "intense dark thriller",
  "pace": "fast",
  "tone": "gritty",
  "ending": "dark",
  "violence": "high",
  "focus_required": "full",
  "dealbreakers": ["gore"],
  "genres": ["crime", "thriller"]
}
```

### Find Movies

1. **Embed the profile** (same as movie embeddings)
2. **pgvector search** → Top 50 candidates (cosine similarity)
3. **Filter dealbreakers** (remove horror if gore is blocked, etc.)
4. **LLM rerank** → Top 5 with reasons

### Optional: Explain
User clicks "Why this?" on a recommendation
→ LLM generates: "You said [mood preferences], so I picked this because [plot/tone/pacing]..."

---

## Dataset

### Source
- **TMDB API** (movies, metadata, free)
- **MovieLens** (optional, ratings)
- Fallback: Kaggle dataset dump

### Per-Movie Fields
```
- title
- year
- overview / plot
- genres (list)
- runtime (mins)
- keywords / tags
- director
- main cast (2-3 names)
- language
- IMDb/TMDB rating
- popularity score
- poster_url
```

### Embedding Strategy
- **Precompute once:** Each movie → Gemini/Qwen embedding
- **Store in PostgreSQL + pgvector** extension
- **User profile:** Same embedding function, search via cosine similarity

---

## Tech Stack

### Frontend
- **Next.js** (App Router)
- **Tailwind** (styling)
- **Framer Motion** (optional, nice transitions)

### Backend
- **Go** (Gin or Fiber) — handles LLM calls, embeddings, search
- **PostgreSQL + pgvector** — movie embeddings + storage

### LLM / Embeddings
- **Gemini 2.5 Flash** (free tier, API key)
  - Prompt parsing (answers → JSON mood)
  - Reranking top 50
  - Explanations
- **Same model or text-embedding-004** for embeddings

### Deployment
- **Frontend:** Vercel
- **Backend:** Railway or Neon (both have free tier)

---

## Database Schema

### movies
```sql
CREATE TABLE movies (
  id SERIAL PRIMARY KEY,
  tmdb_id INT UNIQUE,
  title VARCHAR(255),
  year INT,
  overview TEXT,
  genres TEXT[], -- ["Action", "Thriller"]
  keywords TEXT[], -- ["heist", "crime", ...]
  runtime INT,
  director VARCHAR(255),
  cast TEXT[], -- ["Actor1", "Actor2"]
  language VARCHAR(10),
  rating FLOAT, -- IMDb/TMDB
  popularity FLOAT,
  poster_url TEXT,
  embedding vector(768) -- Gemini embedding dimension
);

CREATE INDEX ON movies USING ivfflat (embedding vector_cosine_ops);
```

### questions_log (optional)
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP,
  answers JSONB, -- {"q1": "Surprise me", "q2": "Fast paced", ...}
  mood_profile JSONB, -- LLM-generated profile
  recommendations TEXT[], -- Top 5 movie IDs
  user_notes TEXT
);
```

---

## API Endpoints

### `POST /api/question`
**Get next question based on prior answers**

Request:
```json
{
  "answers": {
    "q1": "Surprise me",
    "q2": "Fast paced"
  }
}
```

Response:
```json
{
  "question": "How much attention can you give?",
  "options": ["Full focus", "Half-watching"],
  "is_final": false
}
```

If `is_final: true`, skip to `/api/recommend`.

---

### `POST /api/recommend`
**Get 5 movies**

Request:
```json
{
  "answers": {
    "q1": "Surprise me",
    "q2": "Fast paced",
    "q3": "Full focus"
  }
}
```

Response:
```json
{
  "recommendations": [
    {
      "id": 550,
      "title": "Fight Club",
      "year": 1999,
      "overview": "...",
      "poster_url": "...",
      "genres": ["Drama", "Thriller"],
      "rating": 8.8
    },
    ...
  ]
}
```

---

### `POST /api/explain`
**Explain why a movie was recommended**

Request:
```json
{
  "movie_id": 550,
  "mood_profile": { ... },
  "user_answers": { ... }
}
```

Response:
```json
{
  "explanation": "You wanted something surprising and fast-paced with zero boring moments. This cult classic deconstructs expectations in the first 10 mins and never lets up."
}
```

---

## LLM Prompts

### Parse Answers → Mood Profile
```
The user answered these questions about their movie mood:
Q1: {q1}
Q2: {q2}
Q3: {q3}

Respond ONLY with JSON (no markdown):
{
  "mood": "short description of overall vibe",
  "pace": "fast|slow|any",
  "tone": "light|dark|gritty|etc",
  "ending": "happy|sad|any",
  "violence": "low|medium|high|none",
  "focus_required": "full|background",
  "genres": ["genre1", "genre2"],
  "dealbreakers": ["gore", "romance"] or [],
  "keywords_to_boost": ["heist", "psychological"],
  "keywords_to_avoid": []
}
```

### Rerank Top 50 → Pick 5
```
User mood: {mood_profile}

I've found these 50 candidate movies (sorted by similarity):
1. {title} - {overview}
2. {title} - {overview}
...

Rank the top 5 that best match the user's mood. Respond ONLY with JSON:
{
  "top_5": [
    { "movie_id": 550, "title": "Fight Club", "score": 95 },
    ...
  ],
  "reasoning": "Brief overall reasoning"
}
```

### Explain a Recommendation
```
User answered:
{user_answers}

This generated mood profile:
{mood_profile}

Movie we're explaining:
Title: {title}
Plot: {overview}
Genres: {genres}
Tone/Pacing: {keywords}

Why did we pick this? Respond in 1-2 sentences, casual tone:
```

---

## Nice-to-Haves (Not MVP)

- **Hidden Gems toggle:** Boost obscure films, derank blockbusters
- **Friend Mode:** Two people answer separately, LLM merges preferences
- **Already Watched:** Paste IMDb/Letterboxd URL, auto-exclude watched
- **Dark mode:** Because it's a movie app

---

## Build Order

1. **Basic backend** (Go + Gin, parse answers → mood JSON)
2. **Database** (load ~1000 movies, create embeddings)
3. **Vector search** (pgvector query, top 50)
4. **Frontend** (Next.js, Q1, get response, display results)
5. **Adaptive questions** (add Q2, check confidence, decide next question)
6. **Explanations** (optional, LLM explains picks)
7. **Deploy** (Vercel + Railway)

---

## Notes

- Free Gemini tier is generous. Unless you're hammering it, you won't hit limits.
- Pre-embed all movies once, search is cheap after that.
- Don't overthink the mood profile JSON structure—adjust as you build.
- Test the LLM reranking prompt a bunch. It's the quality lever.