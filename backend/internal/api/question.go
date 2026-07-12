package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"moodflix/internal/recommendation"
	"moodflix/internal/models"
)

// GenerateQuizHandler handles POST /api/generate-quiz
func GenerateQuizHandler(engine recommendation.RecommendationEngine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.GenerateQuizRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		// Fast-path: "Surprise me" option triggers recommendations immediately
		if strings.EqualFold(req.StarterAnswer, "Surprise me") {
			c.JSON(http.StatusOK, models.GenerateQuizResponse{
				Questions: []models.QuestionResponse{},
			})
			return
		}

		questions, err := engine.GenerateAdaptiveQuiz(c.Request.Context(), req.StarterAnswer)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, models.GenerateQuizResponse{
			Questions: questions,
		})
	}
}
