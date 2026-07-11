package llm

import (
	"context"
	"fmt"

	"google.golang.org/genai"
)

const embeddingModel = "gemini-embedding-001"

// EmbedText calls Gemini gemini-embedding-001 and returns a 768-dim float32 slice.
func (c *Client) EmbedText(ctx context.Context, text string) ([]float32, error) {
	config := &genai.EmbedContentConfig{
		OutputDimensionality: genai.Ptr(int32(768)),
	}
	result, err := c.inner.Models.EmbedContent(ctx, embeddingModel,
		genai.Text(text), config)
	if err != nil {
		return nil, fmt.Errorf("embed content: %w", err)
	}
	if result.Embeddings == nil || len(result.Embeddings) == 0 {
		return nil, fmt.Errorf("no embeddings returned")
	}
	return result.Embeddings[0].Values, nil
}
