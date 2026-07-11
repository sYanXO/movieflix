# MoodFlix Domain Glossary

This file documents the core concepts and design decisions of the MoodFlix domain model.

## Core Concepts

### RecommendationEngine (Module)
The **RecommendationEngine** is a deep module that encapsulates the recommendation lifecycle: parsing user preferences, embedding search vectors, retrieving candidates via pgvector similarity matching, filtering dealbreakers, and reranking movies. 
* **Depth:** It provides a simple, clean interface that hides the complexity of network parallelism, rate-limiting, and caching.
* **Locality:** Consolidates all semantic search and matching logic in a single boundary rather than spreading it across HTTP router handlers.
* **Seam:** Defined as an interface to act as a test surface, allowing the engine to be fully mocked for HTTP route unit tests.

### MoodProfile (Concept)
A structured representation of a user's cinematic preferences generated from their answers. It includes the desired mood, pacing, tone, ending type, genres to match, and dealbreakers (like gore, romance, or subtitles) to exclude.

### VectorSearch (Concept)
The process of matching the user's semantic mood profile embedding against pre-computed movie description embeddings in PostgreSQL using the pgvector cosine similarity operator.

### In-Memory Cache (Leverage)
An optimization wrapper around the `RecommendationEngine` that caches recommendations. Since the single-user quiz has a discrete state space of only 240 unique paths, caching provides near-instant response times (<1ms) and zero API costs for recurring queries.
