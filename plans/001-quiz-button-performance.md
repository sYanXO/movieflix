# 001 — Fix quiz button animation performance

- **Status**: DONE
- **Commit**: 5f5f473
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file, 1 line

## Problem

The quiz option buttons use `transition-all`, which forces the browser to recalculate layout properties (off-GPU) on every interaction, hurting performance when rapidly triggered.

```tsx
/* frontend/app/quiz/page.tsx:613 — current */
                      className={`w-full text-left px-4 py-4 sm:px-6 sm:py-5 rounded-2xl border transition-all duration-300 flex items-center gap-3 sm:gap-4 font-semibold text-base sm:text-lg ${
```

## Target

Replace `transition-all` with explicit transitions for the properties that actually change (`colors` and `box-shadow`).

```tsx
/* target */
                      className={`w-full text-left px-4 py-4 sm:px-6 sm:py-5 rounded-2xl border transition-colors transition-shadow duration-300 flex items-center gap-3 sm:gap-4 font-semibold text-base sm:text-lg ${
```

## Repo conventions to follow

Use standard Tailwind transition classes explicitly targeting changed properties instead of the expensive `transition-all`.

## Steps

1. Open `frontend/app/quiz/page.tsx`.
2. Find the `<motion.button>` mapping for quiz options (around line 613).
3. In its `className` template literal, replace `transition-all duration-300` with `transition-colors transition-shadow duration-300`.

## Boundaries

- Do NOT touch other components.
- Do NOT change the duration.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: Run `npm run build` in the `frontend/` directory to ensure it compiles.
- **Feel check**: Run the UI, take the quiz, and hover/click the options.
  - The colors and shadow should still animate smoothly over 300ms.
  - In DevTools, use the Rendering panel to check for Paint flashing; the bounding box of the button should not trigger layout shifts during the animation.
- **Done when**: The `transition-all` class is removed and the UI feels identical but performs better.
