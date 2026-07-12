# 🎬 MoodFlix

> Answer up to 5 mood questions → AI finds your perfect movie tonight.

**Stack:** Next.js + TailwindCSS + Framer Motion • Go + Gin • PostgreSQL + pgvector • Gemini 3.1 Flash Lite & Gemini Embeddings

---

## 🚀 Features & Implementation

- **Adaptive AI Quiz Generation**
  - *Implementation:* Single-shot adaptive AI quiz generation using `gemini-3.1-flash-lite` to prevent rate limits. Asks context-specific day/week vibe questions.
  - *Main:* Gemini LLM dynamically generates options based on previous answers.
  - *Fallback:* Hardcoded static mood questions if API rate limits are hit or the LLM fails.

- **Hybrid Semantic Vector Search**
  - *Implementation:* Embeds computed mood profile via `gemini-embedding-001` (768 dimensions) and retrieves candidate movies from PostgreSQL using `pgvector` cosine similarity.
  - *Main:* Vector similarity search using precomputed Gemini embeddings.
  - *Fallback:* Standard keyword/genre filtering if vector search returns low confidence.

- **Vector Space Visualizer**
  - *Implementation:* Renders the embedding space of movies to show how recommendations cluster.
  - *Main:* Uses Gemini LLM query classification to map user intents to visual clusters accurately.
  - *Fallback:* Basic 2D PCA projection of vector space if LLM classification fails.

- **Self-Improving Prompt Loop & Reranking**
  - *Implementation:* Uses Gemini to filter dealbreakers, rerank candidates, and refine prompts based on user behavior to curate the top 5 matches.
  - *Main:* AI reranking with dealbreaker validation and friend mode feedback.
  - *Fallback:* Database-level popularity/rating sorting if AI reranking fails.

- **Cinematic Mood Breakdown & Personas**
  - *Implementation:* Analyzes the final `MoodProfile` to render detailed attribute breakdowns (scores 0-100) and assigns a fun viewer persona (e.g., *"The Brooding Auteur"*).
  - *Main:* AI-generated dynamic personas and dynamic scores.
  - *Fallback:* Preset static personas mapped to genres.

- **Friend Mode (Local & Remote Session Sharing)**
  - *Implementation:* Orchestrates recommendation duplicate consolidation into the `RecommendationEngine` with parallel parsing and incorporates feedback loops.
  - *Main:* Syncs remote sessions where User A and User B share a link, merging their profiles via the backend automatically once User B submits.
  - *Fallback:* Local session merge (taking the quiz together on one device) if real-time remote syncing drops.

- **Smart Poster Proxy**
  - *Implementation:* Proxies movie poster streaming directly to the client.
  - *Main:* Official TMDB poster API.
  - *Fallback:* Background DuckDuckGo image search to scrape posters and cache them back to the database if TMDB posters are missing or fail.

- **In-Memory Caching**
  - *Implementation:* Caches identical recommendation paths for near-instant responses (<1ms) and zero redundant API costs.
  - *Main:* In-Memory application caching.
  - *Fallback:* Direct database/LLM queries on cache miss.

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/health` | Server health check |
| **POST** | `/api/generate-quiz` | Generates dynamic, context-specific questions based on a starter mood. |
| **POST** | `/api/recommend` | Evaluates quiz answers to return movie recommendations and a `MoodProfile`. |
| **POST** | `/api/recommend-friends` | Merges two sets of local answers to generate shared recommendations. |
| **POST** | `/api/explain` | Generates a 1-2 sentence AI explanation for a given movie recommendation. |
| **POST** | `/api/mood-breakdown` | Analyzes a `MoodProfile` to return attribute scores and a viewer persona. |
| **GET** | `/api/proxy-image` | Proxies movie poster streaming with automated DuckDuckGo search fallback and DB caching. |
| **POST** | `/api/sessions` | Initiates a remote sharing session using User A's answers. |
| **GET** | `/api/sessions/:id` | Polls the current state, progress, and results of a remote sharing session. |
| **POST** | `/api/sessions/:id/submit` | Submits User B's answers to the session, triggering the recommendation merge. |

---

## 📁 Project Structure

```text
movieflix/
├── docker-compose.yml        # PostgreSQL + pgvector config
├── dev.sh                    # Automated shell script to start db + backend + frontend
├── backend/                  # Go + Gin API
│   ├── cmd/server/main.go    # Server entrypoint
│   ├── internal/
│   │   ├── api/              # HTTP routers & handlers
│   │   ├── llm/              # Gemini Client wrapper (dynamic quizzes, embeddings, reranking, breakdowns)
│   │   ├── db/               # PostgreSQL & pgvector interfaces
│   │   ├── models/           # Shared API Request/Response structs
│   │   └── recommendation/   # Core Recommendation Engine (with caching wrapper)
│   ├── migrations/           # PostgreSQL DB tables initialization SQL
│   └── scripts/ingest/       # CSV ingest script with Gemini embedding calculation
└── frontend/                 # Next.js App Router (TypeScript)
    ├── app/                  # Main page, /quiz, /results routes
    ├── components/           # UI elements (MovieCard, ExplainModal, etc.)
    └── lib/api.ts            # Typed REST API Client
```
