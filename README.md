# 🎬 MoodFlix

> Answer up to 5 mood questions → AI finds your perfect movie tonight.

**Stack:** Next.js + Tailwind + Framer Motion • Go + Gin • PostgreSQL + pgvector • Gemini 2.5 Flash

---

## Prerequisites

- Docker & Docker Compose
- Go 1.22+
- Node.js 20+
- [Gemini API key](https://aistudio.google.com) (free)
- `movies_metadata.csv` from [Kaggle](https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset)

---

## Setup

### 1. Start the database

```bash
docker-compose up -d
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY
```

### 3. Ingest movies

Place `movies_metadata.csv` at `backend/data/movies_metadata.csv`, then:

```bash
cd backend
go run scripts/ingest/main.go
# Takes ~10–15 min for ~5000 movies. Resumable if interrupted.
```

### 4. Start the backend

```bash
cd backend
go run cmd/server/main.go
# Runs on http://localhost:8080
```

### 5. Start the frontend

```bash
cd frontend
cp .env.local.example .env.local
npm run dev
# Runs on http://localhost:3000
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/question` | Get next adaptive question |
| POST | `/api/recommend` | Get 5 movie recommendations |
| POST | `/api/explain` | Explain why a movie was picked |

---

## Project Structure

```
movieflix/
├── docker-compose.yml        # PostgreSQL + pgvector
├── backend/                  # Go + Gin API
│   ├── cmd/server/main.go    # Server entrypoint
│   ├── internal/
│   │   ├── api/              # HTTP handlers
│   │   ├── llm/              # Gemini client (questions, embed, rerank, explain)
│   │   ├── db/               # pgvector search + movie queries
│   │   └── models/           # Shared types
│   ├── migrations/           # SQL schema
│   └── scripts/ingest/       # CSV → embed → insert
└── frontend/                 # Next.js App Router
    ├── app/                  # Pages (/, /quiz, /results)
    ├── components/           # MovieCard, ExplainModal
    └── lib/api.ts            # Typed API client
```

---

## Nice-to-Haves (Post-MVP)

- Hidden Gems toggle (boost obscure films)
- Friend Mode (merge two people's preferences)
- Already Watched import from Letterboxd/IMDb
- Dark mode toggle
