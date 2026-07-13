package recommendation

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
	"moodflix/internal/db"
	"moodflix/internal/llm"
	"moodflix/internal/models"
)

// RecommendationEngine defines the seam for requesting recommendations and domain operations.
type RecommendationEngine interface {
	GetRecommendations(ctx context.Context, answers map[string]string) (*models.RecommendResponse, error)
	GetFriendRecommendations(ctx context.Context, answersA, answersB map[string]string) (*models.FriendRecommendResponse, error)
	GenerateAdaptiveQuiz(ctx context.Context, starterAnswer string) ([]models.QuestionResponse, error)
	GetMoodBreakdown(ctx context.Context, profile *models.MoodProfile) (*models.MoodBreakdownResponse, error)
	ClassifyQuery(ctx context.Context, text string) (*models.ClassifyQueryResponse, error)
	Explain(ctx context.Context, profile *models.MoodProfile, answers map[string]string, movie models.Movie) (string, error)
}

// DefaultRecommendationEngine implements the recommendations pipeline.
type DefaultRecommendationEngine struct {
	adapter  llm.LLMAdapter
	prompter Prompter
	dbPool   *pgxpool.Pool
}

// NewEngine creates a new DefaultRecommendationEngine.
func NewEngine(adapter llm.LLMAdapter, prompter Prompter, dbPool *pgxpool.Pool) *DefaultRecommendationEngine {
	return &DefaultRecommendationEngine{
		adapter:  adapter,
		prompter: prompter,
		dbPool:   dbPool,
	}
}

// GetRecommendations executes parallel LLM calls, DB vector search, and reranking.
func (e *DefaultRecommendationEngine) GetRecommendations(ctx context.Context, answers map[string]string) (*models.RecommendResponse, error) {
	if len(answers) == 0 {
		return nil, fmt.Errorf("answers cannot be empty")
	}

	var (
		profile  *models.MoodProfile
		embedding []float32
		parseErr  error
		embedErr  error
		wg        sync.WaitGroup
	)

	wg.Add(2)

	// Goroutine A: Parse answers into structured MoodProfile
	go func() {
		defer wg.Done()
		profile, parseErr = e.prompter.ParseMoodProfile(ctx, answers)
	}()

	// Goroutine B: Embed raw answers text in parallel
	go func() {
		defer wg.Done()
		rawText := buildRawAnswersText(answers)
		embedding, embedErr = e.adapter.EmbedText(ctx, rawText)
	}()

	wg.Wait()

	if parseErr != nil {
		return nil, fmt.Errorf("mood parsing failed: %w", parseErr)
	}

	var candidates []models.Movie
	var err error

	// Handle Embed Text rate limits/errors
	if embedErr != nil {
		embedErrStr := strings.ToLower(embedErr.Error())
		if strings.Contains(embedErrStr, "429") || strings.Contains(embedErrStr, "quota") || strings.Contains(embedErrStr, "limit") {
			log.Println("⚠️ Gemini EmbedText rate-limited (429). Falling back to database SQL search...")
			candidates, err = db.GenreAndRatingSearch(ctx, e.dbPool, profile.Genres, 50)
			if err != nil {
				return nil, fmt.Errorf("database fallback query failed: %w", err)
			}
		} else {
			return nil, fmt.Errorf("embedding failed: %w", embedErr)
		}
	} else {
		// Hybrid Search (Vector + Genre Filtering)
		candidates, err = db.HybridSearch(ctx, e.dbPool, embedding, profile.Genres, 50)
		if err != nil {
			return nil, fmt.Errorf("hybrid search failed: %w", err)
		}
	}

	if len(candidates) == 0 {
		return &models.RecommendResponse{
			Recommendations: []models.Movie{},
			MoodProfile:     profile,
		}, nil
	}

	// Filter dealbreakers
	filtered := db.FilterDealbreakers(candidates, profile.Dealbreakers)
	if len(filtered) == 0 {
		filtered = candidates
	}

	// ReRank candidates using LLM (ResilientPrompter handles fallback shuffle internally)
	top5, err := e.prompter.ReRank(ctx, profile, filtered)
	if err != nil {
		top5 = filtered
		if len(top5) > 5 {
			top5 = top5[:5]
		}
	}

	return &models.RecommendResponse{
		Recommendations: top5,
		MoodProfile:     profile,
	}, nil
}

