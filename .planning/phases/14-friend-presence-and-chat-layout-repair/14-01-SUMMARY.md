---
phase: 14-friend-presence-and-chat-layout-repair
plan: 01
subsystem: api
tags: [supabase, postgres, nextjs, zod, vitest, pagination, presence]

# Dependency graph
requires:
  - phase: 12-study-together
    provides: authenticated bounded social-list RPCs, opaque cursor paging, and friends client routes
provides:
  - server-filtered online/offline friend pages with bucket-bound cursors
  - authenticated friends query validation and explicit presence forwarding
  - enum-only accepted-friend client DTO without stale isOnline field
affects:
  - phase 14 plan 02 presence tabs and row visuals
  - friends hub and compact friends launcher consumers

# Tech tracking
tech-stack:
  added: []
  patterns:
    - presence bucket predicate runs inside RPC before keyset paging
    - friends cursors encode destination, version, and requested bucket
    - route authentication runs before untrusted query parsing

key-files:
  created:
    - supabase/migrations/20260801233000_phase14_friend_presence_bucket.sql
    - src/lib/server/friends/socialListQuery.ts
  modified:
    - supabase/schemas/70_functions.sql
    - supabase/tests/phase12_bounded_social_lists.sql
    - src/lib/server/friends/socialLists.ts
    - src/lib/server/friends/socialLists.test.ts
    - src/app/api/friends/route.ts
    - src/app/api/friends/friends.route.test.ts
    - src/lib/client/friends.ts
    - src/lib/client/friends.test.ts

key-decisions:
  - "Use online and offline as the only client buckets; recently_active remains inside offline."
  - "Filter presence in list_social_friends before cursor predicates, ordering, and limit-plus-one paging."
  - "Bind presence bucket only to friends cursors; preserve other social destination cursor semantics."

patterns-established:
  - "AcceptedFriendSummary.presence is the sole client presence truth."
  - "listAcceptedFriends explicitly requests both bounded buckets only for compact aggregate consumers."

requirements-completed: [SOCIAL-09]

# Metrics
duration: ~45min
completed: 2026-08-02
---

# Phase 14 Plan 01: Friend presence and chat layout repair Summary

**Server-authoritative online/offline friend pagination now preserves complete bucket pages and prevents cross-tab cursor replay.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-02T00:00:00+07:00 (continuation execution window)
- **Completed:** 2026-08-02T01:48:00+07:00
- **Tasks:** 2/2
- **Files modified:** 10 implementation/test files plus 1 new migration and 1 new parser

## Accomplishments

- Added additive `list_social_friends` presence filtering for `online` and `offline`, preserving auth scope, accepted-friend/block predicates, cursor ordering, and authenticated grants.
- Bound friends opaque cursors to requested presence buckets and retained limit-plus-one keyset paging.
- Added authenticated route validation and typed browser requests with `presence: online | recently_active | offline`; removed stale `isOnline` from the accepted-friend DTO.

## Task Commits

Each TDD task was committed atomically:

1. **Task 1 RED:** `f3b815f` — `test(14-01): add presence bucket pagination assertions`
2. **Task 1 GREEN:** `2ae6e8e` — `feat(14-01): add bucketed friend pagination authority`
3. **Task 2 RED:** `6062176` — `test(14-01): add friends presence route and client assertions`
4. **Task 2 GREEN:** `a609d78` — `feat(14-01): expose validated friends presence buckets`

**Plan metadata:** Summary commit created after self-check.

## Files Created/Modified

