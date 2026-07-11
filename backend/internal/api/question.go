package api

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"moodflix/internal/llm"
	"moodflix/internal/models"
)

// GenerateQuizHandler handles POST /api/generate-quiz
func GenerateQuizHandler(llmClient *llm.Client) gin.HandlerFunc {
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

		questions, err := llmClient.GenerateAdaptiveQuiz(c.Request.Context(), req.StarterAnswer)
		if err != nil {
			// Check if rate limited / quota exceeded
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				log.Println("⚠️ Rate-limited on GenerateAdaptiveQuiz. Falling back to static quiz.")
				questions = getStaticQuizFallback()
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		c.JSON(http.StatusOK, models.GenerateQuizResponse{
			Questions: questions,
		})
	}
}

// getStaticQuizFallback returns the static remaining questions if the LLM rate limits.
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
			Question: "What do we absolutely want to avoid today?",
			Options:  []string{"Gore", "Heavy romance", "Subtitles", "Nope, anything goes"},
			IsFinal:  false,
		},
	}
}
