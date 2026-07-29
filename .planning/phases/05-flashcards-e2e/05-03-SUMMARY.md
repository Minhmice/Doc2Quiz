---
phase: 05-flashcards-e2e
plan: 03
subsystem: database
tags: [supabase, flashcards, vitest, fetch]

# Dependency graph
requires:
  - phase: 05-01
    provides: FlashcardGenerateBody Zod schemas and prompt contract
  - phase: 04-03
    provides: Client approved bank CRUD pattern (quiz bank orphan delete)
provides:
  - Supabase-backed getApprovedFlashcardBank / putApprovedFlashcardBankForStudySet
  - postFlashcardGenerate client POST helper for wizard wiring
affects:
  - 05-04 (FlashcardSession, useDashboardHome, source page wiring)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mirror quiz bank CRUD: user_id + study_set_id filter, upsert + orphan delete"
    - "flashcardGenerateStudySet mirrors quizGenerateStudySet fetch/error pattern"

key-files:
  created:
    - src/lib/client/flashcardGenerateStudySet.ts
    - src/lib/client/flashcardGenerateStudySet.test.ts
  modified:
    - src/lib/client/studySetDb.ts
    - src/lib/client/studySetDb.test.ts

key-decisions:
  - "FlashcardVisionItem maps id/front/back only — vision fields (kind, confidence) ignored per D-05"
  - "put preserves existing tags/source from DB rows when editing by id"
  - "No cross-lane delete of approved_questions — client layer mirrors quiz bank scope only"

patterns-established:
  - "approved_flashcards client CRUD parallels approved_questions in studySetDb.ts"

requirements-completed: [FLASH-06, FLASH-07]

# Metrics
duration: 12min
completed: 2026-07-25
---

# Phase 5 Plan 3: Flashcard Client DB Summary

**Supabase-backed approved_flashcards CRUD and postFlashcardGenerate fetch helper replace empty stubs for flashcard UI data paths**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-25T07:04:00Z
- **Completed:** 2026-07-25T07:16:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `getApprovedFlashcardBank` queries `approved_flashcards` with user_id scoping; returns null when empty
- `putApprovedFlashcardBankForStudySet` upserts items, preserves tags/source on edit, deletes orphans
- `postFlashcardGenerate` POSTs wizard body to `/api/study-sets/[id]/flashcards/generate` with typed D-11 response
- 13 unit tests pass (10 studySetDb + 3 flashcardGenerateStudySet)

## Task Commits

Each task was committed atomically:

1. **Task 1: Flashcard bank CRUD** - `c57e237` (test), `bf3e8a5` (feat)
2. **Task 2: postFlashcardGenerate helper** - `f306489` (test), `27e55df` (feat)

## Files Created/Modified
- `src/lib/client/studySetDb.ts` - Replaced stubs with Supabase approved_flashcards CRUD
- `src/lib/client/studySetDb.test.ts` - Flashcard bank get/put tests mirroring quiz bank
- `src/lib/client/flashcardGenerateStudySet.ts` - POST helper with error mapping
- `src/lib/client/flashcardGenerateStudySet.test.ts` - Success, API error, network error tests

## Decisions Made
- Simplified FlashcardVisionItem mapping (id/front/back only) per D-05 — no kind/confidence in client bank
- Tags/source preserved from existing DB rows on upsert; new cards get empty tags and `{}` source
- Did not port legacy cross-lane delete of approved_questions from db/studySetDb.ts — out of 05-03 scope

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - uses existing Supabase auth (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY already required).

## Next Phase Readiness
- FlashcardSession, useDashboardHome, and source page can load real card counts via getApprovedFlashcardBank
- postFlashcardGenerate ready for wizard wiring in 05-04

## Self-Check: PASSED

- FOUND: src/lib/client/studySetDb.ts
- FOUND: src/lib/client/studySetDb.test.ts
- FOUND: src/lib/client/flashcardGenerateStudySet.ts
- FOUND: src/lib/client/flashcardGenerateStudySet.test.ts
- FOUND: c57e237, bf3e8a5, f306489, 27e55df

---
*Phase: 05-flashcards-e2e*
*Completed: 2026-07-25*
