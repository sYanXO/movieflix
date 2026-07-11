package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"moodflix/internal/db"
	"moodflix/internal/llm"
	"moodflix/internal/models"
)

// ExplainHandler handles POST /api/explain
func ExplainHandler(llmClient *llm.Client, pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ExplainRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		if req.MovieID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "movie_id is required"})
			return
		}

		ctx := c.Request.Context()

		// Fetch movie from DB
		movie, err := db.GetMovieByID(ctx, pool, req.MovieID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("movie not found: %v", err)})
			return
		}

		// Generate explanation
		explanation, err := llmClient.Explain(ctx, req.MoodProfile, req.UserAnswers, *movie)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				// Fallback template-based explanation
				explanation = fmt.Sprintf("Based on your vibe, %q fits the bill perfectly! It matches your requested pace and tone, delivering a great watch that avoids your dealbreakers.", movie.Title)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("explanation failed: %v", err)})
				return
			}
		}

		c.JSON(http.StatusOK, models.ExplainResponse{Explanation: explanation})
	}
}
