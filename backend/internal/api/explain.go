package api

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"moodflix/internal/db"
	"moodflix/internal/recommendation"
	"moodflix/internal/models"
)

// ExplainHandler handles POST /api/explain
func ExplainHandler(engine recommendation.RecommendationEngine, pool *pgxpool.Pool) gin.HandlerFunc {
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
		explanation, err := engine.Explain(ctx, req.MoodProfile, req.UserAnswers, *movie)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("explanation failed: %v", err)})
			return
		}

		c.JSON(http.StatusOK, models.ExplainResponse{Explanation: explanation})
	}
}
