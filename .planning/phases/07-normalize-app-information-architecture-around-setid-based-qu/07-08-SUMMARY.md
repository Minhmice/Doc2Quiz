---
phase: 07-normalize-app-information-architecture-around-setid-based-qu
plan: 08
subsystem: routing
 tags: [nextjs, routing, audits, migration, vitest]
requires:
  - phase: 07-07
    provides: canonical singular flashcard routes and session destinations
provides:
  - Migrated live route callers, prefetch configuration, command palette, guards, and redirects to canonical helpers
  - Deterministic pre-deletion caller audit with zero forbidden references
  - Post-deletion full-reference audit script for Plan 07-09
 affects: [07-09, routing, dashboard, create, quiz, flashcards]
tech-stack:
  added: []
  patterns: [sorted dependency-free Node route audits, exact deferred legacy-root allowlist]
key-files:
  created:
    - scripts/audit-phase7-route-callers.mjs
    - scripts/audit-phase7-route-references.mjs
    - .planning/phases/07-normalize-app-information-architecture-around-setid-based-qu/07-08-SUMMARY.md
  modified:
    - next.config.ts
    - package.json
    - src/components/layout/RoutePrefetch.tsx
    - src/components/layout/CommandPalette.tsx
    - src/lib/routing/studySetContentKindRedirects.ts
    - src/lib/routes/studySetPaths.ts
    - src/components/dashboard/DashboardHomeClient.tsx
    - src/components/dashboard/DashboardLibraryClient.tsx
    - src/components/dashboard/DashboardStudySetCard.tsx
    - src/components/flashcards/review/FlashcardReviewWorkspace.tsx
    - src/components/quiz/QuizSession.tsx
    - src/components/review/ReviewSection.tsx
    - src/app/(app)/edit/new/page.tsx
    - src/app/(app)/edit/new/quiz/page.tsx
    - src/app/(app)/edit/new/flashcards/page.tsx
    - src/app/(app)/sets/new/page.tsx
    - src/app/(app)/sets/new/quiz/page.tsx
    - src/app/(app)/sets/new/flashcards/page.tsx
    - src/app/(app)/loading/page.tsx
    - src/app/loading-demo/page.tsx
    - src/lib/routes/studySetPaths.test.ts
key-decisions:
  - "Use canonical helper names directly and remove all transitional route exports before Plan 07-09 deletion."
  - "Defer only the four exact pending-deletion route roots in verify:phase7-callers."
  - "Keep verify:phase7-references strict and exclusion-free for the post-deletion gate."
requirements-completed: [IA-01, IA-02, IA-05, IA-06, IA-07, IA-10]
duration: ~35 min
completed: 2026-07-26
---

# Phase 7 Plan 8: Residual Route Caller Migration Summary

**Canonical route callers, configuration, guards, and deterministic zero-reference precondition for legacy route deletion**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-26
- **Tasks:** 2
- **Files created/modified:** 24
- **Commits:** None, per authorized surgical no-commit safety mode.

## Accomplishments

- Removed legacy Next redirects and the obsolete `verify:redirects` package command while preserving unrelated `next.config.ts` hunks.
- Updated prefetch routes, command palette route parsing/actions, dashboard and review callers, creation redirect callers, loading-demo navigation, and content-kind redirect logic to canonical singular helpers.
- Removed transitional route exports only after their live non-deletion callers were migrated.
- Added `npm run verify:phase7-callers`, which reports the exact required output: `0 forbidden caller references`.
- Added `npm run verify:phase7-references` as a strict post-deletion audit with no legacy-root exclusion.

## Migration Inventory

- **Configuration:** `next.config.ts` legacy redirect table removed; package redirect verifier removed.
- **Prefetch/navigation:** `RoutePrefetch.tsx`, `CommandPalette.tsx`, dashboard create links, loading pages, and legacy create entry redirects now use `/create`, `/quiz/create`, `/flashcard/create`, `/quiz/[setId]/*`, or `/flashcard/[setId]/*` vocabulary.
- **Helpers/guards:** transitional aliases removed from `studySetPaths.ts`; content-kind guards now use `quizEdit`, `flashcardEdit`, `quizResults`, `flashcardResults`, `quizPlay`, and `flashcardPlay`.
- **Components/tests:** dashboard, quiz, flashcard review, review section, and route contract tests no longer use transitional helper names.
- **Deferred exact roots:** `src/app/(app)/edit/**`, `src/app/(app)/sets/**`, `src/app/(app)/flashcards/**`, and `src/app/(app)/quiz/[id]/**` remain intact for Plan 07-09 deletion.

## Verification

- `npm run verify:phase7-callers` — **passed**, exact output `0 forbidden caller references`.
- `npm test -- src/lib/routes/studySetPaths.test.ts src/lib/dashboard/studySetDashboardLinks.test.ts --run` — **passed**, 2 files / 18 tests.
- `git diff --check` on the scoped migration paths — passed; only line-ending normalization warnings were emitted.
- `npm run typecheck` — still reports generated `.next/types` route inventory errors and imports inside the four deferred legacy roots; no new canonical helper aliases remain outside the deferred roots. The generated route errors and deferred-root errors are intentionally left for Plan 07-09 deletion/regeneration.
- `npm run lint` — remains blocked by pre-existing errors in `Doc2QuizTransitionOverlay.tsx` and `PageTransitionProvider.tsx`; unrelated warnings were not changed.
- `npm run verify:phase7-references` is intentionally not expected to pass before Plan 07-09 removes the four route roots.

## Deviations from Plan

### User-authorized no-commit safety mode

No files were staged or committed, as explicitly required. Existing dirty and Phase 6 hunks were preserved; no reset, checkout, restore, clean, blanket replacement, or destructive deletion was used.

### Rule 1 - Audit matcher precision

The initial audit matcher treated canonical route assertions and component import names as forbidden callers. It was narrowed to quoted legacy URL literals and transitional helper identifiers, while retaining the exact deferred-root exclusion and API/domain allowlist behavior. The final audit passes with literal zero.

## Known Stubs

None introduced by this plan.

## Threat Flags

None beyond the planned deterministic repository-boundary audit scripts; no endpoint, auth path, file-access pattern, or schema was introduced.

## Self-Check: PASSED

- Summary exists at the required path.
- `verify:phase7-callers` exits 0 with literal zero output.
- Focused canonical route tests pass.
- Four deferred route roots remain present for Plan 07-09.
- No staging or commits occurred.

## Next Phase Readiness

Plan 07-09 is ready to delete the four exact deferred legacy route roots and then run `npm run verify:phase7-references`, route smoke, full typecheck, lint, and build gates. The pre-deletion caller condition is satisfied.

---
*Phase: 07-normalize-app-information-architecture-around-setid-based-qu*
*Completed: 2026-07-26*
