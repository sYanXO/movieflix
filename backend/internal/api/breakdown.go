package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"moodflix/internal/llm"
	"moodflix/internal/models"
)

// MoodBreakdownHandler handles POST /api/mood-breakdown
func MoodBreakdownHandler(llmClient *llm.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.MoodBreakdownRequest
		if err := c.ShouldBindJSON(&req); err != nil || req.MoodProfile == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "mood_profile is required"})
			return
		}

		ctx := c.Request.Context()
		breakdown, err := llmClient.MoodBreakdown(ctx, req.MoodProfile)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				// Fallback: derive attributes directly from profile fields
				breakdown = fallbackBreakdown(req.MoodProfile)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("mood breakdown failed: %v", err)})
				return
			}
		}

		c.JSON(http.StatusOK, breakdown)
	}
}

// fallbackBreakdown builds a basic breakdown without LLM when rate-limited.
func fallbackBreakdown(p *models.MoodProfile) *models.MoodBreakdownResponse {
	attrs := []models.MoodAttribute{}

	// Genres → direct scores
	for i, g := range p.Genres {
		score := 90 - i*10
		if score < 50 {
			score = 50
		}
		attrs = append(attrs, models.MoodAttribute{Label: g, Score: score})
	}

	// Pace
	if p.Pace == "fast" {
		attrs = append(attrs, models.MoodAttribute{Label: "Fast Paced", Score: 85})
	} else if p.Pace == "slow" {
		attrs = append(attrs, models.MoodAttribute{Label: "Slow Burn", Score: 85})
	}

	// Tone
	if strings.Contains(strings.ToLower(p.Tone), "dark") || strings.Contains(strings.ToLower(p.Tone), "gritty") {
		attrs = append(attrs, models.MoodAttribute{Label: "Dark Tone", Score: 80})
	} else if strings.Contains(strings.ToLower(p.Tone), "light") || strings.Contains(strings.ToLower(p.Tone), "fun") {
		attrs = append(attrs, models.MoodAttribute{Label: "Feel-Good", Score: 80})
	}

	// Persona heuristic
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
