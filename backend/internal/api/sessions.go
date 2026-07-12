package api

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"moodflix/internal/db"
	"moodflix/internal/models"
	"moodflix/internal/recommendation"
)

// CreateSessionHandler handles POST /api/sessions
func CreateSessionHandler(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CreateSessionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		if len(req.AnswersA) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "answers_a is required"})
			return
		}

		sessionID, err := db.CreateSession(c.Request.Context(), pool, req.AnswersA)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create session: %v", err)})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"session_id": sessionID})
	}
}

// GetSessionHandler handles GET /api/sessions/:id
func GetSessionHandler(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "session ID is required"})
			return
		}

		session, err := db.GetSessionByID(c.Request.Context(), pool, id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("session not found: %v", err)})
			return
		}

		c.JSON(http.StatusOK, session)
	}
}

// SubmitSessionBHandler handles POST /api/sessions/:id/submit using the RecommendationEngine.
func SubmitSessionBHandler(engine recommendation.RecommendationEngine, pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "session ID is required"})
			return
		}

		var req models.SubmitSessionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		if len(req.AnswersB) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "answers_b is required"})
			return
		}

		ctx := c.Request.Context()

		// 1. Retrieve session to get answers_a
		session, err := db.GetSessionByID(ctx, pool, id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("session not found: %v", err)})
			return
		}

		if len(session.AnswersA) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "session is invalid: answers_a is missing"})
			return
		}

		// 2. Delegate to the RecommendationEngine
		resp, err := engine.GetFriendRecommendations(ctx, session.AnswersA, req.AnswersB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// 3. Save results to session in database
		recommendationIDs := make([]int, len(resp.Recommendations))
		for i, m := range resp.Recommendations {
			recommendationIDs[i] = m.ID
		}

		err = db.UpdateSessionB(ctx, pool, id, req.AnswersB, resp.MergedMood, resp.MoodProfile, recommendationIDs)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to save session results: %v", err)})
			return
		}

		resp.SessionID = id
		c.JSON(http.StatusOK, resp)
	}
}

// RateSessionHandler handles PATCH /api/sessions/:id/rating
func RateSessionHandler(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "session ID is required"})
			return
		}

		var req models.RateSessionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		if req.Rating < 1 || req.Rating > 5 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "rating must be between 1 and 5"})
			return
		}

		err := db.UpdateSessionRating(c.Request.Context(), pool, id, req.Rating, req.UserNotes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to save rating: %v", err)})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "success"})
	}
}
