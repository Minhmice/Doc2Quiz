---
phase: 07-normalize-app-information-architecture-around-setid-based-qu
plan: 02
subsystem: database
Tags: [supabase, postgres, rls, optimistic-concurrency, vitest]
requires:
  - phase: 07-01
    provides: Authorized surgical no-commit baseline and canonical setId route contracts
provides:
  - Additive resumable study-session schema with owner RLS and indexed unfinished queries
  - Cross-mode unresolved-mistake ledger with atomic increment and resolution RPCs
  - Typed client state-machine, reconciliation, smart-resume, final-flush, and mistake APIs
affects: [07-04, 07-06, 07-07, dashboard, quiz, flashcard]
tech-stack:
  added: []
  patterns: [revision-and-updated-at compare-and-swap, ID-only durable interaction payloads, owner-scoped RLS]
key-files:
  created: [supabase/migrations/20260726150000_resumable_study_sessions.sql, src/types/studySession.ts]
  modified: [src/lib/client/activityTracking.ts, src/lib/client/activityTracking.test.ts]
key-decisions:
  - "Persist only ordered item IDs, pointers, and mode-specific interaction state; generated study text remains outside session payloads."
  - "Use revision plus updated_at compare-and-swap and refetch on stale writes."
  - "Keep mistake identity unique by owner, set, mode, and item so quiz and flashcard mistakes cannot collide."
patterns-established:
  - "currentItemId is the post-restore display pointer; nextItemId is the next item after the last committed semantic action."
  - "Completion is accepted only from an unfinished, current revision with no next item."
requirements-completed: [IA-08, IA-09]
duration: 8min
completed: 2026-07-26
---

# Phase 7 Plan 2: Resumable Study Sessions Summary

**Owner-scoped resumable quiz/flashcard sessions with optimistic concurrency and a durable cross-mode unresolved-mistake ledger**

## Performance

- **Duration:** 8 min
- **Completed:** 2026-07-26
- **Tasks:** 2
- **Files created/modified:** 5 including this summary
- **Commits:** None, per authorized surgical no-commit safety mode

## Accomplishments

- Added additive `study_sessions` and `study_mistakes` tables without changing existing IDs or records.
- Added owner RLS, bounded payload constraints, unfinished/mistake indexes, and atomic mistake increment/resolution functions.
- Added typed start, save, restore, reconcile, complete, unfinished-list, smart-resume, pagehide/hidden flush, and mistake APIs.
- Preserved exact quiz answer/correctness and flashcard known/rating payloads while storing IDs rather than generated text.
- Added focused reconciliation tests for deleted, reordered, newly added, and mode-specific interaction state.

## State-Machine Invariants

- `currentItemId` is the actionable item displayed after restore.
- `nextItemId` is the next unanswered/unrated item following the last persisted semantic action.
- Surviving IDs retain persisted order; new IDs append in deterministic lexical order.
- Save compares owner, session ID, revision, `updated_at`, and unfinished state; stale writes refetch rather than overwrite.
- Completion requires `nextItemId === null` and the same compare-and-swap boundary.
- Unfinished queries exclude completed rows.
- Mistake increment atomically increases count and reopens resolution; correct resolution preserves history and marks the row resolved.
- Mistakes are isolated by owner + set + mode + item and aggregate by count descending, then last-practiced descending.

## Migrations and Contracts

- `supabase/migrations/20260726150000_resumable_study_sessions.sql` — additive tables, constraints, RLS policies, indexes, and security-invoker RPCs.
- `src/types/studySession.ts` — bounded session, quiz answer, flashcard rating, mistake, overview, and smart-resume contracts.
- No service-role key or service credential was introduced client-side.

## Task Commits

No files were staged or committed. This is required by the user-authorized Phase 7 surgical no-commit safety mode.

## Verification

- `npm test -- src/lib/client/activityTracking.test.ts --run` — passed, 1 file / 9 tests.
- Scoped `git diff --check` for all four owned implementation paths — passed.
- Owned-file TypeScript diagnostic filter emitted no `activityTracking` or `studySession` errors.
- Full `npm run typecheck` remains blocked only by pre-existing Plan 07-01 canonical-route cutover imports in downstream legacy callers; none are Plan 07-02 files.
- Pre-task tracked diffs were empty and both new files were absent. Post-task status contains only the two owned modifications and two owned additions.

## Deviations from Plan

### User-Authorized Safety Mode

**1. No TDD commits or metadata commit created**
- **Reason:** Explicit no-commit requirement takes precedence over normal GSD atomic commit protocol.
- **Impact:** Complete verified output remains in the working tree; no staging occurred.

**2. Scoped typecheck substituted for the globally blocked gate**
- **Issue:** Full typecheck fails on known downstream callers of route aliases removed by Plan 07-01.
- **Action:** Confirmed the compiler emitted no diagnostics for either Plan 07-02 TypeScript module and ran focused tests plus scoped diff check.
- **Impact:** Plan-owned code is clean; route-caller migration remains assigned to later Phase 7 plans.

## Known Stubs

None introduced.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: database trust boundary | `supabase/migrations/20260726150000_resumable_study_sessions.sql` | New browser-to-Supabase session and mistake surfaces are protected by owner RLS, owner FKs, bounded payloads, and compare-and-swap client writes. |

## Preservation Check

- Existing `activityTracking.ts` completion, latest-score, wrong-history, and activity-stat APIs were retained.
- Existing `activityTracking.test.ts` tests were retained and pass alongside the new tests.
- No unrelated path was edited, staged, committed, reset, checked out, restored, or cleaned.
- The two pre-existing tracked owned-file diffs were empty at baseline; new hunks are Plan 07-02-only.

## Self-Check: PASSED

- All four owned implementation artifacts exist.
- Focused tests pass and scoped diffs are whitespace-clean.
- Migration includes both tables, owner RLS, constraints, indexes, and mistake RPCs.
- Summary exists and no staging or commit was performed.

## Next Phase Readiness

- **Wave 2 Plan 07-02 is complete.**
- Plans 07-04, 07-06, and 07-07 can consume smart-resume, mistake overviews, and durable session APIs.
- Full typecheck will clear when the planned route caller migration replaces removed legacy aliases.

---
*Phase: 07-normalize-app-information-architecture-around-setid-based-qu*
*Completed: 2026-07-26*
