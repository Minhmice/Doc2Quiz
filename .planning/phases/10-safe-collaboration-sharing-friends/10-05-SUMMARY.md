---
phase: 10-safe-collaboration-sharing-friends
plan: 05
subsystem: database
tags: [postgres, supabase, friends, username, social-safety, rpc]

requires:
  - phase: 10-safe-collaboration-sharing-friends
    plan: 01
    provides: hardened private schema patterns and Phase 10 SQL test harness conventions
provides:
  - Normalized unique username authority on profiles
  - Transactional friend request, block, and report RPCs with rolling rate limits
  - Private rate-event and report tables with no direct client access
  - Typed server wrappers for social RPC error mapping
affects:
  - 10-07 social API routes
  - 10-10 social settings UI

tech-stack:
  added: []
  patterns:
    - "lower(btrim()) username normalization stored on profiles.username_normalized"
    - "Generic request_unavailable anti-enumeration for social recipient failures"
    - "Rolling 10/hour friend-send cap via private.social_friend_request_events"
    - "Report acknowledgement-only RPC responses; 90-day purge routine"

key-files:
  created:
    - supabase/migrations/20260730140400_phase10_social_safety.sql
    - supabase/tests/phase10_social_safety.sql
    - src/lib/profile/usernameValidation.ts
    - src/lib/profile/usernameValidation.test.ts
    - src/lib/server/friends/friends.ts
    - src/lib/server/friends/friends.test.ts
  modified: []

key-decisions:
  - "Social tables are RPC-only: revoke direct authenticated table access"
  - "Friend send failures always map to request_unavailable except explicit rate_limited"
  - "Report RPC returns { ok: true } only; purge_expired_user_reports is superuser/service scheduled"

patterns-established:
  - "Social safety: database-owned normalization, rate limits, blocks, and report privacy"
  - "friends.ts mirrors redeemCoupon typed RPC wrapper pattern with social-specific errors"

requirements-completed: [COLLAB-07]

duration: 25min
completed: 2026-07-30
---

# Phase 10 Plan 05: Social Safety Database Authority Summary

**Postgres RPCs enforce normalized username uniqueness, 10/hour friend-send caps, bidirectional blocks, and private 90-day report retention before route/UI wiring.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-30T08:41:00Z
- **Completed:** 2026-07-30T09:06:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added migration with profiles username columns, friend_requests, user_blocks, user_reports, private rate events, and authenticated RPCs (`set_profile_username`, `send_friend_request`, `block_user`, `unblock_user`, `report_user`, `purge_expired_user_reports`).
- Added SQL integration matrix for normalization collisions, generic anti-enumeration paths, tenth/eleventh rolling-hour boundary, report privacy, and 90-day purge.
- Added `usernameValidation` utility and `friends` server service with typed `FriendRequestUnavailableError`, `FriendRateLimitedError`, and acknowledgement-only report mapping.

## Task Commits

1. **Task 1: Add locked social schema, RPCs, and SQL integration matrix** - `37d40d5` (test), `efafd44` (feat)
2. **Task 2: Expose typed validation and social RPC service** - `e97fb4a` (test), `d9a3d91` (feat)

## Files Created/Modified

- `supabase/migrations/20260730140400_phase10_social_safety.sql` - Social schema, private rate events, RPC authority, report purge
- `supabase/tests/phase10_social_safety.sql` - Integration matrix for normalization, rate cap, blocks, privacy, purge
- `src/lib/profile/usernameValidation.ts` - Client/server username normalize + validate helpers
- `src/lib/profile/usernameValidation.test.ts` - Normalization and validation coverage
- `src/lib/server/friends/friends.ts` - Typed RPC wrappers without social payload logging
- `src/lib/server/friends/friends.test.ts` - Generic errors, retry metadata, report acknowledgement tests

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Deferred / Environment

**Local Supabase SQL tests blocked:** `supabase start` fails on pre-existing baseline migration (`must be owner of table storage.objects` during `20260725120000_v21_baseline.sql`). Remote migrations were confirmed applied by user; local `supabase db reset && supabase test db --file supabase/tests/phase10_social_safety.sql` could not run in this environment.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: social_rpc | supabase/migrations/20260730140400_phase10_social_safety.sql | New authenticated social mutation RPCs at client→DB boundary |
| threat_flag: report_privacy | supabase/migrations/20260730140400_phase10_social_safety.sql | user_reports table with server-only reads and 90-day purge |

## Self-Check: PASSED

- FOUND: supabase/migrations/20260730140400_phase10_social_safety.sql
- FOUND: supabase/tests/phase10_social_safety.sql
- FOUND: src/lib/profile/usernameValidation.ts
- FOUND: src/lib/profile/usernameValidation.test.ts
- FOUND: src/lib/server/friends/friends.ts
- FOUND: src/lib/server/friends/friends.test.ts
- FOUND: 37d40d5
- FOUND: efafd44
- FOUND: e97fb4a
- FOUND: d9a3d91

## Test Results

- `npm test -- --run src/lib/profile/usernameValidation.test.ts src/lib/server/friends/friends.test.ts` — **7 passed**
- `supabase db reset && supabase test db --file supabase/tests/phase10_social_safety.sql` — **blocked** (local Supabase start failure on baseline migration)
