package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"moodflix/internal/models"
	"moodflix/internal/recommendation"
)

// FriendRecommendHandler handles POST /api/recommend-friends using the RecommendationEngine.
func FriendRecommendHandler(engine recommendation.RecommendationEngine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.FriendRecommendRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		if len(req.AnswersA) == 0 || len(req.AnswersB) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "answers_a and answers_b are both required"})
			return
		}

		ctx := c.Request.Context()
		resp, err := engine.GetFriendRecommendations(ctx, req.AnswersA, req.AnswersB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}
