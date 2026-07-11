package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"moodflix/internal/api"
	"moodflix/internal/db"
	"moodflix/internal/llm"
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

	// Init Gemini LLM client
	llmClient, err := llm.NewClient(geminiKey)
	if err != nil {
		log.Fatalf("creating LLM client: %v", err)
	}
	log.Println("✅ Gemini client ready")

	// Setup Gin router
	r := gin.Default()

	// CORS: allow Next.js dev server
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "https://*.vercel.app"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
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
		apiGroup.POST("/question", api.QuestionHandler(llmClient))
		apiGroup.POST("/recommend", api.RecommendHandler(llmClient, pool))
		apiGroup.POST("/recommend-friends", api.FriendRecommendHandler(llmClient, pool))
		apiGroup.POST("/explain", api.ExplainHandler(llmClient, pool))
		apiGroup.POST("/mood-breakdown", api.MoodBreakdownHandler(llmClient))
		apiGroup.GET("/proxy-image", api.ProxyImageHandler(pool))
	}

	log.Printf("🚀 MoodFlix backend running on :%s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
