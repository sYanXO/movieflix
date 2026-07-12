package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"moodflix/internal/db"
	"moodflix/internal/models"
	"moodflix/internal/recommendation"
)

// RecommendHandler handles POST /api/recommend using the RecommendationEngine.
func RecommendHandler(engine recommendation.RecommendationEngine, pool *pgxpool.Pool) gin.HandlerFunc {
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

		// Save session to database
		recIDs := make([]int, len(resp.Recommendations))
		for i, m := range resp.Recommendations {
			recIDs[i] = m.ID
		}
		
		sessionID, err := db.CreateRecommendationSession(ctx, pool, req.Answers, resp.MoodProfile, recIDs)
		if err != nil {
			// Log error but don't fail the request
			c.Error(err)
		} else {
			resp.SessionID = sessionID
		}

		c.JSON(http.StatusOK, resp)
	}
}
