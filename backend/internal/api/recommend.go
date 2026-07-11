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

// RecommendHandler handles POST /api/recommend
func RecommendHandler(llmClient *llm.Client, pool *pgxpool.Pool) gin.HandlerFunc {
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
		var profile *models.MoodProfile
		var err error
		isRateLimited := false

		// 1. Parse answers into a structured mood profile
		profile, err = llmClient.ParseMoodProfile(ctx, req.Answers)
		if err != nil {
			errMsg := strings.ToLower(err.Error())
			if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
				log.Println("⚠️ Gemini ParseMoodProfile rate-limited (429). Falling back to local heuristic parser...")
				profile = parseMoodProfileHeuristic(req.Answers)
				isRateLimited = true
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("mood parsing failed: %v", err)})
				return
			}
		}

		var candidates []models.Movie
		if isRateLimited {
			// If rate-limited, query matching movies by genres from DB directly
			candidates, err = db.GenreAndRatingSearch(ctx, pool, profile.Genres, 50)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("database fallback query failed: %v", err)})
				return
			}
		} else {
			// 2. Build a text representation of the mood profile for embedding
			profileText := buildProfileText(profile)

			// 3. Embed the mood profile
			embedding, err := llmClient.EmbedText(ctx, profileText)
			if err != nil {
				errMsg := strings.ToLower(err.Error())
				if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "limit") {
					log.Println("⚠️ Gemini EmbedText rate-limited (429). Falling back to database SQL search...")
					candidates, err = db.GenreAndRatingSearch(ctx, pool, profile.Genres, 50)
					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("database fallback query failed: %v", err)})
						return
					}
					isRateLimited = true
				} else {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("embedding failed: %v", err)})
					return
				}
			} else {
				// 4. Vector search → top 50 candidates
				candidates, err = db.VectorSearch(ctx, pool, embedding, 50)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("vector search failed: %v", err)})
					return
				}
			}
		}

		if len(candidates) == 0 {
			c.JSON(http.StatusOK, models.RecommendResponse{
				Recommendations: []models.Movie{},
				MoodProfile:     profile,
			})
			return
		}

		// 5. Filter dealbreakers
		filtered := db.FilterDealbreakers(candidates, profile.Dealbreakers)
		if len(filtered) == 0 {
			filtered = candidates // fallback: don't return empty
		}

		// 6. LLM rerank → top 5 (only if not rate limited)
		var top5 []models.Movie
		if !isRateLimited {
			top5, err = llmClient.ReRank(ctx, profile, filtered)
			if err != nil {
				// Graceful fallback: just return first 5 from vector search
				top5 = filtered
				if len(top5) > 5 {
					top5 = top5[:5]
				}
			}
		} else {
			// If rate limited, shuffle the top 50 candidates and pick 5
			// This avoids repetitiveness while keeping recommendation quality high!
			candidatesToShuffle := filtered
			if len(candidatesToShuffle) > 50 {
				candidatesToShuffle = filtered[:50]
			}
			
			rand.Shuffle(len(candidatesToShuffle), func(i, j int) {
				candidatesToShuffle[i], candidatesToShuffle[j] = candidatesToShuffle[j], candidatesToShuffle[i]
			})

			top5 = candidatesToShuffle
			if len(top5) > 5 {
				top5 = top5[:5]
			}
		}

		c.JSON(http.StatusOK, models.RecommendResponse{
			Recommendations: top5,
			MoodProfile:     profile,
		})
	}
}

// buildProfileText creates an embeddable string representation of the mood profile.
func buildProfileText(p *models.MoodProfile) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Mood: %s. ", p.Mood))
	sb.WriteString(fmt.Sprintf("Pace: %s. ", p.Pace))
	sb.WriteString(fmt.Sprintf("Tone: %s. ", p.Tone))
	sb.WriteString(fmt.Sprintf("Ending: %s. ", p.Ending))
	sb.WriteString(fmt.Sprintf("Focus required: %s. ", p.FocusRequired))
	if len(p.Genres) > 0 {
		sb.WriteString(fmt.Sprintf("Genres: %s. ", strings.Join(p.Genres, ", ")))
	}
	if len(p.KeywordsToBoost) > 0 {
		sb.WriteString(fmt.Sprintf("Keywords: %s.", strings.Join(p.KeywordsToBoost, ", ")))
	}
	return sb.String()
}

// parseMoodProfileHeuristic maps user answers to a MoodProfile without an LLM.
func parseMoodProfileHeuristic(answers map[string]string) *models.MoodProfile {
	profile := &models.MoodProfile{
		Pace:          "any",
		Tone:          "any",
		Ending:        "any",
		FocusRequired: "any",
		Genres:        []string{},
		Dealbreakers:  []string{},
	}

	// Helper to find answer value case-insensitively
	getAns := func(shortKey, longKey string) string {
		for k, v := range answers {
			if strings.EqualFold(k, shortKey) || strings.EqualFold(k, longKey) {
				return v
			}
		}
		return ""
	}

	// Q1: What are you in the mood for?
	q1 := strings.ToLower(getAns("q1", "What are you in the mood for?"))
	if strings.Contains(q1, "brain") {
		profile.Mood = "Lighthearted entertainment"
		profile.Tone = "light, funny"
		profile.Genres = []string{"Comedy", "Adventure", "Family"}
	} else if strings.Contains(q1, "intense") {
		profile.Mood = "Tense thriller"
		profile.Tone = "intense, thrilling"
		profile.Genres = []string{"Action", "Thriller", "Crime"}
	} else if strings.Contains(q1, "think") {
		profile.Mood = "Thought-provoking drama"
		profile.Tone = "deep, intellectual"
		profile.Genres = []string{"Drama", "Mystery", "Science Fiction"}
	} else if strings.Contains(q1, "scare") {
		profile.Mood = "Spooky horror"
		profile.Tone = "scary, suspenseful"
		profile.Genres = []string{"Horror", "Thriller"}
	} else {
		profile.Mood = "General entertainment"
		profile.Tone = "entertaining"
		profile.Genres = []string{"Drama", "Comedy", "Action"}
	}

	// Q2: Pace preference?
	q2 := strings.ToLower(getAns("q2", "Pace preference?"))
	if strings.Contains(q2, "fast") {
		profile.Pace = "fast"
	} else if strings.Contains(q2, "slow") {
		profile.Pace = "slow"
	}

	// Q3: How much attention can you give?
	q3 := strings.ToLower(getAns("q3", "How much attention can you give?"))
	if strings.Contains(q3, "full") {
		profile.FocusRequired = "full"
	} else if strings.Contains(q3, "half") || strings.Contains(q3, "phone") {
		profile.FocusRequired = "background"
	}

	// Q4: Ending vibes?
	q4 := strings.ToLower(getAns("q4", "Ending vibes?"))
	if strings.Contains(q4, "happy") {
		profile.Ending = "happy"
	} else if strings.Contains(q4, "sad") || strings.Contains(q4, "dark") {
		profile.Ending = "sad"
	}

	// Q5: Any dealbreakers?
	q5 := strings.ToLower(getAns("q5", "Any dealbreakers?"))
	if strings.Contains(q5, "gore") {
		profile.Dealbreakers = append(profile.Dealbreakers, "gore")
	}
	if strings.Contains(q5, "romance") {
		profile.Dealbreakers = append(profile.Dealbreakers, "romance")
	}
	if strings.Contains(q5, "subtitles") {
		profile.Dealbreakers = append(profile.Dealbreakers, "subtitles")
	}

	return profile
}
