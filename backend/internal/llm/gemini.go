package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"google.golang.org/genai"
	"moodflix/internal/models"
)

// Client wraps the Gemini generative AI client.
type Client struct {
	inner  *genai.Client
	apiKey string
}

// NewClient creates a new Gemini LLM client.
func NewClient(apiKey string) (*Client, error) {
	ctx := context.Background()
	c, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("creating gemini client: %w", err)
	}
	return &Client{inner: c, apiKey: apiKey}, nil
}

const flashModel = "gemini-3.1-flash-lite"

// generate sends a prompt to Gemini 2.5 Flash and returns the text response.
func (c *Client) generate(ctx context.Context, prompt string) (string, error) {
	result, err := c.inner.Models.GenerateContent(ctx, flashModel,
		genai.Text(prompt), nil)
	if err != nil {
		return "", fmt.Errorf("generate content: %w", err)
	}
	if len(result.Candidates) == 0 {
		return "", fmt.Errorf("no candidates returned")
	}
	var sb strings.Builder
	for _, part := range result.Candidates[0].Content.Parts {
		sb.WriteString(part.Text)
	}
	return sb.String(), nil
}

// stripJSON removes markdown code fences if the LLM wraps JSON in them.
func stripJSON(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

// GenerateAdaptiveQuiz generates a set of 3 highly customized movie-mood questions based on the user's initial answer.
func (c *Client) GenerateAdaptiveQuiz(ctx context.Context, starterAnswer string) ([]models.QuestionResponse, error) {
	prompt := fmt.Sprintf(`The user was asked: "How would you describe your week so far?"
They answered: "%s"

Generate exactly 3 highly creative, personalized, multi-choice questions to narrow down what movie they should watch. 
Each question should have 3-4 options. 

Respond ONLY with valid JSON (no markdown):
[
  {
    "question": "exact question text",
    "options": ["option1", "option2", ...],
    "is_final": false
  },
  ...
]`, starterAnswer)

	raw, err := c.generate(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var questions []models.QuestionResponse
	if err := json.Unmarshal([]byte(stripJSON(raw)), &questions); err != nil {
		return nil, fmt.Errorf("parsing adaptive quiz response: %w\nraw: %s", err, raw)
	}

	// Safety fallback
	if len(questions) == 0 {
		return nil, fmt.Errorf("no questions generated")
	}

	return questions, nil
}

// ParseMoodProfile converts user answers to a structured mood profile.
func (c *Client) ParseMoodProfile(ctx context.Context, answers map[string]string) (*models.MoodProfile, error) {
	var parts []string
	keys := []string{"q1", "q2", "q3", "q4", "q5"}
	for _, k := range keys {
		if v, ok := answers[k]; ok {
			parts = append(parts, fmt.Sprintf("%s: %s", strings.ToUpper(k), v))
		}
	}
	answersText := strings.Join(parts, "\n")

	prompt := fmt.Sprintf(`The user answered these questions about their movie mood:
%s

Respond ONLY with JSON (no markdown):
{
  "mood": "short description of overall vibe",
  "pace": "fast|slow|any",
  "tone": "light|dark|gritty|uplifting|tense|scary|etc",
  "ending": "happy|sad|dark|any",
  "violence": "low|medium|high|none",
  "focus_required": "full|background",
  "genres": ["genre1", "genre2"],
  "dealbreakers": ["gore", "romance"] or [],
  "keywords_to_boost": ["heist", "psychological"],
  "keywords_to_avoid": []
}`, answersText)

	raw, err := c.generate(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var profile models.MoodProfile
	if err := json.Unmarshal([]byte(stripJSON(raw)), &profile); err != nil {
		return nil, fmt.Errorf("parsing mood profile: %w\nraw: %s", err, raw)
	}
	return &profile, nil
}

// ReRank takes top 50 candidate movies and picks the best 5 for the user's mood profile.
func (c *Client) ReRank(ctx context.Context, profile *models.MoodProfile, candidates []models.Movie) ([]models.Movie, error) {
	profileJSON, _ := json.Marshal(profile)

	var movieList strings.Builder
	for i, m := range candidates {
		genres := strings.Join(m.Genres, ", ")
		movieList.WriteString(fmt.Sprintf("%d. [ID:%d] %s (%d) - Genres: %s - %s\n",
			i+1, m.ID, m.Title, m.Year, genres, truncate(m.Overview, 150)))
	}

	prompt := fmt.Sprintf(`User mood profile:
%s

I've found these candidate movies (sorted by vector similarity):
%s

Rank the top 5 that best match the user's mood. Avoid movies that conflict with dealbreakers.
Respond ONLY with valid JSON (no markdown):
{
  "top_5": [
    { "movie_id": 123, "title": "Movie Title", "score": 95 },
    ...
  ],
  "reasoning": "Brief overall reasoning"
}`, string(profileJSON), movieList.String())

	raw, err := c.generate(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var result struct {
		Top5 []struct {
			MovieID int    `json:"movie_id"`
			Title   string `json:"title"`
			Score   int    `json:"score"`
		} `json:"top_5"`
		Reasoning string `json:"reasoning"`
	}
	if err := json.Unmarshal([]byte(stripJSON(raw)), &result); err != nil {
		return nil, fmt.Errorf("parsing rerank response: %w\nraw: %s", err, raw)
	}

	// Build a map for quick lookup
	movieMap := make(map[int]models.Movie)
	for _, m := range candidates {
		movieMap[m.ID] = m
	}

	var top5 []models.Movie
	for _, r := range result.Top5 {
		if m, ok := movieMap[r.MovieID]; ok {
			top5 = append(top5, m)
		}
		if len(top5) == 5 {
			break
		}
	}
	// Fallback: if LLM returned fewer than 5, pad from candidates
	for _, m := range candidates {
		if len(top5) >= 5 {
			break
		}
		found := false
		for _, t := range top5 {
			if t.ID == m.ID {
				found = true
				break
			}
		}
		if !found {
			top5 = append(top5, m)
		}
	}

	return top5, nil
}

// Explain generates a 1-2 sentence explanation for why a movie was recommended.
func (c *Client) Explain(ctx context.Context, profile *models.MoodProfile, answers map[string]string, movie models.Movie) (string, error) {
	answersJSON, _ := json.Marshal(answers)
	profileJSON, _ := json.Marshal(profile)

	prompt := fmt.Sprintf(`User answered:
%s

This generated mood profile:
%s

Movie we're explaining:
Title: %s
Plot: %s
Genres: %s

Why did we pick this? Respond in 1-2 sentences, casual and enthusiastic tone. No bullet points, just plain text.`,
		string(answersJSON),
		string(profileJSON),
		movie.Title,
		movie.Overview,
		strings.Join(movie.Genres, ", "))

	return c.generate(ctx, prompt)
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

// MoodBreakdown scores cinematic attributes from a mood profile and assigns a persona label.
func (c *Client) MoodBreakdown(ctx context.Context, profile *models.MoodProfile) (*models.MoodBreakdownResponse, error) {
	profileJSON, _ := json.Marshal(profile)

	prompt := fmt.Sprintf(`Given this cinematic mood profile:
%s

Score 6-8 cinematic attributes as percentages (0-100) that describe this viewer's taste.
Also assign a fun, evocative cinematic persona label (e.g. "The Brooding Auteur", "The Cozy Escapist", "The Adrenaline Junkie", "The Quiet Philosopher").

Choose attributes relevant to the profile — examples: Thriller, Drama, Comedy, Action, Horror, Sci-Fi, Romance, Slow Burn, Fast Paced, Dark Tone, Light Tone, Thought-Provoking, Feel-Good, Edge-of-Seat, Emotional Depth, Visually Stunning.

Respond ONLY with valid JSON (no markdown):
{
  "attributes": [
    { "label": "Thriller", "score": 85 },
    { "label": "Dark Tone", "score": 75 },
    ...
  ],
  "persona": "The Brooding Auteur"
}`, string(profileJSON))

	raw, err := c.generate(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var resp models.MoodBreakdownResponse
	if err := json.Unmarshal([]byte(stripJSON(raw)), &resp); err != nil {
		return nil, fmt.Errorf("parsing mood breakdown response: %w\nraw: %s", err, raw)
	}
	return &resp, nil
}

// MergeMoodProfiles combines two individual mood profiles into one shared profile for friend mode.
func (c *Client) MergeMoodProfiles(ctx context.Context, profileA, profileB *models.MoodProfile) (*models.MoodProfile, string, error) {
	profileAJSON, _ := json.Marshal(profileA)
	profileBJSON, _ := json.Marshal(profileB)

	prompt := fmt.Sprintf(`Two friends want to watch a movie together. Here are their individual mood profiles:

Person A: %s

Person B: %s

Create a single MERGED mood profile that would satisfy BOTH people. Prioritize overlap. If they conflict, find a middle ground. Respect dealbreakers from BOTH — union of dealbreakers. Also write a short "merged_mood" string (e.g. "A tense thriller you can both get lost in") that captures the shared vibe.

Respond ONLY with valid JSON (no markdown):
{
  "merged_mood": "A tense thriller you can both get lost in",
  "profile": {
    "mood": "...",
    "pace": "fast|slow|any",
    "tone": "...",
    "ending": "happy|sad|dark|any",
    "violence": "low|medium|high|none",
    "focus_required": "full|background",
    "genres": ["genre1", "genre2"],
    "dealbreakers": [],
    "keywords_to_boost": [],
    "keywords_to_avoid": []
  }
}`, string(profileAJSON), string(profileBJSON))

	raw, err := c.generate(ctx, prompt)
	if err != nil {
		return nil, "", err
	}

	var result struct {
		MergedMood string            `json:"merged_mood"`
		Profile    models.MoodProfile `json:"profile"`
	}
	if err := json.Unmarshal([]byte(stripJSON(raw)), &result); err != nil {
		return nil, "", fmt.Errorf("parsing merged mood profile: %w\nraw: %s", err, raw)
	}
	return &result.Profile, result.MergedMood, nil
}
