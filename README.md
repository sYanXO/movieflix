# 🎬 MoodFlix

> Answer up to 5 mood questions → AI finds your perfect movie tonight.

**Stack:** Next.js + TailwindCSS + Framer Motion • Go + Gin • PostgreSQL + pgvector • Gemini 3.1 Flash Lite & Gemini Embeddings

---

## 🚀 Key Features

- **Adaptive AI Quiz**: Generates a set of 3 highly context-specific, creative questions dynamically based on your starter mood using `gemini-3.1-flash-lite`.
- **Hybrid Semantic Vector Search**: Embeds your computed mood profile via `gemini-embedding-001` (768 dimensions) and retrieves candidate movies from PostgreSQL using `pgvector` cosine similarity.
- **Advanced AI Reranking**: Uses Gemini to filter dealbreakers and rerank candidates to curate the perfect top 5 matches.
- **Cinematic Mood Breakdown & Personas**: Renders detailed attribute breakdowns (scores 0-100) and assigns a fun viewer persona (e.g. *"The Brooding Auteur"*, *"The Cozy Escapist"*, *"The Adrenaline Junkie"*).
- **Friend Mode (Local & Remote Session Sharing)**: 
  - **Local**: Take the quiz together and merge responses for a co-watching pick.
  - **Remote**: Create a shareable session link. User A plays, sends the link to User B, and the backend automatically merges their profiles once User B submits.
- **Smart Poster Proxy with DuckDuckGo Fallback**: Streams TMDB posters directly. If posters are missing or fail, it automatically triggers a background DuckDuckGo image search to scrape posters and caches them back to the database.
- **In-Memory Cache**: Caches identical recommendation paths for near-instant responses (<1ms) and zero redundant API costs.

---

## 🛠️ Setup & Installation

### Prerequisites

- **Docker & Docker Compose**
- **Go 1.22+**
- **Node.js 20+**
- [**Gemini API Key**](https://aistudio.google.com) (free or pay-as-you-go)
- `movies_metadata.csv` from [Kaggle](https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset)

---

### Step-by-Step Setup

#### 1. Spin up the database
Runs a PostgreSQL container with the `pgvector` extension pre-installed on port `5433` (mapped from `5432` internally).
```bash
docker-compose up -d
```

#### 2. Configure the Backend Environment
```bash
cd backend
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY
```

#### 3. Ingest Movie Dataset
Place `movies_metadata.csv` inside `backend/data/movies_metadata.csv`. Then run the ingestion script to parse, embed, and store the movies:
```bash
cd backend
go run scripts/ingest/main.go
# Uses gemini-embedding-001 (768-dim) to precompute embeddings.
# Rate-limited (650ms delay) to safely run on Gemini Free Tier.
# Takes ~10–15 min for 5,000 movies. Resumable if interrupted.
```

#### 4. Run the Dev Environment
You can start both the Go server and the Next.js client concurrently using the root dev script:
```bash
./dev.sh
```
*Alternatively, run them separately:*
- **Backend (http://localhost:8080)**: `cd backend && go run cmd/server/main.go`
- **Frontend (http://localhost:3000)**: `cd frontend && npm install && npm run dev`

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/health` | Server health check |
| **POST** | `/api/generate-quiz` | Generates 3 dynamic, context-specific questions based on a starter mood. |
| **POST** | `/api/recommend` | Evaluates quiz answers to return 5 movie recommendations and a `MoodProfile`. |
| **POST** | `/api/recommend-friends` | Merges two sets of local answers to generate shared recommendations. |
| **POST** | `/api/explain` | Generates a 1-2 sentence AI explanation for a given movie recommendation. |
| **POST** | `/api/mood-breakdown` | Analyzes a `MoodProfile` to return attribute scores and a viewer persona. |
| **GET** | `/api/proxy-image` | Proxies movie poster streaming with automated DuckDuckGo search fallback and DB caching. |
| **POST** | `/api/sessions` | Initiates a remote sharing session using User A's answers. |
| **GET** | `/api/sessions/:id` | Polls the current state, progress, and results of a remote sharing session. |
| **POST** | `/api/sessions/:id/submit` | Submits User B's answers to the session, triggering the recommendation merge. |

---

### Request/Response Payload Details

<details>
<summary>1. <code>POST /api/generate-quiz</code></summary>

**Request:**
```json
{
  "starter_answer": "It's been a long, stressful week."
}
```
**Response:**
```json
{
  "questions": [
    {
      "question": "What level of mental energy do you have left?",
      "options": ["Complete brain-off escape", "Ready for a slow-burn thriller", "Stimulating mystery"],
      "is_final": false
    },
    ...
  ]
}
```
</details>

<details>
<summary>2. <code>POST /api/recommend</code></summary>

**Request:**
```json
{
  "answers": {
    "q1": "Stressful week",
    "q2": "Complete brain-off escape",
    "q3": "Mindless comedy"
  }
}
```
**Response:**
```json
{
  "recommendations": [
    {
      "id": 12,
      "tmdb_id": 550,
      "title": "Fight Club",
      "year": 1999,
      "overview": "An insomniac office worker...",
      "genres": ["Drama", "Thriller"],
      "keywords": ["anarchy", "split persona"],
      "runtime": 139,
      "language": "en",
      "rating": 8.4,
      "poster_url": "/path/to/poster.jpg"
    }
  ],
  "mood_profile": {
    "mood": "stress relief",
    "pace": "fast",
    "tone": "dark humor",
    "ending": "any",
    "violence": "medium",
    "focus_required": "low",
    "genres": ["Comedy", "Action"],
    "dealbreakers": [],
    "keywords_to_boost": [],
    "keywords_to_avoid": []
  }
}
```
</details>

<details>
<summary>3. <code>POST /api/sessions</code> (Create session for User A)</summary>

**Request:**
```json
{
  "answers_a": {
    "q1": "Tense and atmospheric"
  }
}
```
**Response:**
```json
{
  "session_id": "bf5215c0-43ef-4b47-b847-1960251cf57b"
}
```
</details>

<details>
<summary>4. <code>POST /api/sessions/:id/submit</code> (Submit User B and get merged results)</summary>

**Request:**
```json
{
  "answers_b": {
    "q1": "Mindless action"
  }
}
```
**Response:**
```json
{
  "recommendations": [...],
  "mood_profile": { ... },
  "merged_mood": "A fast-paced thriller that pairs tense action with atmospheric depth."
}
```
</details>

---

## 📁 Project Structure

```
movieflix/
├── docker-compose.yml        # PostgreSQL + pgvector config (Port 5433)
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

