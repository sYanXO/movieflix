package api

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"moodflix/internal/db"
	"moodflix/internal/llm"
	"moodflix/internal/models"
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

// SubmitSessionBHandler handles POST /api/sessions/:id/submit
func SubmitSessionBHandler(llmClient *llm.Client, pool *pgxpool.Pool) gin.HandlerFunc {
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

		// 2. Parse profiles A and B (with rate-limit fallback)
		profileA, err := llmClient.ParseMoodProfile(ctx, session.AnswersA)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				log.Println("⚠️ Rate-limited on profileA parse (session submit), using heuristic")
				profileA = parseMoodProfileHeuristic(session.AnswersA)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("mood parsing (A) failed: %v", err)})
				return
			}
		}

		profileB, err := llmClient.ParseMoodProfile(ctx, req.AnswersB)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				log.Println("⚠️ Rate-limited on profileB parse (session submit), using heuristic")
				profileB = parseMoodProfileHeuristic(req.AnswersB)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("mood parsing (B) failed: %v", err)})
				return
			}
		}

		// 3. Merge profiles
		mergedProfile, mergedMood, err := llmClient.MergeMoodProfiles(ctx, profileA, profileB)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				log.Println("⚠️ Rate-limited on merge (session submit), using heuristic merge")
				mergedProfile, mergedMood = heuristicMerge(profileA, profileB)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("profile merge failed: %v", err)})
				return
			}
		}

		isRateLimited := false
		var candidates []models.Movie

		// 4. Embed merged profile
		profileText := buildProfileText(mergedProfile)
		embedding, err := llmClient.EmbedText(ctx, profileText)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				log.Println("⚠️ Rate-limited on embed (session submit), using genre fallback")
				candidates, err = db.GenreAndRatingSearch(ctx, pool, mergedProfile.Genres, 50)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("database fallback failed: %v", err)})
					return
				}
				isRateLimited = true
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("embedding failed: %v", err)})
				return
			}
		}

		if !isRateLimited {
			// 5. Vector search → top 50
			candidates, err = db.VectorSearch(ctx, pool, embedding, 50)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("vector search failed: %v", err)})
				return
			}
		}

		if len(candidates) == 0 {
			c.JSON(http.StatusOK, models.FriendRecommendResponse{
				Recommendations: []models.Movie{},
				MoodProfile:     mergedProfile,
				MergedMood:      mergedMood,
			})
			return
		}

		// 6. Filter dealbreakers
		allDealbreakers := append(profileA.Dealbreakers, profileB.Dealbreakers...)
		filtered := db.FilterDealbreakers(candidates, allDealbreakers)
		if len(filtered) == 0 {
			filtered = candidates
		}

		// 7. LLM ReRank
		var top5 []models.Movie
		if !isRateLimited {
			top5, err = llmClient.ReRank(ctx, mergedProfile, filtered)
			if err != nil {
				top5 = filtered
				if len(top5) > 5 {
					top5 = top5[:5]
				}
			}
		} else {
			toShuffle := filtered
			if len(toShuffle) > 50 {
				toShuffle = filtered[:50]
			}
			rand.Shuffle(len(toShuffle), func(i, j int) {
				toShuffle[i], toShuffle[j] = toShuffle[j], toShuffle[i]
			})
			top5 = toShuffle
			if len(top5) > 5 {
				top5 = top5[:5]
			}
		}

		// 8. Save results to session in database
		recommendationIDs := make([]int, len(top5))
		for i, m := range top5 {
			recommendationIDs[i] = m.ID
		}

		err = db.UpdateSessionB(ctx, pool, id, req.AnswersB, mergedMood, mergedProfile, recommendationIDs)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to save session results: %v", err)})
			return
		}

		c.JSON(http.StatusOK, models.FriendRecommendResponse{
			Recommendations: top5,
			MoodProfile:     mergedProfile,
			MergedMood:      mergedMood,
		})
	}
}
