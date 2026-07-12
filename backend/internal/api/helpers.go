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

