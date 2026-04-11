---
phase: 07-layout-aware-chunk-based-parsing-token-optimized
plan: "01"
subsystem: ai
tags: [ocr, layout-chunk, mcq, prompts, token-hygiene]

requires:
  - phase: "07"
    provides: CONTEXT and research for chunk parse
provides:
  - Normalized chunk text assembly for model calls
  - Flat single-MCQ JSON prompt + parser normalization
  - parseChunkSingleMcqOnce without inner wall-clock timing (D-27)
affects:
  - runLayoutChunkParse
  - AiParseSection

tech-stack:
  added: []
  patterns:
    - "normalizeChunkTextForModel + flat JSON adapter for single-chunk MCQ"

key-files:
  created: []
  modified:
    - src/lib/ai/layoutChunksFromOcr.ts
    - src/lib/ai/prompts/mcq-extraction.prompts.json
    - src/lib/ai/parseChunk.ts

key-decisions:
  - "Single-chunk model output is a flat object; legacy { questions: [] } still accepted in parser."

patterns-established:
  - "Wall-clock for chunk AI stays out of parseChunkSingleMcqOnce (D-27)."

requirements-completed: [AI-02, AI-03, AI-04]

duration: "~30 min"
completed: "2026-04-11"
---

# Phase 07 Plan 01: Layout chunk library (token hygiene + single MCQ) Summary

**OCR layout chunks now normalize text before prompts, use a flat single-MCQ JSON contract, and parse through a timing-neutral `parseChunkSingleMcqOnce` with a D-27 ownership comment.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `normalizeChunkTextForModel` and applied it when building and expanding chunk text.
- Replaced `mcqSingleChunk` prompt with keys `question` / `options` / `correctIndex` only; adapter wraps flat objects for `validateQuestionsFromJson`.
- Extended OpenAI/Anthropic helpers with pluggable `extractQuestions` and wired `singleMcqQuestionsFromAssistantContent` for all three providers.

## Task Commits

1. **Task 1: Layout chunk engine audit** — `f9fd445` (feat)
2. **Task 2: Single-chunk MCQ prompt contract** — `fcc0fbb` (feat)
3. **Task 3: parseChunkSingleMcqOnce** — `41361fa` (feat)

## Files Created/Modified

- `src/lib/ai/layoutChunksFromOcr.ts` — Token hygiene helper, `makeChunk` / `expandChunkText`, bbox hint comment.
- `src/lib/ai/prompts/mcq-extraction.prompts.json` — `mcqSingleChunk.system` flat JSON instructions.
- `src/lib/ai/parseChunk.ts` — Normalization helper, D-27 comment (no `performance.now` substring in file), provider branches.

## Deviations from Plan

None — plan executed as written.

## Threat Flags

None added beyond mitigated T-07-01-1 (no full chunk logging in production paths).

## Self-Check: PASSED

- `07-01-SUMMARY.md` present at `.planning/phases/07-layout-aware-chunk-based-parsing-token-optimized/07-01-SUMMARY.md`
- Commits `f9fd445`, `fcc0fbb`, `41361fa` on `main`
