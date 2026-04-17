---
phase: 25-skip-rasterization-for-born-digital-pdfs-extract-text-layer-
plan: 02
subsystem: ai
tags: [nextjs, pdfjs, routing, quiz, vision, deterministic-gate]

requires:
  - phase: 25-skip-rasterization-for-born-digital-pdfs-extract-text-layer-
    provides: sampleTextLayerSignal + route policy supports sampled text-layer signal
provides:
  - Quiz routing can run text-first (skip rasterization) when sampled text layer is strong
  - Deterministic quality gate triggers automatic vision fallback with toast + overlay one-liner
  - Parse strategy UI hint clarifies strong-text auto routing behavior
affects: [AiParseSection, parse routing, quiz parsing UX]

tech-stack:
  added: []
  patterns:
    - "Quiz routing uses sampled text-layer signal for pre-route decisions"
    - "Deterministic quality gate (questionCount + validRatio) for auto-fallback to vision"

key-files:
  created: []
  modified:
    - src/components/ai/AiParseSection.tsx
    - src/components/ai/AiParseParseStrategyPanel.tsx

key-decisions:
  - "Keep quiz vision parsing as vision-batch when vision is used; text-first lane only runs when strong sampled text and strategy is not Accurate."
  - "Quality gate defaults: fallback if questionCount < 5 or validRatio < 0.6 (deterministic local checks only)."

patterns-established:
  - "Vision overlay can be prefixed with a single routing/fallback line via handleVisionParse({ overlayPrefixLine })"

requirements-completed: [PDFOPT-02, PDFOPT-03, PDFOPT-04]

duration: 11m
completed: 2026-04-16
---

# Phase 25 Plan 02: Text-first quiz lane + quality-gated vision fallback — Summary

**Quiz parsing now auto-routes to a text-first sequential chunk lane when the sampled text layer is strong, and automatically falls back to vision when deterministic output quality is weak.**

## Performance

- **Duration:** 11m
- **Started:** 2026-04-16T06:45:00Z
- **Completed:** 2026-04-16T06:55:37Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Quiz parses can skip rasterization entirely when the text layer is strong (and strategy is not Accurate)
- Weak text-first outputs automatically re-run via vision with short toast + overlay messaging (reason codes + numeric gate metrics only)
- Parse Strategy panel communicates the strong-text auto behavior without adding new controls

## Task Commits

1. **Task 1: Add a quiz text-first lane that skips rasterization when text is strong** — `7bed767`
2. **Task 2: Add deterministic quality gate + automatic vision fallback with toast** — `6d172ce`
3. **Task 3: Update Parse Strategy UI hint copy for strong text routing** — `0e3d9cc`

## Files Modified

- `src/components/ai/AiParseSection.tsx`
  - Samples text-layer signal before routing for quiz
  - Runs text-first sequential parsing when strong-text + non-Accurate
  - Applies deterministic quality gate and auto-falls back to vision (toast + overlay prefix line)
- `src/components/ai/AiParseParseStrategyPanel.tsx`
  - Updates `strong_text_layer` hint to mention text-first auto routing + skipping page images for quiz

## Decisions Made

- Kept **Accurate = vision-first** semantics; text-first routing applies only when strategy is not Accurate.
- Used a **deterministic** quality gate (no external calls) with explicit numeric logging for fallback decisions.

## Deviations from Plan

None — plan executed as written.

## Issues Encountered

- Next.js type-check flagged a narrowed `parseOutputMode === "quiz"` branch when quiz was temporarily removed from `batchOnlyVisionParse`; resolved by keeping quiz vision parsing batch-only when vision is used.
- `pipelineLog` domain typing rejected `"TEXT"`; used existing `"VISION"` domain for text-lane gating/error logs.

## User Setup Required

None.

## Known Stubs

None found.

## Self-Check: PASSED

- Summary exists at `.planning/phases/25-skip-rasterization-for-born-digital-pdfs-extract-text-layer-/25-02-SUMMARY.md`
- Task commits exist: `7bed767`, `6d172ce`, `0e3d9cc`

