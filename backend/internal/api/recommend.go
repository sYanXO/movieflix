package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"moodflix/internal/models"
	"moodflix/internal/recommendation"
)

// RecommendHandler handles POST /api/recommend using the RecommendationEngine.
func RecommendHandler(engine recommendation.RecommendationEngine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.RecommendRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		if len(req.Answers) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "answers cannot be empty"})
			return
		}

		ctx := c.Request.Context()
		resp, err := engine.GetRecommendations(ctx, req.Answers)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}
