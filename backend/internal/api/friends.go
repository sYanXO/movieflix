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

// FriendRecommendHandler handles POST /api/recommend-friends
// It parses both sets of answers, merges the mood profiles, then runs vector search + rerank.
func FriendRecommendHandler(llmClient *llm.Client, pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.FriendRecommendRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		if len(req.AnswersA) == 0 || len(req.AnswersB) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "answers_a and answers_b are both required"})
			return
		}

		ctx := c.Request.Context()

		// 1. Parse both sets of answers into mood profiles (with rate-limit fallback)
		profileA, err := llmClient.ParseMoodProfile(ctx, req.AnswersA)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				log.Println("⚠️ Rate-limited on profileA parse, using heuristic")
				profileA = parseMoodProfileHeuristic(req.AnswersA)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("mood parsing (A) failed: %v", err)})
				return
			}
		}

		profileB, err := llmClient.ParseMoodProfile(ctx, req.AnswersB)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				log.Println("⚠️ Rate-limited on profileB parse, using heuristic")
				profileB = parseMoodProfileHeuristic(req.AnswersB)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("mood parsing (B) failed: %v", err)})
				return
			}
		}

		// 2. Merge both profiles via LLM
		mergedProfile, mergedMood, err := llmClient.MergeMoodProfiles(ctx, profileA, profileB)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				log.Println("⚠️ Rate-limited on merge, using heuristic merge")
				mergedProfile, mergedMood = heuristicMerge(profileA, profileB)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("profile merge failed: %v", err)})
				return
			}
		}

		isRateLimited := false
		var candidates []models.Movie

		// 3. Embed merged profile
		profileText := buildProfileText(mergedProfile)
		embedding, err := llmClient.EmbedText(ctx, profileText)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				log.Println("⚠️ Rate-limited on embed, using genre fallback")
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
			// 4. Vector search → top 50
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

		// 5. Filter dealbreakers from both profiles (union)
		allDealbreakers := append(profileA.Dealbreakers, profileB.Dealbreakers...)
		filtered := db.FilterDealbreakers(candidates, allDealbreakers)
		if len(filtered) == 0 {
			filtered = candidates
		}

		// 6. LLM rerank or shuffle fallback
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

		c.JSON(http.StatusOK, models.FriendRecommendResponse{
			Recommendations: top5,
			MoodProfile:     mergedProfile,
			MergedMood:      mergedMood,
		})
	}
}

// heuristicMerge does a simple merge of two profiles without LLM (rate-limit fallback).
func heuristicMerge(a, b *models.MoodProfile) (*models.MoodProfile, string) {
	// Union genres, deduplicated
	genreSet := map[string]bool{}
	for _, g := range a.Genres {
		genreSet[g] = true
	}
	for _, g := range b.Genres {
		genreSet[g] = true
	}
	genres := []string{}
	for g := range genreSet {
		genres = append(genres, g)
	}

	// Union dealbreakers
	dbSet := map[string]bool{}
	for _, d := range a.Dealbreakers {
		dbSet[d] = true
	}
	for _, d := range b.Dealbreakers {
		dbSet[d] = true
	}
	dealbreakers := []string{}
	for d := range dbSet {
		dealbreakers = append(dealbreakers, d)
	}

	// Pace: if both agree use it, otherwise "any"
	pace := "any"
	if a.Pace == b.Pace {
		pace = a.Pace
	}

	mergedMood := fmt.Sprintf("A shared %s experience for two", a.Mood)

	return &models.MoodProfile{
		Mood:          mergedMood,
		Pace:          pace,
		Tone:          a.Tone,
		Ending:        "any",
		Violence:      "low",
		FocusRequired: "any",
		Genres:        genres,
		Dealbreakers:  dealbreakers,
		KeywordsToBoost: append(a.KeywordsToBoost, b.KeywordsToBoost...),
		KeywordsToAvoid: append(a.KeywordsToAvoid, b.KeywordsToAvoid...),
	}, mergedMood
}
