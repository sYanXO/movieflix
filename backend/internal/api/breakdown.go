package api

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"moodflix/internal/recommendation"
	"moodflix/internal/models"
)

// MoodBreakdownHandler handles POST /api/mood-breakdown
func MoodBreakdownHandler(engine recommendation.RecommendationEngine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.MoodBreakdownRequest
		if err := c.ShouldBindJSON(&req); err != nil || req.MoodProfile == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "mood_profile is required"})
			return
		}

		ctx := c.Request.Context()
		breakdown, err := engine.GetMoodBreakdown(ctx, req.MoodProfile)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("mood breakdown failed: %v", err)})
			return
		}

		c.JSON(http.StatusOK, breakdown)
	}
}
