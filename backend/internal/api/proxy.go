package api

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// getVQDToken gets a VQD search token from DuckDuckGo for the search query.
func getVQDToken(query string) (string, error) {
	escapedQuery := url.QueryEscape(query)
	req, err := http.NewRequest("GET", "https://duckduckgo.com/?q="+escapedQuery, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	body := string(bodyBytes)

	re1 := regexp.MustCompile(`vqd=([^&'"]+)`)
	re2 := regexp.MustCompile(`vqd\s*:\s*['"]([^'"]+)['"]`)
	re3 := regexp.MustCompile(`vqd\s*=\s*['"]([^'"]+)['"]`)

	if m := re1.FindStringSubmatch(body); len(m) > 1 {
		return m[1], nil
	}
	if m := re2.FindStringSubmatch(body); len(m) > 1 {
		return m[1], nil
	}
	if m := re3.FindStringSubmatch(body); len(m) > 1 {
		return m[1], nil
	}

	return "", fmt.Errorf("VQD token not found in response")
}

// searchDDGPosters searches DuckDuckGo for a movie poster and returns up to 3 image URLs.
func searchDDGPosters(title string, year int) ([]string, error) {
	query := fmt.Sprintf("%s %d movie poster", title, year)
	if year == 0 {
		query = fmt.Sprintf("%s movie poster", title)
	}

	vqd, err := getVQDToken(query)
	if err != nil {
		return nil, fmt.Errorf("getting vqd token: %w", err)
	}

	escapedQuery := url.QueryEscape(query)
	imgURL := fmt.Sprintf("https://duckduckgo.com/i.js?q=%s&vqd=%s&o=json&s=0", escapedQuery, vqd)
	reqImg, err := http.NewRequest("GET", imgURL, nil)
	if err != nil {
		return nil, err
	}
	reqImg.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	reqImg.Header.Set("Referer", "https://duckduckgo.com/")

	client := &http.Client{Timeout: 5 * time.Second}
	respImg, err := client.Do(reqImg)
	if err != nil {
		return nil, err
	}
	defer respImg.Body.Close()

	imgBodyBytes, err := io.ReadAll(respImg.Body)
	if err != nil {
		return nil, err
	}
	imgBody := string(imgBodyBytes)

	reImage := regexp.MustCompile(`"image"\s*:\s*"([^"]+)"`)
	matches := reImage.FindAllStringSubmatch(imgBody, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("no images found in results")
	}

	var urls []string
	for i, match := range matches {
		if i >= 3 { // Get first 3 image candidates
			break
		}
		urls = append(urls, match[1])
	}
	return urls, nil
}

// ProxyImageHandler proxies images from TMDB or fallback search.
func ProxyImageHandler(pool *pgxpool.Pool) gin.HandlerFunc {
	client := &http.Client{Timeout: 8 * time.Second}

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

		// Helper function to fetch and stream an image from a direct URL
		streamImage := func(targetURL string) bool {
			req, err := http.NewRequest("GET", targetURL, nil)
			if err != nil {
				return false
			}
			// Set a friendly user agent
			req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

			resp, err := client.Do(req)
			if err != nil || resp.StatusCode != http.StatusOK {
				if resp != nil {
					resp.Body.Close()
				}
				return false
			}
			defer resp.Body.Close()

			c.Header("Content-Type", resp.Header.Get("Content-Type"))
			c.Header("Cache-Control", "public, max-age=86400")
			_, _ = io.Copy(c.Writer, resp.Body)
			return true
		}

		// 1. Try directURL if provided (already verified cached poster path)
		if directURL != "" {
			if streamImage(directURL) {
				return
			}
		}

		// 2. Try TMDB path if provided
		if path != "" {
			// Sanitize path (must start with / and not contain parent directories)
			if strings.HasPrefix(path, "/") && !strings.Contains(path, "..") {
				tmdbURL := "https://image.tmdb.org/t/p/w500" + path
				if streamImage(tmdbURL) {
					return
				}
			}
		}

		// 3. Fallback to DuckDuckGo search if title is provided
		if title != "" {
			log.Printf("🔍 TMDB poster failed or missing for %q. Falling back to DuckDuckGo search...", title)
			imgURLs, err := searchDDGPosters(title, year)
			if err == nil {
				for _, imgURL := range imgURLs {
					log.Printf("   -> Trying poster candidate: %s", imgURL)
					if streamImage(imgURL) {
						// Success! Cache it in the database for future requests
						if dbID > 0 && pool != nil {
							go func(id int, newURL string) {
								ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
								defer cancel()
								_, dbErr := pool.Exec(ctx, "UPDATE movies SET poster_url = $1 WHERE id = $2", newURL, id)
								if dbErr != nil {
									log.Printf("⚠️ Failed to update cached poster_url in database: %v", dbErr)
								} else {
									log.Printf("💾 Successfully updated cached poster_url in DB for movie ID %d", id)
								}
							}(dbID, imgURL)
						}
						return
					}
				}
			} else {
				log.Printf("⚠️ DuckDuckGo image search failed for %q: %v", title, err)
			}
		}

		// 4. Default fallback (return 404 so UI fallback runs)
		c.JSON(http.StatusNotFound, gin.H{"error": "movie poster not found"})
	}
}
