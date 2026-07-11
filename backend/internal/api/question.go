package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"moodflix/internal/llm"
	"moodflix/internal/models"
)

// QuestionHandler handles POST /api/question
func QuestionHandler(llmClient *llm.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.QuestionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		if req.Answers == nil {
			req.Answers = map[string]string{}
		}

		// Fast-path: "Surprise me" option triggers recommendations immediately
		for _, v := range req.Answers {
			if strings.EqualFold(v, "Surprise me") {
				c.JSON(http.StatusOK, models.QuestionResponse{
					IsFinal: true,
				})
				return
			}
		}

		resp, err := llmClient.NextQuestion(c.Request.Context(), req.Answers)
		if err != nil {
			// Check if rate limited / quota exceeded
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				// Fallback to local heuristic questionnaire sequence
				resp = getNextQuestionHeuristic(req.Answers)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		c.JSON(http.StatusOK, resp)
	}
}

func getNextQuestionHeuristic(answers map[string]string) *models.QuestionResponse {
	hasQ1 := hasAnswer(answers, "q1", "What are you in the mood for?")
	hasQ2 := hasAnswer(answers, "q2", "Pace preference?")
	hasQ3 := hasAnswer(answers, "q3", "How much attention can you give?")
	hasQ4 := hasAnswer(answers, "q4", "Ending vibes?")
	hasQ5 := hasAnswer(answers, "q5", "Any dealbreakers?")

	if !hasQ1 {
		return &models.QuestionResponse{
			Question: "What are you in the mood for?",
			Options:  []string{"Turn my brain off", "Something intense", "Make me think", "Scare me", "Surprise me"},
			IsFinal:  false,
		}
	}
	if !hasQ2 {
		return &models.QuestionResponse{
			Question: "Pace preference?",
			Options:  []string{"Fast paced", "Slow burn"},
			IsFinal:  false,
		}
	}
	if !hasQ3 {
		return &models.QuestionResponse{
			Question: "How much attention can you give?",
			Options:  []string{"Full focus", "Half-watching on my phone"},
			IsFinal:  false,
		}
	}
	if !hasQ4 {
		return &models.QuestionResponse{
			Question: "Ending vibes?",
			Options:  []string{"Happy", "Sad / dark", "Doesn't matter"},
			IsFinal:  false,
		}
	}
	if !hasQ5 {
		return &models.QuestionResponse{
			Question: "Any dealbreakers?",
			Options:  []string{"Gore", "Romance", "Subtitles", "Nope, anything goes"},
			IsFinal:  false,
		}
	}

	return &models.QuestionResponse{
		IsFinal: true,
	}
}

func hasAnswer(answers map[string]string, shortKey, longKey string) bool {
	for k := range answers {
		if strings.EqualFold(k, shortKey) || strings.EqualFold(k, longKey) {
			return true
		}
	}
	return false
}