// GetFriendRecommendations merges two users' answers concurrently and generates joint recommendations.
func (e *DefaultRecommendationEngine) GetFriendRecommendations(ctx context.Context, answersA, answersB map[string]string) (*models.FriendRecommendResponse, error) {
	if len(answersA) == 0 || len(answersB) == 0 {
		return nil, fmt.Errorf("answers_a and answers_b cannot be empty")
	}

	var (
		profileA  *models.MoodProfile
		profileB  *models.MoodProfile
		parseAErr error
		parseBErr error
		wg        sync.WaitGroup
	)

	wg.Add(2)

	go func() {
		defer wg.Done()
		profileA, parseAErr = e.prompter.ParseMoodProfile(ctx, answersA)
	}()

	go func() {
		defer wg.Done()
		profileB, parseBErr = e.prompter.ParseMoodProfile(ctx, answersB)
	}()

	wg.Wait()

	if parseAErr != nil {
		return nil, fmt.Errorf("parsing profileA failed: %w", parseAErr)
	}
	if parseBErr != nil {
		return nil, fmt.Errorf("parsing profileB failed: %w", parseBErr)
	}

	// Merge profiles
	mergedProfile, mergedMood, mergeErr := e.prompter.MergeMoodProfiles(ctx, profileA, profileB)
	if mergeErr != nil {
		return nil, fmt.Errorf("profile merge failed: %w", mergeErr)
	}

	// Embed merged profile
	var embedding []float32
	var embedErr error
	var candidates []models.Movie
	var err error

	profileText := buildProfileText(mergedProfile)
	embedding, embedErr = e.adapter.EmbedText(ctx, profileText)
	if embedErr != nil {
		errStr := strings.ToLower(embedErr.Error())
		if strings.Contains(errStr, "429") || strings.Contains(errStr, "quota") || strings.Contains(errStr, "limit") {
			log.Println("⚠️ Rate-limited on embed (friend mode), using genre fallback")
			candidates, err = db.GenreAndRatingSearch(ctx, e.dbPool, mergedProfile.Genres, 50)
			if err != nil {
				return nil, fmt.Errorf("database fallback query failed: %w", err)
			}
		} else {
			return nil, fmt.Errorf("embedding failed: %w", embedErr)
		}
	} else {
		// Hybrid search
		candidates, err = db.HybridSearch(ctx, e.dbPool, embedding, mergedProfile.Genres, 50)
		if err != nil {
			return nil, fmt.Errorf("hybrid search failed: %w", err)
		}
	}

	if len(candidates) == 0 {
		return &models.FriendRecommendResponse{
			Recommendations: []models.Movie{},
			MoodProfile:     mergedProfile,
			MergedMood:      mergedMood,
		}, nil
	}

	// Filter dealbreakers
	allDealbreakers := append(profileA.Dealbreakers, profileB.Dealbreakers...)
	filtered := db.FilterDealbreakers(candidates, allDealbreakers)
	if len(filtered) == 0 {
		filtered = candidates
	}

	// ReRank using LLM
	top5, err := e.prompter.ReRank(ctx, mergedProfile, filtered)
	if err != nil {
		top5 = filtered
		if len(top5) > 5 {
			top5 = top5[:5]
		}
	}

	return &models.FriendRecommendResponse{
		Recommendations: top5,
		MoodProfile:     mergedProfile,
		MergedMood:      mergedMood,
	}, nil
}

func (e *DefaultRecommendationEngine) GenerateAdaptiveQuiz(ctx context.Context, starterAnswer string) ([]models.QuestionResponse, error) {
	return e.prompter.GenerateAdaptiveQuiz(ctx, starterAnswer)
}

