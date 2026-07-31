---
phase: 12-study-together
plan: 01
subsystem: database
tags: [postgresql, supabase, rpc, realtime, vitest]
requires:
  - phase: 10-social-safety
    provides: accepted-friend and block authority
  - phase: 09-workspaces
    provides: learning_outputs and approved_questions
provides:
  - Immutable creator-owned quiz challenge snapshots
  - Idempotent participant attempts with server scoring and reveal gates
  - Durable notifications, reactions, reminders, and private notification broadcasts
  - Typed TypeScript RPC boundary and guarded SQL proof runner
affects: [12-02, 12-03, 12-04, 12-07]
tech-stack:
  added: []
  patterns: [security-definer RPC state machine, immutable JSON snapshot, durable-first realtime invalidation]
key-files:
  created:
    - supabase/migrations/20260731100000_phase12_study_together_foundation.sql
    - scripts/verify-phase12-study-together-sql.mjs
    - src/lib/server/friends/studyTogether.ts
    - src/lib/server/friends/studyTogether.test.ts
  modified: []
key-decisions:
  - "All study challenge table access remains RPC-only; practice projection strips answer keys."
  - "Runtime SQL proof refuses non-local targets unless disposable host and explicit confirmation match."
patterns-established:
  - "Challenge mutations lock state, dedupe semantic notifications, and return deterministic safe DTOs."
requirements-completed: [SOCIAL-01, SOCIAL-02, SOCIAL-03, SOCIAL-04, SOCIAL-05, SOCIAL-06, SOCIAL-07, SOCIAL-08]
duration: 8min
completed: 2026-07-31
---

# Phase 12 Plan 01: Study Together Foundation Summary

**Immutable creator-owned quiz challenge authority with locked lifecycle RPCs, server scoring, durable notification broadcasts, and typed safe DTO validation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-31T10:55:00Z
- **Completed:** 2026-07-31T11:03:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added immutable snapshot authority with creator ownership, friendship, source readiness, and nonempty-question checks.
- Added idempotent creator/recipient attempts, server-side scoring, reveal policy, and semantic notification dedupe.
- Added durable reaction/reminder tables, best-effort private realtime notification invalidation, typed adapters, and guarded SQL proof.

## Task Commits

1. **Task 1 RED: Typed RPC contracts** - `3bf2fb6` (test)
2. **Task 1 GREEN: Typed adapters and SQL guard** - `7412a12` (feat)
3. **Task 2: Secure immutable SQL authority** - `543f16f` (feat)

## Files Created/Modified
- `src/lib/server/friends/studyTogether.ts` - Typed RPC calls and strict safe-payload decoders.
- `src/lib/server/friends/studyTogether.test.ts` - Nine adapter/error/status contract tests.
- `scripts/verify-phase12-study-together-sql.mjs` - Static migration checks and safe runtime target guard.
- `supabase/migrations/20260731100000_phase12_study_together_foundation.sql` - Challenge state machine, persistence, security, and realtime trigger.

## Decisions Made
- Preserve `friend_shared_quiz` as reserved schema vocabulary while creation always writes `owned_quiz` and offers no friend-shared creation path.
- Treat notification broadcasts as invalidation hints; trigger catches realtime failures after durable insert.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended block authority for active challenge cancellation**
- **Found during:** Task 2
- **Issue:** Existing `block_user` knew nothing about new study sessions.
- **Fix:** Replaced function in additive migration and cancelled pending/active sessions through private helper.
- **Files modified:** `supabase/migrations/20260731100000_phase12_study_together_foundation.sql`
- **Verification:** Static migration proof passed.
- **Committed in:** `543f16f`

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required locked block semantics; no scope expansion.

## Issues Encountered
- Runtime SQL/RLS proof blocked because `PHASE12_TEST_DATABASE_URL` is unset. Guard emitted `SQL_PROOF_BLOCKED` with exit code 2 after static proof passed; no database connection opened.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: database-rpc | `supabase/migrations/20260731100000_phase12_study_together_foundation.sql` | New authenticated cross-user mutation and private realtime topic surface, covered by plan threat model and restricted grants. |

## User Setup Required
None - runtime SQL proof needs explicit disposable test target only when integration proof is run.

## Next Phase Readiness
- Plans 12-02 onward can consume typed challenge RPCs and safe DTOs.
- SQL/RLS integration evidence remains blocked until repository local Supabase or disposable test DB is provided.

## Self-Check: PASSED
- Four planned implementation files exist.
- Task commits `3bf2fb6`, `7412a12`, and `543f16f` exist.
- Vitest: 9/9 passed.
- Static SQL contract: passed; runtime SQL proof: safely blocked with exit code 2.

---
*Phase: 12-study-together*
*Completed: 2026-07-31*
