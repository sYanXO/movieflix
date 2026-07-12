package api

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"moodflix/internal/llm"
)

// ClassifyQueryHandler handles GET /api/classify-query
func ClassifyQueryHandler(llmClient *llm.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		text := c.Query("text")
		if text == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "text query parameter is required"})
			return
		}

		resp, err := llmClient.ClassifyQuery(c.Request.Context(), text)
		if err != nil {
			log.Printf("Error classifying query: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to classify query"})
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}
