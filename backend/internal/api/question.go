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
	hasQ1 := hasAnswer(answers, "q1", "How would you describe your week so far?")
	hasQ2 := hasAnswer(answers, "q2", "What kind of energy do you need tonight?")
	hasQ3 := hasAnswer(answers, "q3", "How much mental capacity do you have left?")
	hasQ4 := hasAnswer(answers, "q4", "How do you want to feel when the credits roll?")
	hasQ5 := hasAnswer(answers, "q5", "What do we absolutely want to avoid today?")

	if !hasQ1 {
		return &models.QuestionResponse{
			Question: "How would you describe your week so far?",
			Options:  []string{"Exhausting", "Rollercoaster", "Chill", "Productive"},
			IsFinal:  false,
		}
	}
	if !hasQ2 {
		return &models.QuestionResponse{
			Question: "What kind of energy do you need tonight?",
			Options:  []string{"Match my chaos", "Slow and steady", "Brain-off comfort"},
			IsFinal:  false,
		}
	}
	if !hasQ3 {
		return &models.QuestionResponse{
			Question: "How much mental capacity do you have left?",
			Options:  []string{"My brain is fried", "Ready to think", "Background noise"},
			IsFinal:  false,
		}
	}
	if !hasQ4 {
		return &models.QuestionResponse{
			Question: "How do you want to feel when the credits roll?",
			Options:  []string{"Uplifted", "Mind-blown", "Emotionally destroyed"},
			IsFinal:  false,
		}
	}
	if !hasQ5 {
		return &models.QuestionResponse{
			Question: "What do we absolutely want to avoid today?",
			Options:  []string{"Gore", "Heavy romance", "Subtitles", "Nope, anything goes"},
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
