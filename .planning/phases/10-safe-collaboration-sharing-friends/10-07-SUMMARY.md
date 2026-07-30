---
phase: 10-safe-collaboration-sharing-friends
plan: 07
subsystem: api
tags: [nextjs, supabase, friends, username, social-safety, zod]

requires:
  - phase: 10-safe-collaboration-sharing-friends
    plan: 05
    provides: Social RPC authority and typed friends service wrappers
provides:
  - Self-only profile username PATCH via protected API
  - Friend request send/list/respond/cancel routes
  - Block/unblock/list and acknowledgement-only report routes
  - Route-level auth, validation, rate-limit, and anti-enumeration mapping
affects:
  - 10-10 social settings UI

tech-stack:
  added: []
  patterns:
    - "requireApiUser + Zod bounded bodies on all social routes"
    - "mapSocialRouteError maps RPC errors to 404/409/429 without sensitive logs"
    - "Report route returns { ok: true } only; no report row reads"

key-files:
  created:
    - src/app/api/profile/route.ts
    - src/app/api/friends/requests/route.ts
    - src/app/api/friends/requests/[id]/route.ts
    - src/app/api/friends/blocks/route.ts
    - src/app/api/friends/reports/route.ts
    - src/app/api/friends/friends.route.test.ts
    - supabase/migrations/20260730140500_phase10_social_list_respond_rpcs.sql
  modified:
    - src/lib/server/friends/friends.ts

key-decisions:
  - "List/respond/cancel/list-blocks added as SECURITY DEFINER RPCs because 10-05 revoked direct table access"
  - "Friend send failures return 404 request_unavailable; username collisions return 409 only"
  - "Rate limits return 429 with Retry-After header from RPC detail"

patterns-established:
  - "Social API routes: thin handlers delegating to friends.ts typed RPC wrappers"
  - "No social payload logging in route catch blocks"

requirements-completed: [COLLAB-07]

duration: 35min
completed: 2026-07-30
---

# Phase 10 Plan 07: Social Safety API Routes Summary

**Protected profile username and friend/block/report APIs with Zod validation, generic anti-enumeration, rate-limit headers, and acknowledgement-only reports.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-30T08:50:00Z
- **Completed:** 2026-07-30T09:25:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Extended `/api/profile` GET/PATCH so authenticated users set username through `set_profile_username` RPC with 409 on normalized collision and preserved display/bio/avatar behavior.
- Added `/api/friends/requests`, `/api/friends/requests/[id]`, `/api/friends/blocks`, and `/api/friends/reports` with auth gates, bounded bodies, and generic error mapping.
- Added migration RPCs for list/respond/cancel friend requests and list blocked users to complete 10-05 RPC-only table access model.
- Added 15 route tests covering auth, validation, rate limits, anti-enumeration, and report privacy.

## Task Commits

1. **Task 1: Add self-only profile username API** - `dec4b62` (feat)
2. **Task 2: Add protected friend/block/report routes** - `78d4464` (feat)

## Files Created/Modified

- `src/app/api/profile/route.ts` - Self profile GET/PATCH including username RPC
- `src/app/api/friends/requests/route.ts` - Send and list friend requests
- `src/app/api/friends/requests/[id]/route.ts` - Respond and cancel requests
- `src/app/api/friends/blocks/route.ts` - Block, unblock, list blocks
- `src/app/api/friends/reports/route.ts` - Report user acknowledgement
- `src/app/api/friends/friends.route.test.ts` - Social API route coverage
- `src/lib/server/friends/friends.ts` - List/respond/cancel/list-blocks wrappers and route error mapper
- `supabase/migrations/20260730140500_phase10_social_list_respond_rpcs.sql` - Read/mutate friend request and block list RPCs

## Decisions Made

- Added follow-up migration for list/respond/cancel/list-blocks RPCs because 10-05 revoked direct authenticated access to social tables.
- Kept 409 limited to caller-safe username collision; all recipient/block ambiguity stays `request_unavailable` at 404.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added list/respond/cancel/list-blocks RPC migration**
- **Found during:** Task 2 (friend request list/respond/cancel routes)
- **Issue:** 10-05 migration revoked direct `friend_requests`/`user_blocks` access but did not expose read/mutate RPCs required by plan 10-07
- **Fix:** Added `20260730140500_phase10_social_list_respond_rpcs.sql` and extended `friends.ts` wrappers
- **Files modified:** supabase/migrations/20260730140500_phase10_social_list_respond_rpcs.sql, src/lib/server/friends/friends.ts
- **Verification:** Route tests pass; typecheck clean
- **Committed in:** `78d4464`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Required for API routes to function under RPC-only social table access. No scope creep beyond plan behaviors.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: social_api | src/app/api/friends/** | New authenticated social mutation/list endpoints at client→server boundary |

## Issues Encountered

None beyond the missing list/respond RPC gap documented above.

## User Setup Required

Apply `supabase/migrations/20260730140500_phase10_social_list_respond_rpcs.sql` on remote if not yet applied (10-05 social safety base migration confirmed applied by user).

## Next Phase Readiness

- Social API surface ready for 10-10 settings UI wiring
- Apply new list/respond migration on environments using these routes

## Self-Check: PASSED

- FOUND: src/app/api/profile/route.ts
- FOUND: src/app/api/friends/requests/route.ts
- FOUND: src/app/api/friends/requests/[id]/route.ts
- FOUND: src/app/api/friends/blocks/route.ts
- FOUND: src/app/api/friends/reports/route.ts
- FOUND: src/app/api/friends/friends.route.test.ts
- FOUND: supabase/migrations/20260730140500_phase10_social_list_respond_rpcs.sql
- FOUND: dec4b62
- FOUND: 78d4464

## Test Results

- `npm test -- --run src/app/api/friends/friends.route.test.ts` — **15 passed**
- `npm run typecheck` — **passed**

---
*Phase: 10-safe-collaboration-sharing-friends*
*Completed: 2026-07-30*
