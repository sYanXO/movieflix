package api

import (
	"fmt"
	"strings"

	"moodflix/internal/models"
)

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

// parseMoodProfileHeuristic maps user answers to a MoodProfile without an LLM.
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

	q1 := strings.ToLower(getAns("q1", "What are you in the mood for?"))
	if strings.Contains(q1, "brain") {
		profile.Mood = "Lighthearted entertainment"
		profile.Tone = "light, funny"
		profile.Genres = []string{"Comedy", "Adventure", "Family"}
	} else if strings.Contains(q1, "intense") {
		profile.Mood = "Tense thriller"
		profile.Tone = "intense, thrilling"
		profile.Genres = []string{"Action", "Thriller", "Crime"}
	} else if strings.Contains(q1, "think") {
		profile.Mood = "Thought-provoking drama"
		profile.Tone = "deep, intellectual"
		profile.Genres = []string{"Drama", "Mystery", "Science Fiction"}
	} else if strings.Contains(q1, "scare") {
		profile.Mood = "Spooky horror"
		profile.Tone = "scary, suspenseful"
		profile.Genres = []string{"Horror", "Thriller"}
	} else {
		profile.Mood = "General entertainment"
		profile.Tone = "entertaining"
		profile.Genres = []string{"Drama", "Comedy", "Action"}
	}

	q2 := strings.ToLower(getAns("q2", "Pace preference?"))
	if strings.Contains(q2, "fast") {
		profile.Pace = "fast"
	} else if strings.Contains(q2, "slow") {
		profile.Pace = "slow"
	}

	q3 := strings.ToLower(getAns("q3", "How much attention can you give?"))
	if strings.Contains(q3, "full") {
		profile.FocusRequired = "full"
	} else if strings.Contains(q3, "half") || strings.Contains(q3, "phone") {
		profile.FocusRequired = "background"
	}

	q4 := strings.ToLower(getAns("q4", "Ending vibes?"))
	if strings.Contains(q4, "happy") {
		profile.Ending = "happy"
	} else if strings.Contains(q4, "sad") || strings.Contains(q4, "dark") {
		profile.Ending = "sad"
	}

	q5 := strings.ToLower(getAns("q5", "Any dealbreakers?"))
	if strings.Contains(q5, "gore") {
		profile.Dealbreakers = append(profile.Dealbreakers, "gore")
	}
	if strings.Contains(q5, "romance") {
		profile.Dealbreakers = append(profile.Dealbreakers, "romance")
	}
	if strings.Contains(q5, "subtitles") {
		profile.Dealbreakers = append(profile.Dealbreakers, "subtitles")
	}

	return profile
}
