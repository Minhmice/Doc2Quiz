---
phase: 05-flashcards-e2e
plan: 02
subsystem: api
tags: [flashcards, pipeline, vitest, openai, supabase]

# Dependency graph
requires:
  - phase: 05-01
    provides: flashcardPrompt, flashcardSchemas, locked flashcard_generator_v1.json
  - phase: 04-02
    provides: quizGenerate pattern, postChatCompletionAssistantText, AI config
provides:
  - runFlashcardGenerate orchestration with canonical-only inputs
  - dedupeAndCapFlashcards + mapFlashcardOutputToRows helpers
  - POST /api/study-sets/[id]/flashcards/generate (replaces 501 stub)
affects: [05-04-wizard-ui, 05-flashcards-e2e-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flashcard generation mirrors quizGenerate: LLM + repair + Zod + replace-all persist"
    - "Cross-mode cleanup deletes approved_questions on flashcard generate"
    - "resolveDominantFormat plurality vote with tie → mixed (D-08)"

key-files:
  created:
    - src/lib/pipeline/dedupeAndCapFlashcards.ts
    - src/lib/pipeline/dedupeAndCapFlashcards.test.ts
    - src/lib/pipeline/mapFlashcardOutputToRows.ts
    - src/lib/pipeline/mapFlashcardOutputToRows.test.ts
    - src/lib/pipeline/flashcardGenerate.ts
    - src/lib/pipeline/flashcardGenerate.test.ts
    - src/app/api/study-sets/[id]/flashcards/generate/route.test.ts
  modified:
    - src/app/api/study-sets/[id]/flashcards/generate/route.ts

key-decisions:
  - "Delete approved_questions on flashcard generate to prevent cross-mode dashboard confusion"
  - "detectedFormat aggregated from final capped cards via resolveDominantFormat, not raw LLM field alone"

patterns-established:
  - "flashcardGenerate.ts mirrors quizGenerate.ts error classes and persist-before-response ordering"
  - "Section coverage filter applied before sections_json template variable (D-03)"

requirements-completed: [FLASH-04, FLASH-05, FLASH-06]

# Metrics
duration: 4min
completed: 2026-07-25
---

# Phase 5 Plan 02: Flashcard Generation Server Summary

**runFlashcardGenerate with canonical-only LLM input, FLASH-04 dedupe/cap, bulk approved_flashcards persist, and operational POST /flashcards/generate returning recommendedCount, generatedCount, detectedFormat, cardIds**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-25T07:04:00Z
- **Completed:** 2026-07-25T07:08:11Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Implemented `dedupeAndCapFlashcards` with `resolveDominantFormat` (max 60 cards, Limited content warning)
- Implemented `mapFlashcardOutputToRows` mapping to `approved_flashcards` insert shape with source jsonb metadata
- Implemented `runFlashcardGenerate` — LLM call with repair retry, section filter, replace-all persist, pipeline_stage flashcards
- Replaced 501 stub on POST `/api/study-sets/[id]/flashcards/generate` with full error mapping and D-11 response
- 29 unit/route tests passing; typecheck clean

## Task Commits

Each task was committed atomically:

1. **Task 1: dedupeAndCapFlashcards + mapFlashcardOutputToRows + tests** - `159fc7b` (test), `e46ee86` (feat)
2. **Task 2: runFlashcardGenerate service** - `acd0a7c` (test), `3919691` (feat)
3. **Task 3: Replace 501 POST route + tests** - `c796823` (test), `3164d7d` (feat)

## Files Created/Modified

- `src/lib/pipeline/dedupeAndCapFlashcards.ts` - FLASH-04 post-processing: dedupe, cap, dominant format
- `src/lib/pipeline/mapFlashcardOutputToRows.ts` - LLM card → approved_flashcards row mapping
- `src/lib/pipeline/flashcardGenerate.ts` - runFlashcardGenerate orchestration (D-06, D-10, D-11)
- `src/app/api/study-sets/[id]/flashcards/generate/route.ts` - Operational POST handler (D-P1-17)
- Test files for dedupe, mapping, service, and route layers

## Decisions Made

- Cross-mode cleanup: delete `approved_questions` when generating flashcards (RESEARCH recommendation)
- `detectedFormat` derived from final capped cards via plurality vote, not LLM `detected_format` alone

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

AI provider env vars required for live generation (same as quiz):

- `AI_PROVIDER_URL` — OpenAI-compatible base URL
- `AI_PROVIDER_KEY` — API key for upstream provider

## Next Phase Readiness

- `05-04` wizard UI can POST bodies validated by `flashcardGenerateBodySchema` to operational endpoint
- `postFlashcardGenerate` client helper (05-03) can call live server route
- Phase verification can exercise full flashcard generate E2E with configured AI

---
*Phase: 05-flashcards-e2e*
*Completed: 2026-07-25*

## Self-Check: PASSED

- FOUND: src/lib/pipeline/dedupeAndCapFlashcards.ts
- FOUND: src/lib/pipeline/mapFlashcardOutputToRows.ts
- FOUND: src/lib/pipeline/flashcardGenerate.ts
- FOUND: src/app/api/study-sets/[id]/flashcards/generate/route.ts
- FOUND: commit 159fc7b
- FOUND: commit e46ee86
- FOUND: commit acd0a7c
- FOUND: commit 3919691
- FOUND: commit c796823
- FOUND: commit 3164d7d