func (e *DefaultRecommendationEngine) GetMoodBreakdown(ctx context.Context, profile *models.MoodProfile) (*models.MoodBreakdownResponse, error) {
	return e.prompter.MoodBreakdown(ctx, profile)
}

func (e *DefaultRecommendationEngine) ClassifyQuery(ctx context.Context, text string) (*models.ClassifyQueryResponse, error) {
	return e.prompter.ClassifyQuery(ctx, text)
}

func (e *DefaultRecommendationEngine) Explain(ctx context.Context, profile *models.MoodProfile, answers map[string]string, movie models.Movie) (string, error) {
	return e.prompter.Explain(ctx, profile, answers, movie)
}

// CachedRecommendationEngine wraps an engine with in-memory caching.
type CachedRecommendationEngine struct {
	inner RecommendationEngine
	cache map[string]*models.RecommendResponse
	mu    sync.RWMutex
}

func NewCachedEngine(inner RecommendationEngine) *CachedRecommendationEngine {
	return &CachedRecommendationEngine{
		inner: inner,
		cache: make(map[string]*models.RecommendResponse),
	}
}

func (c *CachedRecommendationEngine) GetRecommendations(ctx context.Context, answers map[string]string) (*models.RecommendResponse, error) {
	key := getCacheKey(answers)

	c.mu.RLock()
	cached, hit := c.cache[key]
	c.mu.RUnlock()

	if hit {
		log.Println("⚡ Recommendation cache hit! Returning cached recommendations.")
		return &models.RecommendResponse{
			Recommendations: cached.Recommendations,
			MoodProfile:     cached.MoodProfile,
		}, nil
	}

	log.Println("🐢 Recommendation cache miss. Fetching fresh recommendations...")
	response, err := c.inner.GetRecommendations(ctx, answers)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache[key] = &models.RecommendResponse{
		Recommendations: response.Recommendations,
		MoodProfile:     response.MoodProfile,
	}
	c.mu.Unlock()

	return response, nil
}

func (c *CachedRecommendationEngine) GetFriendRecommendations(ctx context.Context, answersA, answersB map[string]string) (*models.FriendRecommendResponse, error) {
	return c.inner.GetFriendRecommendations(ctx, answersA, answersB)
}

func (c *CachedRecommendationEngine) GenerateAdaptiveQuiz(ctx context.Context, starterAnswer string) ([]models.QuestionResponse, error) {
	return c.inner.GenerateAdaptiveQuiz(ctx, starterAnswer)
}

func (c *CachedRecommendationEngine) GetMoodBreakdown(ctx context.Context, profile *models.MoodProfile) (*models.MoodBreakdownResponse, error) {
	return c.inner.GetMoodBreakdown(ctx, profile)
}

func (c *CachedRecommendationEngine) ClassifyQuery(ctx context.Context, text string) (*models.ClassifyQueryResponse, error) {
	return c.inner.ClassifyQuery(ctx, text)
}

func (c *CachedRecommendationEngine) Explain(ctx context.Context, profile *models.MoodProfile, answers map[string]string, movie models.Movie) (string, error) {
	return c.inner.Explain(ctx, profile, answers, movie)
}

// buildRawAnswersText concatenates answers into a descriptive string.
func buildRawAnswersText(answers map[string]string) string {
	var sb strings.Builder
	keys := []string{"q1", "q2", "q3", "q4", "q5"}
	for _, k := range keys {
		if v, ok := answers[k]; ok && v != "" {
			sb.WriteString(v)
			sb.WriteString(". ")
		}
	}
	return strings.TrimSpace(sb.String())
}

