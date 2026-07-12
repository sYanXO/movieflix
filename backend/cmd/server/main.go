package main

import (
	"context"
	"log"
	"os"
	"strings"

	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"moodflix/internal/api"
	"moodflix/internal/db"
	"moodflix/internal/llm"
	"moodflix/internal/recommendation"
	"moodflix/internal/session"
)


func main() {
	// Load .env file (ignore error in production where env vars are set directly)
	_ = godotenv.Load()

	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey == "" {
		log.Fatal("GEMINI_API_KEY environment variable is required")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://moodflix:moodflix@localhost:5433/moodflix"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	ctx := context.Background()

	// Init DB pool
	pool, err := db.NewPool(ctx, dbURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()
	log.Println("✅ Connected to PostgreSQL")

	if err := db.RunMigrations(ctx, pool); err != nil {
		log.Fatalf("running migrations: %v", err)
	}
	log.Println("✅ Database migrated successfully")

	// Init Prompt Manager with 5 minute TTL
	promptManager := db.NewPromptManager(pool, 5*time.Minute)

	// Init LLM Adapter and Prompter
	llmAdapter, err := llm.NewGeminiAdapter(geminiKey)
	if err != nil {
		log.Fatalf("creating LLM adapter: %v", err)
	}
	log.Println("✅ Gemini adapter ready")

	basePrompter := recommendation.NewLLMPrompter(llmAdapter, promptManager)
	prompter := recommendation.NewResilientPrompter(basePrompter)

	// Init Recommendation Engine (with cache)
	baseEngine := recommendation.NewEngine(llmAdapter, prompter, pool)
	recEngine := recommendation.NewCachedEngine(baseEngine)

	// Init Session Manager
	sessionManager := session.NewManager(recEngine, pool)

	// Setup Gin router
	r := gin.Default()


	// CORS: allow Next.js dev server and Vercel deployments
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			if origin == "http://localhost:3000" {
				return true
			}
			// Allow any Vercel subdomain
			if strings.HasSuffix(origin, ".vercel.app") && strings.HasPrefix(origin, "https://") {
				return true
			}
			return false
		},
		AllowMethods:     []string{"GET", "POST", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API routes
	apiGroup := r.Group("/api")
	{
		apiGroup.POST("/generate-quiz", api.GenerateQuizHandler(recEngine))
		apiGroup.POST("/recommend", api.RecommendHandler(recEngine, pool))
		apiGroup.POST("/recommend-friends", api.FriendRecommendHandler(recEngine, pool))
		apiGroup.POST("/explain", api.ExplainHandler(recEngine, pool))
		apiGroup.POST("/mood-breakdown", api.MoodBreakdownHandler(recEngine))
		apiGroup.GET("/classify-query", api.ClassifyQueryHandler(recEngine))
		apiGroup.GET("/proxy-image", api.ProxyImageHandler(pool))

		// Shared remote session routes
		apiGroup.POST("/sessions", api.CreateSessionHandler(sessionManager))
		apiGroup.GET("/sessions/:id", api.GetSessionHandler(sessionManager))
		apiGroup.POST("/sessions/:id/submit", api.SubmitSessionBHandler(sessionManager))
		apiGroup.PATCH("/sessions/:id/rating", api.RateSessionHandler(sessionManager))
	}

	log.Printf("🚀 MoodFlix backend running on :%s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
