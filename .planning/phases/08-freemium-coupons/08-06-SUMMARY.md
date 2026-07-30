---
phase: 08-freemium-coupons
plan: "06"
subsystem: api
tags: [quota, reservations, quiz, flashcards, vitest]
requires:
  - phase: 08-05
    provides: typed reserve/commit/release adapter and retired direct quota writes
provides:
  - reservation lifecycle in quiz and flashcard generate routes
  - deterministic route tests for reserve/commit/release ordering
affects: [phase-08-verification, concurrent-quota-enforcement]
tech-stack:
  added: []
  patterns: [reserve-before-pipeline, commit-on-success, release-on-failure, quotaCommitted guard]
key-files:
  created: []
  modified:
    - src/app/api/study-sets/[id]/quiz/generate/route.ts
    - src/app/api/study-sets/[id]/quiz/generate/route.test.ts
    - src/app/api/study-sets/[id]/flashcards/generate/route.ts
    - src/app/api/study-sets/[id]/flashcards/generate/route.test.ts
key-decisions:
  - "Quiz and flashcard routes reserve quota after auth/ownership/body validation and before pipeline execution."
  - "Active duplicate work maps to HTTP 409 { error: generation_in_progress }; quota exhaustion keeps existing 402 DTO."
  - "Commit failure after successful pipeline returns 500 internal_error; release failure logs reservation context and returns 500."
patterns-established:
  - "quotaCommitted guard prevents release after successful commit; tokenless already_committed regeneration skips commit and release."
requirements-completed: [PLAN-01, PLAN-02, PLAN-04, PLAN-05, PLAN-07]
duration: 12min
completed: 2026-07-30
---

# Phase 08 Plan 06: Route Reservation Lifecycle Summary

**Quiz and flashcard generate APIs now reserve quota atomically before AI work, commit only after successful persistence, and release on every failure path.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-30T05:48:00+07:00
- **Completed:** 2026-07-30T06:00:00+07:00
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Replaced split assert/record quota calls with reserve → generate → commit lifecycle in both generate routes.
- Preserved free regeneration via tokenless `already_committed` path and structured HTTP 402 `quota_exceeded` payload.
- Added deterministic route tests covering ordering, 409 conflict, failure release, and commit/release error branches.

## Task Commits

1. **Task 1: Add reservation lifecycle route tests before route refactor** — `43cead7` (test)
2. **Task 2: Refactor quiz and flashcard routes around reservation lifecycle** — `49b71fc` (feat)

## Files Created/Modified

- `src/app/api/study-sets/[id]/quiz/generate/route.ts` — reserve/commit/release around `runQuizGenerate`.
- `src/app/api/study-sets/[id]/quiz/generate/route.test.ts` — lifecycle mocks and invocation-order assertions.
- `src/app/api/study-sets/[id]/flashcards/generate/route.ts` — same lifecycle for flashcards.
- `src/app/api/study-sets/[id]/flashcards/generate/route.test.ts` — parallel flashcard lifecycle coverage.

## Decisions Made

- `generation_in_progress` returns HTTP 409 with `{ error: "generation_in_progress" }` before any pipeline work.
- Commit failure after successful pipeline returns 500 without a false 200; release is not attempted on commit failure per test contract.
- Release failure logs `{ reservationToken, releaseError, originalError }` and returns 500.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 8 gap closure for concurrent quota enforcement is wired at the route layer; re-run phase verification and optional `quota_reservation_concurrency.sql` against migrated Supabase for end-to-end proof.
- `assertGenerationQuota` remains for other callers (e.g. quiz preflight); generate routes no longer use it.

## Self-Check: PASSED

- FOUND: src/app/api/study-sets/[id]/quiz/generate/route.ts
- FOUND: src/app/api/study-sets/[id]/flashcards/generate/route.ts
- FOUND: .planning/phases/08-freemium-coupons/08-06-SUMMARY.md
- FOUND: 43cead7
- FOUND: 49b71fc

---
*Phase: 08-freemium-coupons*
*Completed: 2026-07-30*
