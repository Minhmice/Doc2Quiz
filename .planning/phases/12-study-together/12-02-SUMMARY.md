---
phase: 12-study-together
plan: 02
subsystem: api
tags: [nextjs, zod, supabase-rpc, vitest]
requires:
  - phase: 12-01
    provides: typed challenge, attempt, and notification RPC authority
provides:
  - Authenticated validated challenge lifecycle HTTP APIs
  - Safe snapshot practice and server-scored completion routes
  - Durable notification reconciliation APIs and durable-first reaction semantics
affects: [12-03, 12-04, 12-05, 12-07]
tech-stack:
  added: []
  patterns: [auth-before-validation, typed RPC route boundary, durable mutation before realtime acceleration]
key-files:
  created:
    - src/app/api/friends/study-challenges/route.ts
    - src/app/api/friends/study-challenges/[sessionId]/attempt/route.ts
    - src/app/api/friends/notifications/route.ts
    - src/app/api/friends/notifications/unread-count/route.ts
  modified:
    - src/lib/server/friends/studyTogether.ts
    - supabase/migrations/20260731100000_phase12_study_together_foundation.sql
    - src/app/api/friends/reactions/route.ts
key-decisions:
  - "All challenge and notification routes authenticate before parsing attacker-controlled input."
  - "Realtime reaction broadcast remains best-effort after durable mutation success."
patterns-established:
  - "Route handlers validate bounded UUID, enum, pagination, deadline, progress, and answer inputs before typed RPC calls."
requirements-completed: [SOCIAL-01, SOCIAL-02, SOCIAL-03, SOCIAL-04, SOCIAL-05, SOCIAL-06, SOCIAL-07, SOCIAL-08]
duration: 7min
completed: 2026-07-31
---

# Phase 12 Plan 02: Challenge and Notification APIs Summary

**Authenticated Zod-validated challenge lifecycle, safe snapshot practice, server scoring, durable notification reconciliation, and best-effort realtime acceleration**

## Performance
- **Duration:** 7 min
- **Started:** 2026-07-31T11:04:00Z
- **Completed:** 2026-07-31T11:11:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Added challenge list/create/detail/decline plus idempotent creator-start and recipient-accept routes.
- Added safe attempt read/progress/completion boundaries; client score ignored and answer keys withheld.
- Added durable notification list/read/read-all/archive/count routes and removed post-commit reaction 503.

## Task Commits
1. **Task 1: Challenge lifecycle APIs** - `eef6159` (feat)
2. **Task 2: Durable notification APIs** - `855c648` (feat)

## Files Created/Modified
- `src/app/api/friends/study-challenges/` - Authenticated challenge and attempt route handlers plus contract tests.
- `src/app/api/friends/notifications/` - Durable notification route handlers plus contract tests.
- `src/lib/server/friends/studyTogether.ts` - Typed RPC adapters for lifecycle, progress, and notifications.
- `supabase/migrations/20260731100000_phase12_study_together_foundation.sql` - RPC authority required by browser routes.
- `src/app/api/friends/reactions/route.ts` - Durable mutation success no longer reversed by failed broadcast.

## Decisions Made
- Used one generic unavailable response for authorization and lifecycle failures.
- Kept result and practice payload shaping in typed adapter/RPC authority; routes never inspect raw security-sensitive JSON.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added missing RPCs required by planned routes**
- **Found during:** Task 1
- **Issue:** Plan 12-01 adapter/migration lacked list, detail, decline, progress, and notification reconciliation RPCs required by 12-02.
- **Fix:** Added RPC-only lifecycle and notification functions with authenticated participant/recipient scoping and bounded route adapters.
- **Files modified:** `src/lib/server/friends/studyTogether.ts`, `supabase/migrations/20260731100000_phase12_study_together_foundation.sql`
- **Verification:** Focused route suites and typecheck passed.
- **Committed in:** `eef6159`

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required for correctness; no new product scope.

## Issues Encountered
- Database migration and RLS validation are owned by Supabase deployment; repository tests do not require a database URL.

## Threat Flags
| Flag | File | Description |
|---|---|---|
| threat_flag: authenticated-api | `src/app/api/friends/study-challenges/` | New attacker-input route surface, covered by auth-first and Zod bounds. |
| threat_flag: database-rpc | `supabase/migrations/20260731100000_phase12_study_together_foundation.sql` | Added participant-scoped lifecycle and recipient-scoped notification functions. |

## User Setup Required
None.

## Next Phase Readiness
- Ready for 12-03 client contracts and friends surfaces.
- Supabase deployment remains the authority for SQL/RLS integration behavior.

## Self-Check: PASSED
- Planned route and test files exist.
- Task commits `eef6159` and `855c648` exist.
- Vitest: 10/10 focused route tests passed.
- TypeScript: `npm run typecheck` passed.

---
*Phase: 12-study-together*
*Completed: 2026-07-31*
