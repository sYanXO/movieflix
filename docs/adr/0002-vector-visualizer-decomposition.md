# 2. Vector Visualizer Decomposition

Date: 2026-07-12

## Status
Accepted

## Context
The `VectorSpaceVisualizer` frontend component had grown into a massive monolith (>1100 lines) with zero seams. It mixed static data, mathematical physics for vectors, interaction state (pan/zoom), and React canvas rendering into a single `useEffect` loop, leading to poor locality and testability.

## Decision
1. **Module Decomposition:** We will decompose the monolith into specialized deep modules:
    * **Static Data Module:** Extracts predefined data points like `MOVIES_DATA` and `CLUSTERS`.
    * **Math/Physics Engine:** A pure module handling vector projection, coordinate normalization, and similarity scoring.
    * **Interaction Hook:** A `useVectorCamera` hook to encapsulate pan, zoom, dragging, and hover states.
2. **Dedicated Directory:** All specialized modules will reside together inside `frontend/components/vector-visualizer/` to ensure physical locality.
3. **Pure Math Engine:** The Math Engine will remain completely pure. The async API fetch to `/api/classify-query` will happen within the UI Orchestrator, which then passes the raw resulting coordinates to the Math Engine for pure geometric calculations.

## Consequences
* **Locality:** Code related to physics is strictly separated from React rendering logic.
* **Testability:** The pure math/physics functions can be unit-tested seamlessly without spinning up a headless canvas.
* **Separation of Concerns:** The main visualizer acts merely as an orchestrator and UI rendering shell.
