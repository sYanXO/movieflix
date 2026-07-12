package models

// MoodProfile is the structured output from the LLM after parsing user answers.
type MoodProfile struct {
	Mood            string   `json:"mood"`
	Pace            string   `json:"pace"`
	Tone            string   `json:"tone"`
	Ending          string   `json:"ending"`
	Violence        string   `json:"violence"`
	FocusRequired   string   `json:"focus_required"`
	Genres          []string `json:"genres"`
	Dealbreakers    []string `json:"dealbreakers"`
	KeywordsToBoost []string `json:"keywords_to_boost"`
	KeywordsToAvoid []string `json:"keywords_to_avoid"`
}

// Movie represents a movie record from the database.
type Movie struct {
	ID        int      `json:"id"`
	TmdbID    int      `json:"tmdb_id"`
	Title     string   `json:"title"`
	Year      int      `json:"year"`
	Overview  string   `json:"overview"`
	Genres    []string `json:"genres"`
	Keywords  []string `json:"keywords"`
	Runtime   int      `json:"runtime"`
	Language  string   `json:"language"`
	Rating    float64  `json:"rating"`
	PosterURL string   `json:"poster_url"`
}

// QuestionResponse is returned by POST /api/question.
type QuestionResponse struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
	IsFinal  bool     `json:"is_final"`
}

// RecommendRequest is the request body for POST /api/recommend.
type RecommendRequest struct {
	Answers map[string]string `json:"answers"`
}

// QuestionRequest is the request body for POST /api/question.
type QuestionRequest struct {
	Answers map[string]string `json:"answers"`
}

// ExplainRequest is the request body for POST /api/explain.
type ExplainRequest struct {
	MovieID     int               `json:"movie_id"`
	MoodProfile *MoodProfile      `json:"mood_profile"`
	UserAnswers map[string]string `json:"user_answers"`
}

// RecommendResponse is returned by POST /api/recommend.
type RecommendResponse struct {
	SessionID       string       `json:"session_id,omitempty"`
	Recommendations []Movie      `json:"recommendations"`
	MoodProfile     *MoodProfile `json:"mood_profile"`
}

// ExplainResponse is returned by POST /api/explain.
type ExplainResponse struct {
	Explanation string `json:"explanation"`
}

// MoodAttribute is a single scored attribute for the breakdown chart.
type MoodAttribute struct {
	Label string `json:"label"`
	Score int    `json:"score"` // 0-100
}

// MoodBreakdownRequest is the request body for POST /api/mood-breakdown.
type MoodBreakdownRequest struct {
	MoodProfile *MoodProfile `json:"mood_profile"`
}

// MoodBreakdownResponse is returned by POST /api/mood-breakdown.
type MoodBreakdownResponse struct {
	Attributes []MoodAttribute `json:"attributes"`
	Persona    string          `json:"persona"`
}

// FriendRecommendRequest is the request body for POST /api/recommend-friends.
type FriendRecommendRequest struct {
	AnswersA map[string]string `json:"answers_a"`
	AnswersB map[string]string `json:"answers_b"`
}

// FriendRecommendResponse is returned by POST /api/recommend-friends.
type FriendRecommendResponse struct {
	SessionID       string       `json:"session_id,omitempty"`
	Recommendations []Movie      `json:"recommendations"`
	MoodProfile     *MoodProfile `json:"mood_profile"`
	MergedMood      string       `json:"merged_mood"`
}

// CreateSessionRequest is the request body for POST /api/sessions.
type CreateSessionRequest struct {
	AnswersA map[string]string `json:"answers_a"`
}

// SubmitSessionRequest is the request body for POST /api/sessions/:id/submit.
type SubmitSessionRequest struct {
	AnswersB map[string]string `json:"answers_b"`
}

// RateSessionRequest is the request body for PATCH /api/sessions/:id/rating.
type RateSessionRequest struct {
	Rating    int    `json:"rating"`
	UserNotes string `json:"user_notes"`
}

// SessionResponse represents the remote sharing session status.
type SessionResponse struct {
	ID              string            `json:"id"`
	AnswersA        map[string]string `json:"answers_a,omitempty"`
	AnswersB        map[string]string `json:"answers_b,omitempty"`
	MergedMood      string            `json:"merged_mood,omitempty"`
	MoodProfile     *MoodProfile      `json:"mood_profile,omitempty"`
	Recommendations []Movie           `json:"recommendations,omitempty"`
	IsComplete      bool              `json:"is_complete"`
}

// GenerateQuizRequest is the request body for POST /api/generate-quiz.
type GenerateQuizRequest struct {
	StarterAnswer string `json:"starter_answer"`
}

// GenerateQuizResponse is returned by POST /api/generate-quiz.
type GenerateQuizResponse struct {
	Questions []QuestionResponse `json:"questions"`
}

// ClassifyQueryResponse is returned by GET /api/classify-query.
type ClassifyQueryResponse struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Query string  `json:"query"`
}