// getCacheKey builds a unique key representing the quiz answers.
func getCacheKey(answers map[string]string) string {
	var keys []string
	for k := range answers {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var sb strings.Builder
	for _, k := range keys {
		sb.WriteString(fmt.Sprintf("%s:%s|", k, answers[k]))
	}
	return sb.String()
}

// buildProfileText creates an embeddable string representation of the mood profile.
func buildProfileText(p *models.MoodProfile) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Mood: %s. ", p.Mood))
	sb.WriteString(fmt.Sprintf("Pace: %s. ", p.Pace))
	sb.WriteString(fmt.Sprintf("Tone: %s. ", p.Tone))
	sb.WriteString(fmt.Sprintf("Ending: %s. ", p.Ending))
	sb.WriteString(fmt.Sprintf("Focus required: %s. ", p.FocusRequired))
	if len(p.Genres) > 0 {
		sb.WriteString(fmt.Sprintf("Genres: %s. ", strings.Join(p.Genres, ", ")))
	}
	if len(p.KeywordsToBoost) > 0 {
		sb.WriteString(fmt.Sprintf("Keywords: %s.", strings.Join(p.KeywordsToBoost, ", ")))
	}
	return sb.String()
}

// Fallback logic kept locally for ResilientPrompter to consume

func getStaticQuizFallback() []models.QuestionResponse {
	return []models.QuestionResponse{
		{
			Question: "What kind of energy do you need tonight?",
			Options:  []string{"Match my chaos", "Slow and steady", "Brain-off comfort"},
			IsFinal:  false,
		},
		{
			Question: "How much mental capacity do you have left?",
			Options:  []string{"My brain is fried", "Ready to think", "Background noise"},
			IsFinal:  false,
		},
		{
			Question: "How do you want to feel when the credits roll?",
			Options:  []string{"Uplifted", "Mind-blown", "Emotionally destroyed"},
			IsFinal:  false,
		},
		{
			Question:      "What do we absolutely want to avoid today?",
			Options:       []string{"Gore", "Heavy romance", "Subtitles", "Nope, anything goes"},
			IsFinal:       false,
			IsMultiSelect: true,
		},
	}
}

func fallbackBreakdown(p *models.MoodProfile) *models.MoodBreakdownResponse {
	attrs := []models.MoodAttribute{}

	for i, g := range p.Genres {
		score := 90 - i*10
		if score < 50 {
			score = 50
		}
		attrs = append(attrs, models.MoodAttribute{Label: g, Score: score})
	}

	if p.Pace == "fast" {
		attrs = append(attrs, models.MoodAttribute{Label: "Fast Paced", Score: 85})
	} else if p.Pace == "slow" {
		attrs = append(attrs, models.MoodAttribute{Label: "Slow Burn", Score: 85})
	}

	if strings.Contains(strings.ToLower(p.Tone), "dark") || strings.Contains(strings.ToLower(p.Tone), "gritty") {
		attrs = append(attrs, models.MoodAttribute{Label: "Dark Tone", Score: 80})
	} else if strings.Contains(strings.ToLower(p.Tone), "light") || strings.Contains(strings.ToLower(p.Tone), "fun") {
		attrs = append(attrs, models.MoodAttribute{Label: "Feel-Good", Score: 80})
	}

	persona := "The Curious Viewer"
	mood := strings.ToLower(p.Mood)
	if strings.Contains(mood, "thriller") || strings.Contains(mood, "tense") || strings.Contains(mood, "dark") {
		persona = "The Brooding Auteur"
	} else if strings.Contains(mood, "horror") || strings.Contains(mood, "scare") {
		persona = "The Thrill Seeker"
	} else if strings.Contains(mood, "comedy") || strings.Contains(mood, "light") || strings.Contains(mood, "fun") {
		persona = "The Cozy Escapist"
	} else if strings.Contains(mood, "think") || strings.Contains(mood, "intellect") || strings.Contains(mood, "drama") {
		persona = "The Quiet Philosopher"
	} else if strings.Contains(mood, "action") || strings.Contains(mood, "intense") || strings.Contains(mood, "fast") {
		persona = "The Adrenaline Junkie"
	}

	return &models.MoodBreakdownResponse{
		Attributes: attrs,
		Persona:    persona,
	}
}

