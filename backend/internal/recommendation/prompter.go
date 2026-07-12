package recommendation

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"moodflix/internal/db"
	"moodflix/internal/llm"
	"moodflix/internal/models"
)

// LLMPrompter formats domain models into prompts, calls the LLMAdapter, and parses the JSON response.
type LLMPrompter struct {
	adapter llm.LLMAdapter
	prompts *db.PromptManager
}

// NewLLMPrompter creates a new LLMPrompter.
func NewLLMPrompter(adapter llm.LLMAdapter, prompts *db.PromptManager) *LLMPrompter {
	return &LLMPrompter{
		adapter: adapter,
		prompts: prompts,
	}
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
func (p *LLMPrompter) GenerateAdaptiveQuiz(ctx context.Context, starterAnswer string) ([]models.QuestionResponse, error) {
	fallback := `The user was asked: "How would you describe your week so far?"
They answered: "%s"

Generate exactly 3 highly creative, personalized, multi-choice questions to narrow down what movie they should watch. 
Each question should have 3-4 options. 

Respond ONLY with valid JSON (no markdown):
[
  {
    "question": "exact question text",
    "options": ["option1", "option2", ...],
    "is_final": false
  }
]`

	template := fallback
	if p.prompts != nil {
		if t, err := p.prompts.GetActivePrompt(ctx, "GenerateAdaptiveQuiz", fallback); err == nil {
			template = t
		}
	}
	prompt := fmt.Sprintf(template, starterAnswer)

	raw, err := p.adapter.GenerateText(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var questions []models.QuestionResponse
	if err := json.Unmarshal([]byte(stripJSON(raw)), &questions); err != nil {
		return nil, fmt.Errorf("parsing adaptive quiz response: %w\nraw: %s", err, raw)
	}

	if len(questions) == 0 {
		return nil, fmt.Errorf("no questions generated")
	}

	return questions, nil
}

// ParseMoodProfile converts user answers to a structured mood profile.
func (p *LLMPrompter) ParseMoodProfile(ctx context.Context, answers map[string]string) (*models.MoodProfile, error) {
	var parts []string
	keys := []string{"q1", "q2", "q3", "q4", "q5"}
	for _, k := range keys {
		if v, ok := answers[k]; ok {
			parts = append(parts, fmt.Sprintf("%s: %s", strings.ToUpper(k), v))
		}
	}
	answersText := strings.Join(parts, "\n")

	fallback := `The user answered these questions about their movie mood:
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
}`

	template := fallback
	if p.prompts != nil {
		if t, err := p.prompts.GetActivePrompt(ctx, "ParseMoodProfile", fallback); err == nil {
			template = t
		}
	}
	prompt := fmt.Sprintf(template, answersText)

	raw, err := p.adapter.GenerateText(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var profile models.MoodProfile
	if err := json.Unmarshal([]byte(stripJSON(raw)), &profile); err != nil {
		return nil, fmt.Errorf("parsing mood profile: %w\nraw: %s", err, raw)
	}
	return &profile, nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

// ReRank takes top 50 candidate movies and picks the best 5 for the user's mood profile.
func (p *LLMPrompter) ReRank(ctx context.Context, profile *models.MoodProfile, candidates []models.Movie) ([]models.Movie, error) {
	profileJSON, _ := json.Marshal(profile)

	var movieList strings.Builder
	for i, m := range candidates {
		genres := strings.Join(m.Genres, ", ")
		movieList.WriteString(fmt.Sprintf("%d. [ID:%d] %s (%d) - Genres: %s - %s\n",
			i+1, m.ID, m.Title, m.Year, genres, truncate(m.Overview, 150)))
	}

	fallback := `User mood profile:
%s

I've found these candidate movies:
%s

Rank the top 5 that best match the user's mood. Avoid movies that conflict with dealbreakers.
Respond ONLY with valid JSON (no markdown):
{
  "top_5": [
    { "movie_id": 123, "title": "Movie Title", "score": 95 }
  ],
  "reasoning": "Brief overall reasoning"
}`

	template := fallback
	if p.prompts != nil {
		if t, err := p.prompts.GetActivePrompt(ctx, "ReRank", fallback); err == nil {
			template = t
		}
	}
	prompt := fmt.Sprintf(template, string(profileJSON), movieList.String())

	raw, err := p.adapter.GenerateText(ctx, prompt)
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
func (p *LLMPrompter) Explain(ctx context.Context, profile *models.MoodProfile, answers map[string]string, movie models.Movie) (string, error) {
	answersJSON, _ := json.Marshal(answers)
	profileJSON, _ := json.Marshal(profile)

	fallback := `User answered:
%s

This generated mood profile:
%s

Movie we're explaining:
Title: %s
Plot: %s
Genres: %s

Why did we pick this? Respond in 1-2 sentences, casual and enthusiastic tone. No bullet points, just plain text.`

	template := fallback
	if p.prompts != nil {
		if t, err := p.prompts.GetActivePrompt(ctx, "Explain", fallback); err == nil {
			template = t
		}
	}

	prompt := fmt.Sprintf(template,
		string(answersJSON),
		string(profileJSON),
		movie.Title,
		movie.Overview,
		strings.Join(movie.Genres, ", "))

	return p.adapter.GenerateText(ctx, prompt)
}

// MoodBreakdown scores cinematic attributes from a mood profile and assigns a persona label.
func (p *LLMPrompter) MoodBreakdown(ctx context.Context, profile *models.MoodProfile) (*models.MoodBreakdownResponse, error) {
	profileJSON, _ := json.Marshal(profile)

	fallback := `Given this cinematic mood profile:
%s

Score 6-8 cinematic attributes as percentages (0-100) that describe this viewer's taste.
Also assign a fun, evocative cinematic persona label (e.g. "The Brooding Auteur", "The Cozy Escapist").

Choose attributes relevant to the profile — examples: Thriller, Drama, Comedy, Action, Horror, Sci-Fi, Romance, Slow Burn, Fast Paced, Dark Tone, Light Tone, Thought-Provoking, Feel-Good, Edge-of-Seat, Emotional Depth, Visually Stunning.

Respond ONLY with valid JSON (no markdown):
{
  "attributes": [
    { "label": "Thriller", "score": 85 },
    { "label": "Dark Tone", "score": 75 }
  ],
  "persona": "The Brooding Auteur"
}`

	template := fallback
	if p.prompts != nil {
		if t, err := p.prompts.GetActivePrompt(ctx, "MoodBreakdown", fallback); err == nil {
			template = t
		}
	}
	prompt := fmt.Sprintf(template, string(profileJSON))

	raw, err := p.adapter.GenerateText(ctx, prompt)
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
func (p *LLMPrompter) MergeMoodProfiles(ctx context.Context, profileA, profileB *models.MoodProfile) (*models.MoodProfile, string, error) {
	profileAJSON, _ := json.Marshal(profileA)
	profileBJSON, _ := json.Marshal(profileB)

	fallback := `Two friends want to watch a movie together. Here are their individual mood profiles:

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
}`

	template := fallback
	if p.prompts != nil {
		if t, err := p.prompts.GetActivePrompt(ctx, "MergeMoodProfiles", fallback); err == nil {
			template = t
		}
	}
	prompt := fmt.Sprintf(template, string(profileAJSON), string(profileBJSON))

	raw, err := p.adapter.GenerateText(ctx, prompt)
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

// ClassifyQuery scores a text query against 6 genre clusters and computes a weighted 2D coordinate.
func (p *LLMPrompter) ClassifyQuery(ctx context.Context, text string) (*models.ClassifyQueryResponse, error) {
	fallback := `Analyze the following movie query and score it from 0.0 to 1.0 against these 6 genre archetypes based on how well it matches.
Query: "%s"

Archetypes:
- sci_fi: Sci-Fi Space & Concepts, future, robots, matrix, aliens
- romance: Romance & Relationships, love, musicals, heartbreak
- action: Action & Thrillers, explosions, car chases, vengeance
- comedy: Comedy & Satire, funny, friends, jokes, hangover
- horror: Horror & Paranormal, scary, ghosts, blood, monsters
- drama: Human Drama & Classics, deep, serious, historical, oscar-worthy

Think step-by-step about which archetypes apply and why. First, provide a brief reasoning for your scores. Then, provide the 6 float scores (0.0 to 1.0).
Respond ONLY with valid JSON (no markdown):
{
  "reasoning": "This query mentions 'space' and 'explosions', blending Sci-Fi and Action.",
  "sci_fi": 0.8,
  "romance": 0.0,
  "action": 0.6,
  "comedy": 0.0,
  "horror": 0.0,
  "drama": 0.0
}`

	prompt := fmt.Sprintf(fallback, text)

	raw, err := p.adapter.GenerateText(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var scores struct {
		SciFi   float64 `json:"sci_fi"`
		Romance float64 `json:"romance"`
		Action  float64 `json:"action"`
		Comedy  float64 `json:"comedy"`
		Horror  float64 `json:"horror"`
		Drama   float64 `json:"drama"`
	}
	if err := json.Unmarshal([]byte(stripJSON(raw)), &scores); err != nil {
		return nil, fmt.Errorf("parsing classify scores: %w\nraw: %s", err, raw)
	}

	totalWeight := scores.SciFi + scores.Romance + scores.Action + scores.Comedy + scores.Horror + scores.Drama

	var x, y float64
	if totalWeight > 0 {
		x = (scores.SciFi*-0.55 + scores.Romance*0.53 + scores.Action*-0.58 + scores.Comedy*0.48 + scores.Horror*-0.18 + scores.Drama*0.10) / totalWeight
		y = (scores.SciFi*0.40 + scores.Romance*-0.52 + scores.Action*-0.38 + scores.Comedy*0.45 + scores.Horror*-0.66 + scores.Drama*0.62) / totalWeight
	} else {
		seed := 0
		for _, char := range text {
			seed += int(char)
		}
		x = (float64(seed%7) - 3.5) / 10.0
		y = (float64(seed%9) - 4.5) / 10.0
	}

	return &models.ClassifyQueryResponse{
		X:     x,
		Y:     y,
		Query: text,
	}, nil
}
