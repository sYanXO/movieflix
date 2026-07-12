package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"google.golang.org/genai"
)

func main() {
	_, filename, _, _ := runtime.Caller(0)
	envPath := filepath.Join(filepath.Dir(filename), "../.env")
	_ = godotenv.Load(envPath)

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://moodflix:moodflix@localhost:5433/moodflix"
	}
	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey == "" {
		log.Fatal("GEMINI_API_KEY is required")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	// 1. Fetch recent low-rated sessions (1 or 2 stars)
	rows, err := pool.Query(ctx, `
		SELECT answers, mood_profile, rating, user_notes 
		FROM sessions 
		WHERE rating IN (1, 2) 
		ORDER BY created_at DESC 
		LIMIT 50
	`)
	if err != nil {
		log.Fatalf("fetching low rated sessions: %v", err)
	}
	defer rows.Close()

	var failures []string
	for rows.Next() {
		var answers, moodProfile map[string]interface{}
		var rating int
		var userNotes *string
		if err := rows.Scan(&answers, &moodProfile, &rating, &userNotes); err != nil {
			log.Printf("scan error: %v", err)
			continue
		}

		answersJSON, _ := json.Marshal(answers)
		moodJSON, _ := json.Marshal(moodProfile)
		notes := "None"
		if userNotes != nil {
			notes = *userNotes
		}

		failures = append(failures, fmt.Sprintf(
			"Answers: %s\nGenerated Mood Profile: %s\nRating: %d/5\nUser Feedback: %s\n",
			string(answersJSON), string(moodJSON), rating, notes,
		))
	}

	if len(failures) == 0 {
		log.Println("No low-rated sessions found to evaluate. Exiting.")
		return
	}

	// 2. Fetch the CURRENT active prompt
	var currentPrompt string
	var currentVersion int
	err = pool.QueryRow(ctx, `
		SELECT content, version FROM prompts 
		WHERE name = 'ParseMoodProfile' AND status = 'active'
	`).Scan(&currentPrompt, &currentVersion)
	if err != nil {
		log.Fatalf("fetching active prompt: %v", err)
	}

	// 3. Ask Gemini to evaluate and draft a new prompt
	evaluationPrompt := fmt.Sprintf(`You are an AI Prompt Engineer. Your job is to improve a system prompt that parses user quiz answers into a JSON mood profile for movie recommendations.

We have received low ratings (1-2 stars) for the recommendations generated using the current prompt.

CURRENT PROMPT:
"""
%s
"""

FAILURES (User Answers -> Generated Profile -> Rating & Feedback):
%s

TASK:
1. Analyze why the current prompt failed based on the user feedback.
2. Write an IMPROVED version of the prompt.
3. The new prompt MUST still instruct the LLM to output ONLY valid JSON matching the exact same schema.
4. Output the new prompt wrapped in <new_prompt> tags.`, currentPrompt, strings.Join(failures, "\n---\n"))

	log.Println("Calling Gemini to evaluate failures...")
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  geminiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		log.Fatalf("gemini client: %v", err)
	}

	resp, err := client.Models.GenerateContent(ctx, "gemini-3.1-flash-lite", genai.Text(evaluationPrompt), nil)
	if err != nil {
		log.Fatalf("gemini generate: %v", err)
	}

	var sb strings.Builder
	for _, p := range resp.Candidates[0].Content.Parts {
		sb.WriteString(p.Text)
	}
	output := sb.String()

	// Extract the new prompt
	startIdx := strings.Index(output, "<new_prompt>")
	endIdx := strings.Index(output, "</new_prompt>")
	if startIdx == -1 || endIdx == -1 {
		log.Fatalf("Failed to extract <new_prompt> from response: %s", output)
	}
	
	newPromptContent := strings.TrimSpace(output[startIdx+12 : endIdx])

	// 4. Insert the drafted prompt into the DB
	_, err = pool.Exec(ctx, `
		INSERT INTO prompts (name, content, version, status, notes)
		VALUES ($1, $2, $3, 'draft', $4)
	`, "ParseMoodProfile", newPromptContent, currentVersion+1, "Auto-drafted by Evaluation Agent based on low ratings")

	if err != nil {
		log.Fatalf("saving draft prompt: %v", err)
	}

	log.Printf("Successfully drafted version %d of ParseMoodProfile based on %d failures.", currentVersion+1, len(failures))
}