- `supabase/migrations/20260801233000_phase14_friend_presence_bucket.sql` - additive bucket-aware RPC migration.
- `supabase/schemas/70_functions.sql` - schema mirror for the updated RPC.
- `supabase/tests/phase12_bounded_social_lists.sql` - static SQL contract proof updates.
- `src/lib/server/friends/socialLists.ts` - bucket-aware cursor encoding/decoding and RPC adapter.
- `src/lib/server/friends/socialListQuery.ts` - friends-only Zod presence parser.
- `src/app/api/friends/route.ts` - authenticated presence query forwarding.
- `src/lib/client/friends.ts` - enum DTO, bucket page helper, and explicit compact aggregation.
- `src/lib/server/friends/socialLists.test.ts` - RPC, paging, malformed cursor, and cross-bucket cursor tests.
- `src/app/api/friends/friends.route.test.ts` - default, valid, invalid, and auth-order route tests.
- `src/lib/client/friends.test.ts` - bucket URL and enum DTO client tests.

## Validation

- PASS — `npx vitest run src/lib/server/friends/socialLists.test.ts src/lib/client/friends.test.ts`
- PASS — `npx vitest run src/app/api/friends/friends.route.test.ts -t "GET /api/friends"` (4 tests)
- PASS — `npx vitest run src/lib/server/friends/socialLists.test.ts src/app/api/friends/friends.route.test.ts src/lib/client/friends.test.ts -t "presence|accepted-friend bucket|mapSocialHttpError"`
- PASS — `npm run typecheck`
- BLOCKED — runtime SQL proof not run; no approved `PHASE12_TEST_DATABASE_URL` was available.

Full combined route/client run still reports four legacy overview assertions in `friends.route.test.ts` that expect retired unbounded `/api/friends` response shapes. New Phase 14 presence assertions pass; legacy failures are outside this plan and were not changed.

## Decisions Made

- `offline` includes both `recently_active` and `offline`, with no new client bucket.
- API authenticates before parsing `presence`, `limit`, or `cursor`.
- Cursor bucket binding is enforced only for `friends`; requests, invites, messages, and blocks retain existing cursor semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved compatibility for compact aggregate consumers**
- **Found during:** Task 2 implementation.
- **Issue:** Existing compact menu and study handoff still need an aggregate accepted-friends list while hub pages require explicit buckets.
- **Fix:** Updated `listAcceptedFriends` to request one bounded online page and one bounded offline page, combining only at that presentation boundary; hub uses `listAcceptedFriendPage` directly.
- **Files modified:** `src/lib/client/friends.ts`
- **Verification:** Typecheck and focused route/client tests pass.
- **Committed in:** `a609d78`

### Out-of-scope deferred issues

- Existing legacy overview assertions in `src/app/api/friends/friends.route.test.ts` expect the retired `{ friends, incoming, unreadMessageCount }` shape and fail in the full unfiltered suite. No Phase 14 implementation depends on that shape; leave for follow-up contract cleanup.
- Approved disposable SQL target remains unavailable, so runtime migration proof is deferred.

---

**Total deviations:** 1 auto-fixed (Rule 3); 2 deferred verification/issues.
**Impact on plan:** Presence contract is complete. Deferred items do not block Phase 14 Plan 01's bucketed friends API/client behavior.

## Threat Surface Scan

No new trust boundary beyond the planned `/api/friends` query path and `list_social_friends` RPC argument. Existing authentication, accepted-friend scope, block exclusion, restricted search path, and authenticated-only grants remain preserved.

## Known Stubs

None found in Plan 14-01 files. No placeholder data source, empty UI flow, or TODO/FIXME stub was introduced.

## User Setup Required

None. Runtime SQL proof needs an explicitly approved disposable/local `PHASE12_TEST_DATABASE_URL` before execution.

## Next Phase Readiness

Plan 14-02 can consume `AcceptedFriendSummary.presence` and call `listAcceptedFriendPage(presence, cursor)` for independent tab state. Preserve server-returned cursors per bucket and keep offline visual suppression in UI scope.

## Self-Check: PASSED

- Summary file exists.
- Migration and parser files exist.
- TDD commits `f3b815f`, `2ae6e8e`, `6062176`, and `a609d78` exist in repository history.
- Unrelated working-tree changes remain unstaged and untouched.

---
*Phase: 14-friend-presence-and-chat-layout-repair*
*Completed: 2026-08-02*
