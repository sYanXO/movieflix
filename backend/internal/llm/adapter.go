package llm

import (
	"context"
	"fmt"
	"strings"

	"google.golang.org/genai"
)

// LLMAdapter is a generic, deep interface representing the capability to generate text from a prompt.
type LLMAdapter interface {
	GenerateText(ctx context.Context, prompt string) (string, error)
	EmbedText(ctx context.Context, text string) ([]float32, error)
}

// GeminiAdapter implements LLMAdapter using the Gemini API.
type GeminiAdapter struct {
	inner *genai.Client
}

const flashModel = "gemini-3.1-flash-lite"

// NewGeminiAdapter creates a new GeminiAdapter.
func NewGeminiAdapter(apiKey string) (*GeminiAdapter, error) {
	ctx := context.Background()
	c, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("creating gemini client: %w", err)
	}
	return &GeminiAdapter{inner: c}, nil
}

// GenerateText sends a prompt to Gemini and returns the text response.
func (a *GeminiAdapter) GenerateText(ctx context.Context, prompt string) (string, error) {
	result, err := a.inner.Models.GenerateContent(ctx, flashModel, genai.Text(prompt), nil)
	if err != nil {
		return "", fmt.Errorf("generate content: %w", err)
	}
	if len(result.Candidates) == 0 {
		return "", fmt.Errorf("no candidates returned")
	}
	if result.Candidates[0].Content == nil {
		return "", fmt.Errorf("candidate content is nil (possibly blocked by safety filters)")
	}
	var sb strings.Builder
	for _, part := range result.Candidates[0].Content.Parts {
		sb.WriteString(part.Text)
	}
	return sb.String(), nil
}

const embeddingModel = "gemini-embedding-001"

// EmbedText calls Gemini gemini-embedding-001 and returns a 768-dim float32 slice.
func (a *GeminiAdapter) EmbedText(ctx context.Context, text string) ([]float32, error) {
	config := &genai.EmbedContentConfig{
		OutputDimensionality: genai.Ptr(int32(768)),
	}
	result, err := a.inner.Models.EmbedContent(ctx, embeddingModel,
		genai.Text(text), config)
	if err != nil {
		return nil, fmt.Errorf("embed content: %w", err)
	}
	if result.Embeddings == nil || len(result.Embeddings) == 0 {
		return nil, fmt.Errorf("no embeddings returned")
	}
	return result.Embeddings[0].Values, nil
}
