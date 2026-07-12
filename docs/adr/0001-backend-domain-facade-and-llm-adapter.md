# 1. Backend Domain Facade and LLM Adapter Seam

Date: 2026-07-12

## Status
Accepted

## Context
The architectural review highlighted that the backend LLM module (`llm.Client`) was shallow, mixing generic API client logic with domain-specific prompting and parsing. Furthermore, HTTP handlers were acting as thick orchestrators, handling domain logic (such as fallback mechanisms) directly, leading to poor locality. 

## Decision
1. **LLMAdapter Seam:** We will introduce a deep `LLMAdapter` interface representing generic text generation. The concrete Gemini API logic will sit behind this seam.
2. **LLMPrompter Module:** Domain-specific prompts, along with the logic for fetching templates from `PromptManager` and parsing JSON responses, will be moved upward into a dedicated `LLMPrompter` module within the domain layer.
3. **RecommendationEngine as Façade:** The `RecommendationEngine` will serve as the single primary entrypoint (façade) to the domain layer. It will orchestrate all high-level workloads (e.g., GenerateRecommendations, GetMoodBreakdown, ClassifyQuery).
4. **Thin HTTP Adapters:** HTTP handlers will be stripped of orchestration and fallback logic, serving only as thin adapters that parse requests and serialize responses from the `RecommendationEngine`.

## Consequences
* **Improved Leverage:** Swapping out Gemini for another LLM provider only requires writing a new generic `LLMAdapter`.
* **High Locality:** All business rules and prompts reside strictly within the domain layer.
* **Testability:** Core domain logic can be tested in isolation from HTTP concerns, and the LLM dependency can be easily mocked via the `LLMAdapter` seam.