func parseMoodProfileHeuristic(answers map[string]string) *models.MoodProfile {
	profile := &models.MoodProfile{
		Pace:          "any",
		Tone:          "any",
		Ending:        "any",
		FocusRequired: "any",
		Genres:        []string{},
		Dealbreakers:  []string{},
	}

	getAns := func(shortKey, longKey string) string {
		for k, v := range answers {
			if strings.EqualFold(k, shortKey) || strings.EqualFold(k, longKey) {
				return v
			}
		}
		return ""
	}

	q1 := strings.ToLower(getAns("q1", "How would you describe your week so far?"))
	if strings.Contains(q1, "exhausting") {
		profile.Mood = "Lighthearted entertainment"
		profile.Tone = "light, funny"
		profile.Genres = []string{"Comedy", "Family"}
	} else if strings.Contains(q1, "rollercoaster") {
		profile.Mood = "Tense thriller"
		profile.Tone = "intense, thrilling"
		profile.Genres = []string{"Action", "Thriller"}
	} else if strings.Contains(q1, "productive") {
		profile.Mood = "Thought-provoking drama"
		profile.Tone = "deep, intellectual"
		profile.Genres = []string{"Drama", "Mystery", "Science Fiction"}
	} else if strings.Contains(q1, "chill") {
		profile.Mood = "General entertainment"
		profile.Tone = "entertaining, slow burn"
		profile.Genres = []string{"Drama", "Comedy", "Romance"}
	} else {
		profile.Mood = "General entertainment"
		profile.Tone = "entertaining"
		profile.Genres = []string{"Drama", "Comedy", "Action"}
	}

	q2 := strings.ToLower(getAns("q2", "What kind of energy do you need tonight?"))
	if strings.Contains(q2, "chaos") {
		profile.Pace = "fast"
	} else if strings.Contains(q2, "slow") {
		profile.Pace = "slow"
	} else if strings.Contains(q2, "brain-off") {
		profile.Pace = "any"
	}

	q3 := strings.ToLower(getAns("q3", "How much mental capacity do you have left?"))
	if strings.Contains(q3, "ready to think") {
		profile.FocusRequired = "full"
	} else if strings.Contains(q3, "fried") || strings.Contains(q3, "background") {
		profile.FocusRequired = "background"
	}

	q4 := strings.ToLower(getAns("q4", "How do you want to feel when the credits roll?"))
	if strings.Contains(q4, "uplifted") {
		profile.Ending = "happy"
	} else if strings.Contains(q4, "destroyed") {
		profile.Ending = "sad"
	}

	q5 := strings.ToLower(getAns("q5", "What do we absolutely want to avoid today?"))
	if strings.Contains(q5, "gore") {
		profile.Dealbreakers = append(profile.Dealbreakers, "gore")
	}
	if strings.Contains(q5, "romance") {
		profile.Dealbreakers = append(profile.Dealbreakers, "romance")
	}
	if strings.Contains(q5, "subtitle") {
		profile.Dealbreakers = append(profile.Dealbreakers, "subtitles")
	}

	return profile
}

func heuristicMerge(a, b *models.MoodProfile) (*models.MoodProfile, string) {
	genreSet := map[string]bool{}
	for _, g := range a.Genres {
		genreSet[g] = true
	}
	for _, g := range b.Genres {
		genreSet[g] = true
	}
	genres := []string{}
	for g := range genreSet {
		genres = append(genres, g)
	}

	dbSet := map[string]bool{}
	for _, d := range a.Dealbreakers {
		dbSet[d] = true
	}
	for _, d := range b.Dealbreakers {
		dbSet[d] = true
	}
	dealbreakers := []string{}
	for d := range dbSet {
		dealbreakers = append(dealbreakers, d)
	}

	pace := "any"
	if a.Pace == b.Pace {
		pace = a.Pace
	}

	mergedMood := fmt.Sprintf("A shared %s experience for two", a.Mood)

	return &models.MoodProfile{
		Mood:            mergedMood,
		Pace:            pace,
		Tone:            a.Tone,
		Ending:          "any",
		Violence:        "low",
		FocusRequired:  "any",
		Genres:          genres,
		Dealbreakers:    dealbreakers,
		KeywordsToBoost: append(a.KeywordsToBoost, b.KeywordsToBoost...),
		KeywordsToAvoid: append(a.KeywordsToAvoid, b.KeywordsToAvoid...),
	}, mergedMood
}
