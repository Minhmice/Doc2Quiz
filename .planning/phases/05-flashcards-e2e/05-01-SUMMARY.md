---
phase: 05-flashcards-e2e
plan: 01
subsystem: api
tags: [zod, vitest, flashcards, prompt-contract, pipeline]

# Dependency graph
requires:
  - phase: 04-quiz-pipeline
    provides: quizPrompt/quizSchemas pattern for locked JSON + Zod mirror
provides:
  - Locked flashcard_generator_v1.json prompt contract (D-07)
  - flashcardPrompt.ts runtime loader and message assembly
  - flashcardSchemas.ts wizard body + LLM output validation (FLASH-01–04)
affects: [05-02-flashcard-generate, 05-04-wizard-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Locked prompt JSON loaded at runtime via node:fs (mirror quizPrompt)"
    - "Zod schemas for wizard POST body and LLM output before DB insert"

key-files:
  created:
    - prompt/flashcard_generator_v1.json
    - src/lib/pipeline/flashcardPrompt.ts
    - src/lib/pipeline/flashcardSchemas.ts
    - src/lib/pipeline/flashcardPrompt.test.ts
    - src/lib/pipeline/flashcardSchemas.test.ts
  modified: []

key-decisions:
  - "flashcardGeneratorOutputSchema includes concepts[] array matching quiz pattern and RESEARCH output_schema"
  - "section_key on cards uses sec_NNN regex (same as concepts) for stable LLM section IDs"

patterns-established:
  - "flashcardPrompt.ts mirrors quizPrompt.ts: loadFlashcardPrompt, substituteFlashcardInput, buildFlashcardGeneratorMessages"
  - "Wizard body schema uses camelCase (learningGoal, coverage, amount) per D-12 API contract"

requirements-completed: [FLASH-01, FLASH-02, FLASH-03, FLASH-04]

# Metrics
duration: 12min
completed: 2026-07-25
---

# Phase 5 Plan 01: Flashcards Foundation Summary

**Locked flashcard_generator_v1.json with runtime loader and Zod validation for wizard body (memorize/understand/exam_preparation, coverage, amount 5–60) and LLM output (detected_format, cards with front/back)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-25T07:02:00Z
- **Completed:** 2026-07-25T07:14:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `prompt/flashcard_generator_v1.json` with system, tasks, constraints, and output_schema per D-07/D-09
- Implemented `flashcardPrompt.ts` — loads JSON at runtime, assembles system/user messages without hardcoded LLM instructions
- Implemented `flashcardSchemas.ts` — validates FLASH-01–03 wizard payloads and FLASH-04 LLM output shapes
- 20 unit tests passing; typecheck clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Create locked prompt/flashcard_generator_v1.json (D-07)** - `87e87fe` (feat)
2. **Task 2: flashcardPrompt.ts + flashcardSchemas.ts + unit tests** - `0f2cfd7` (test), `d7498b7` (feat)

**Plan metadata:** `8624ed8` (docs: complete plan)

## Files Created/Modified

- `prompt/flashcard_generator_v1.json` - Locked flashcard generation contract with learning_goal, coverage_mode inputs
- `src/lib/pipeline/flashcardPrompt.ts` - Runtime prompt load + message assembly
- `src/lib/pipeline/flashcardSchemas.ts` - Zod mirror of output_schema + route body (D-12)
- `src/lib/pipeline/flashcardPrompt.test.ts` - Loader and message assembly tests
- `src/lib/pipeline/flashcardSchemas.test.ts` - Wizard body and LLM output validation tests

## Decisions Made

- Included `concepts[]` in output schema (matching quiz pattern and RESEARCH) with min(1) validation
- Applied `sec_\d{3}` regex to card `section_key` for consistency with concept section keys

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 2 (`05-02`) can implement `runFlashcardGenerate` using `loadFlashcardPrompt`, `buildFlashcardGeneratorMessages`, and `flashcardGeneratorOutputSchema`
- Wizard UI (`05-04`) can POST bodies validated by `flashcardGenerateBodySchema`

---
*Phase: 05-flashcards-e2e*
*Completed: 2026-07-25*

## Self-Check: PASSED

- FOUND: prompt/flashcard_generator_v1.json
- FOUND: src/lib/pipeline/flashcardPrompt.ts
- FOUND: src/lib/pipeline/flashcardSchemas.ts
- FOUND: src/lib/pipeline/flashcardPrompt.test.ts
- FOUND: src/lib/pipeline/flashcardSchemas.test.ts
- FOUND: commit 87e87fe
- FOUND: commit 0f2cfd7
- FOUND: commit d7498b7
