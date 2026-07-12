# MoodFlix Harness Loop Phase 1: Feedback & Measurement

## Objective
Implement a feedback collection system to measure recommendation quality and enable iterative prompt optimization.

## Phase 1: Feedback Collection

### 1.1 Database Schema

Add to your PostgreSQL schema:

```sql
CREATE TABLE recommendation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  quiz_responses JSONB NOT NULL,
  mood_profile JSONB NOT NULL,
  recommended_movies JSONB NOT NULL, -- array of {movie_id, title, score}
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE session_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES recommendation_sessions(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 1-5 stars
  watched_movies TEXT[] DEFAULT '{}', -- array of movie titles user watched
  feedback_text TEXT, -- optional: user comment
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id) -- one feedback per session
);

CREATE INDEX idx_session_feedback_rating ON session_feedback(rating);
CREATE INDEX idx_session_feedback_created ON session_feedback(created_at);
```

### 1.2 API Endpoints

#### POST `/recommendations` (existing, modify)
**Current behavior:** Return top 5 movies.
**New behavior:** 
- Before returning, save the entire flow to `recommendation_sessions`:
  ```json
  {
    "user_id": "user_123",
    "quiz_responses": [...],
    "mood_profile": {...},
    "recommended_movies": [
      {"movie_id": 550, "title": "Fight Club", "score": 94},
      ...
    ]
  }
  ```
- Return the recommendations + **session_id in response**:
  ```json
  {
    "session_id": "abc-123-def",
    "recommendations": [...],
    "mood_breakdown": {...}
  }
  ```

#### POST `/sessions/{session_id}/feedback`
**Purpose:** Record user rating + watched movies.

**Request:**
```json
{
  "rating": 4,
  "watched_movies": ["Fight Club", "Requiem for a Dream"],
  "feedback_text": "Great picks, loved Fight Club"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback recorded"
}
```

**Validation:**
- `rating` must be 1-5
- `watched_movies` must be a subset of the 5 recommended titles
- Return 404 if session_id doesn't exist or feedback already exists for that session

#### GET `/metrics`
**Purpose:** Aggregate accuracy and diagnostic data.

**Query params:**
- `days` (optional, default 30): Look back N days
- `question_filter` (optional): Filter by specific quiz question (e.g., "mood_vibe")

**Response:**
```json
{
  "period_days": 30,
  "total_sessions": 42,
  "sessions_with_feedback": 28,
  "accuracy": 0.71,
  "accuracy_breakdown": {
    "rating_5": 8,
    "rating_4": 12,
    "rating_3": 5,
    "rating_2": 2,
    "rating_1": 1
  },
  "avg_watched_per_session": 1.3,
  "low_performers": [
    {
      "session_id": "xyz-456",
      "rating": 1,
      "quiz_responses": {...},
      "recommended_movies": [...]
    }
  ]
}
```

**Definition of "accuracy":** `(count where rating >= 4) / total_sessions_with_feedback`

---

## Phase 1.5: Frontend Changes

### Feedback Modal
After showing top 5 recommendations, display:

```
[Card Layout]
┌─────────────────────────────────┐
│ How'd we do?                    │
├─────────────────────────────────┤
│                                 │
│  ⭐ ⭐ ⭐ ⭐ ⭐  (clickable)    │
│  [rating selected]              │
│                                 │
│ Which did you watch?            │
│  ☐ Fight Club                   │
│  ☐ Requiem for a Dream          │
│  ☐ The Matrix                   │
│  ☐ Inception                    │
│  ☐ Interstellar                 │
│                                 │
│ [Optional feedback text input]  │
│                                 │
│         [Submit]  [Skip]        │
└─────────────────────────────────┘
```

**Behavior:**
- Modal appears after recommendations load
- Star rating is required; checkboxes + text are optional
- On submit: POST to `/sessions/{session_id}/feedback`
- On skip: Dismiss modal, don't record feedback
- Show success toast on submit

---

## Phase 2: Analysis & Iteration (NOT in this spec, but document for context)

Once you have ≥30 sessions with feedback:

```python
# Pseudo-code for harness analysis
results = query_metrics(days=30)
accuracy = results['accuracy']

if accuracy < 0.65:
    # Identify failure patterns
    failures = query_low_performers(rating=1)
    print(f"Found {len(failures)} 1-star recs")
    
    # Group by quiz question
    for q in ['mood_vibe', 'genre_openness', 'pacing']:
        q_failures = [f for f in failures if f['quiz_responses'][q] == X]
        print(f"Question '{q}' correlates with failures")
    
    # Decision: Tweak quiz prompt, reword question, etc.
    # Re-deploy, measure again
```

---

## Implementation Checklist

- [ ] Add `recommendation_sessions` table
- [ ] Add `session_feedback` table
- [ ] Modify POST `/recommendations` to save session + return `session_id`
- [ ] Implement POST `/sessions/{session_id}/feedback`
- [ ] Implement GET `/metrics`
- [ ] Add feedback modal to frontend
- [ ] Test: complete a quiz, submit feedback, check `/metrics`
- [ ] Document the feedback loop in your README

---

## Notes

1. **User ID:** If you don't have auth, use a session cookie or localStorage UUID.
2. **Watched movies:** Store movie titles for simplicity; can store IDs if you prefer.
3. **Accuracy definition:** You can adjust (e.g., rating >= 3, or weighted score). Keep it simple at first.
4. **Privacy:** If this goes public, add a privacy notice about collecting feedback + quiz data.
5. **Metrics dashboard:** For now, `/metrics` endpoint is sufficient. Later, add a simple React component to visualize this
---

## Success Criteria

- ✅ Record 30+ feedback entries
- ✅ Calculate accuracy from `/metrics`
- ✅ Identify at least 1 failure pattern (e.g., "certain questions correlate with low ratings")
- ✅ Document findings in a blog post / case study

