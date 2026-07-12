# MoodFlix Domain Glossary

This file documents the core concepts and design decisions of the MoodFlix domain model.

## Core Concepts

### RecommendationEngine (Module)
The **RecommendationEngine** is a deep module that acts as the single primary entrypoint (façade) to the domain layer. It encapsulates the recommendation lifecycle, mood profile parsing, vector classifications, and mood breakdowns.
* **Depth:** It provides a simple, clean interface that orchestrates business rules and hides the complexity of network parallelism, rate-limiting, and caching.
* **Locality:** Consolidates all semantic search and matching logic in a single boundary rather than spreading it across HTTP router handlers.
* **Seam:** Defined as an interface to act as a test surface, allowing the engine to be fully mocked for HTTP route unit tests.

### MoodProfile (Concept)
A structured representation of a user's cinematic preferences generated from their answers. It includes the desired mood, pacing, tone, ending type, genres to match, and dealbreakers (like gore, romance, or subtitles) to exclude. **Note on Dealbreakers:** The rules determining whether a question is a dealbreaker (multi-select) belong strictly to the backend `LLMPrompter`, passed to the frontend via an explicit API contract, completely removing brittle heuristic logic from the frontend.

### VectorSearch (Concept)
The process of matching the user's semantic mood profile embedding against pre-computed movie description embeddings in PostgreSQL using the pgvector cosine similarity operator.

### In-Memory Cache (Leverage)
An optimization wrapper around the `RecommendationEngine` that caches recommendations. Since the single-user quiz has a discrete state space of only 240 unique paths, caching provides near-instant response times (<1ms) and zero API costs for recurring queries.

### LLMAdapter (Seam)
A generic, deep interface representing the capability to generate text from a prompt. This acts as a clear seam to isolate the business logic from specific LLM providers (e.g., Gemini vs OpenAI).

### LLMPrompter (Module)
A domain module responsible for fetching prompt templates (via `PromptManager`), formatting strings with domain context, calling the `LLMAdapter`, and parsing the raw JSON response back into strongly-typed domain models. Provides high locality for prompt engineering.

### QuizEngine (Module)
A pure state machine reducer that manages the frontend quiz progression, multi-user handoffs, and remote session waiting logic. By exposing an explicit `status` state, it acts as a deep seam between the pure transition rules of the quiz and the side-effect-heavy UI rendering and networking logic.

### SessionRepository (Module)
A deep frontend data layer that abstracts network requests (`fetch`) and browser persistence (`sessionStorage`). It exposes high-level operations for syncing quiz state, finalizing results, and polling remote sessions, completely isolating the UI components from storage semantics and providing graceful in-memory fallbacks when browser storage is blocked.
