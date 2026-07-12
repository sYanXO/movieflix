package api

import (
	"io"
	"net/http"
	"strconv"

	"moodflix/internal/poster"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ProxyImageHandler proxies images from TMDB or fallback search via the PosterService.
func ProxyImageHandler(pool *pgxpool.Pool) gin.HandlerFunc {
	// Initialize the poster service (in a real app, this would be injected)
	posterService := poster.NewService(pool)

	return func(c *gin.Context) {
		path := c.Query("path")
		directURL := c.Query("url")
		title := c.Query("title")
		yearStr := c.Query("year")
		dbIDStr := c.Query("db_id")

		var year int
		if yearStr != "" {
			year, _ = strconv.Atoi(yearStr)
		}
		var dbID int
		if dbIDStr != "" {
			dbID, _ = strconv.Atoi(dbIDStr)
		}

		res, err := posterService.GetPosterStream(c.Request.Context(), title, year, path, directURL, dbID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		defer res.Stream.Close()

		c.Header("Content-Type", res.ContentType)
		c.Header("Cache-Control", "public, max-age=86400")
		_, _ = io.Copy(c.Writer, res.Stream)
	}
}
