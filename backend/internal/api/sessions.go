package api

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"moodflix/internal/models"
	"moodflix/internal/session"
)

// CreateSessionHandler handles POST /api/sessions
func CreateSessionHandler(manager session.Manager) gin.HandlerFunc {
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

		sessionID, err := manager.StartSession(c.Request.Context(), req.AnswersA)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create session: %v", err)})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"session_id": sessionID})
	}
}

// GetSessionHandler handles GET /api/sessions/:id
func GetSessionHandler(manager session.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if id == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "session ID is required"})
			return
		}

		sess, err := manager.GetSession(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("session not found: %v", err)})
			return
		}

		c.JSON(http.StatusOK, sess)
	}
}

// SubmitSessionBHandler handles POST /api/sessions/:id/submit
func SubmitSessionBHandler(manager session.Manager) gin.HandlerFunc {
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

		resp, err := manager.CompleteSession(c.Request.Context(), id, req.AnswersB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}

// RateSessionHandler handles PATCH /api/sessions/:id/rating
func RateSessionHandler(manager session.Manager) gin.HandlerFunc {
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

		err := manager.RateSession(c.Request.Context(), id, req.Rating, req.UserNotes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to save rating: %v", err)})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "success"})
	}
}
