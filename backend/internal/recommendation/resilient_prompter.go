package recommendation

import (
	"context"
	"log"
	"math/rand"
	"strings"

	"moodflix/internal/models"
)

type Prompter interface {
	GenerateAdaptiveQuiz(ctx context.Context, starterAnswer string) ([]models.QuestionResponse, error)
	ParseMoodProfile(ctx context.Context, answers map[string]string) (*models.MoodProfile, error)
	ReRank(ctx context.Context, profile *models.MoodProfile, candidates []models.Movie) ([]models.Movie, error)
	Explain(ctx context.Context, profile *models.MoodProfile, answers map[string]string, movie models.Movie) (string, error)
	MoodBreakdown(ctx context.Context, profile *models.MoodProfile) (*models.MoodBreakdownResponse, error)
	MergeMoodProfiles(ctx context.Context, profileA, profileB *models.MoodProfile) (*models.MoodProfile, string, error)
	ClassifyQuery(ctx context.Context, text string) (*models.ClassifyQueryResponse, error)
}

type ResilientPrompter struct {
	inner Prompter
}

func NewResilientPrompter(inner Prompter) *ResilientPrompter {
	return &ResilientPrompter{inner: inner}
}

func isRateLimitErr(err error) bool {
	if err == nil {
		return false
	}
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "429") || strings.Contains(errStr, "quota") || strings.Contains(errStr, "limit")
}

func (r *ResilientPrompter) GenerateAdaptiveQuiz(ctx context.Context, starterAnswer string) ([]models.QuestionResponse, error) {
	resp, err := r.inner.GenerateAdaptiveQuiz(ctx, starterAnswer)
	if isRateLimitErr(err) {
		log.Println("⚠️ Rate-limited on GenerateAdaptiveQuiz. Falling back to static quiz.")
		return getStaticQuizFallback(), nil
	}
	return resp, err
}

func (r *ResilientPrompter) ParseMoodProfile(ctx context.Context, answers map[string]string) (*models.MoodProfile, error) {
	resp, err := r.inner.ParseMoodProfile(ctx, answers)
	if isRateLimitErr(err) {
		log.Println("⚠️ Rate-limited on ParseMoodProfile. Falling back to local heuristic parser...")
		return parseMoodProfileHeuristic(answers), nil
	}
	return resp, err
}

func (r *ResilientPrompter) ReRank(ctx context.Context, profile *models.MoodProfile, candidates []models.Movie) ([]models.Movie, error) {
	resp, err := r.inner.ReRank(ctx, profile, candidates)
	if isRateLimitErr(err) {
		log.Println("⚠️ Rate-limited on ReRank. Falling back to shuffle.")
		toShuffle := make([]models.Movie, len(candidates))
		copy(toShuffle, candidates)
		if len(toShuffle) > 50 {
			toShuffle = toShuffle[:50]
		}
		rand.Shuffle(len(toShuffle), func(i, j int) {
			toShuffle[i], toShuffle[j] = toShuffle[j], toShuffle[i]
		})
		if len(toShuffle) > 5 {
			toShuffle = toShuffle[:5]
		}
		return toShuffle, nil
	}
	return resp, err
}

func (r *ResilientPrompter) Explain(ctx context.Context, profile *models.MoodProfile, answers map[string]string, movie models.Movie) (string, error) {
	resp, err := r.inner.Explain(ctx, profile, answers, movie)
	if isRateLimitErr(err) {
		log.Println("⚠️ Rate-limited on Explain. Using fallback explanation.")
		return "Based on your vibe, \"" + movie.Title + "\" fits the bill perfectly! It matches your requested pace and tone, delivering a great watch that avoids your dealbreakers.", nil
	}
	return resp, err
}

func (r *ResilientPrompter) MoodBreakdown(ctx context.Context, profile *models.MoodProfile) (*models.MoodBreakdownResponse, error) {
	resp, err := r.inner.MoodBreakdown(ctx, profile)
	if isRateLimitErr(err) {
		log.Println("⚠️ Rate-limited on MoodBreakdown. Using heuristic breakdown.")
		return fallbackBreakdown(profile), nil
	}
	return resp, err
}

func (r *ResilientPrompter) MergeMoodProfiles(ctx context.Context, profileA, profileB *models.MoodProfile) (*models.MoodProfile, string, error) {
	prof, mood, err := r.inner.MergeMoodProfiles(ctx, profileA, profileB)
	if isRateLimitErr(err) {
		log.Println("⚠️ Rate-limited on MergeMoodProfiles. Using heuristic merge.")
		p, m := heuristicMerge(profileA, profileB)
		return p, m, nil
	}
	return prof, mood, err
}

func (r *ResilientPrompter) ClassifyQuery(ctx context.Context, text string) (*models.ClassifyQueryResponse, error) {
	// For ClassifyQuery, there isn't a clear fallback other than failing, or using a static coordinate (which the inner already somewhat handles if weight == 0, but if LLM fails, we just fail)
	return r.inner.ClassifyQuery(ctx, text)
}
