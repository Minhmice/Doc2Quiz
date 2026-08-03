---
phase: 12-study-together
plan: 03
subsystem: social-realtime
tags: [nextjs, supabase-realtime, reconciliation, vitest]
requires:
  - phase: 12-02
    provides: durable notification APIs
  - phase: 12-07
    provides: private request, count, and message topics
provides:
  - Separate server-derived notification, request, and message counts
  - Lifecycle and private-event reconciliation controller
  - Compact topbar aggregate plus individual count display
affects: [12-04, 12-05, 12-09]
tech-stack:
  added: []
  patterns: [events-as-invalidation, bounded coalesced reconciliation, durable-first writes]
key-files:
  created: [src/lib/client/socialCounts.ts, src/lib/client/socialCounts.test.ts]
  modified: [src/app/api/friends/route.ts, src/app/api/friends/requests/route.ts, src/app/api/friends/messages/[conversationId]/route.ts, src/components/layout/FriendsMenu.tsx]
key-decisions:
  - "Realtime payloads only invalidate; every displayed count comes from authenticated HTTP authority."
  - "Topbar aggregates three separately retained counts only at display time."
patterns-established:
  - "One coalesced reconciliation operation runs after events, subscription recovery, focus, and visibility recovery."
requirements-completed: [SOCIAL-07, SOCIAL-08, SOCIAL-09, SOCIAL-10]
duration: 10min
completed: 2026-07-31
---

# Phase 12 Plan 03: Durable Social Count Reconciliation Summary

**Separate durable social counts converge through private invalidation events and browser lifecycle recovery without trusting event payloads**

## Performance
- **Duration:** 10 min
- **Started:** 2026-07-31T11:12:00Z
- **Completed:** 2026-07-31T11:22:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added isolated incoming-request and unread-message totals to friends overview while preserving existing friend/request lists.
- Added best-effort request and message invalidation after durable writes; failed broadcast never reverses HTTP success.
- Added one coalescing controller that fetches all three count authorities plus newest notifications after private events, subscribe/rejoin, focus, and visible-document recovery.
- Updated compact topbar menu to retain individual Requests, Study invites, and Unread messages counts while showing aggregate badge.

## Task Commits
1. **Task 1: Expose separate durable social counts and invalidation writes** - `ecffa68` (feat)
2. **Task 2: Reconcile all topbar social counts on events and lifecycle recovery** - `f3ebdb9` (feat)

## Files Created/Modified
- `src/app/api/friends/route.ts` - Separate request and unread-message count contract.
- `src/app/api/friends/requests/route.ts` - Post-commit recipient request invalidation.
- `src/app/api/friends/messages/[conversationId]/route.ts` - Conversation and recipient-count invalidation.
- `src/app/api/friends/friends.route.test.ts` - Count isolation, no implicit reads, topic, and failed-delivery proofs.
- `src/lib/client/socialCounts.ts` - Count fetch and private-channel lifecycle controller.
- `src/lib/client/socialCounts.test.ts` - Authority, event, subscribe, focus, visibility, payload distrust, and cleanup proofs.
- `src/components/layout/FriendsMenu.tsx` - Aggregate badge and separate count display.

## Decisions Made
- Reused existing overview and notification routes; no extra count endpoint or dependency.
- Coalesced same-tick event bursts with `queueMicrotask`; future throttling only needed if production event volume exceeds one reconciliation per task.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Derived request recipient from existing request list contract**
- **Found during:** Task 1
- **Issue:** Existing send RPC response exposes request ID but not recipient ID needed for recipient topic.
- **Fix:** Resolve newly committed outgoing request through existing authenticated request-list RPC, then emit recipient invalidation.
- **Files modified:** `src/app/api/friends/requests/route.ts`
- **Verification:** Focused route tests pass.
- **Committed in:** `ecffa68`

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No schema or migration change; private recipient topic remains bounded by existing authority.

## Issues Encountered
- Full `friends.route.test.ts` includes unrelated dirty onboarding test expecting numeric `onboarding_version`; current dirty profile route writes string. Scoped Plan 12 social tests pass. Typecheck passes.
- Database migration and RLS validation are owned by Supabase deployment; repository tests do not require a database URL.

## Known Stubs
None.

## Threat Flags
| Flag | File | Description |
|---|---|---|
| threat_flag: private-realtime-client | `src/lib/client/socialCounts.ts` | New private subscriptions use authenticated user-bound topics and treat payloads only as hints. |

## User Setup Required
None.

## Next Phase Readiness
- Durable topbar count foundation ready for friends hub and responsive chat plans.
- Supabase deployment remains the authority for runtime RLS behavior.

## Self-Check: PASSED
- Planned implementation and test files exist.
- Task commits `ecffa68` and `f3ebdb9` exist.
- Scoped route tests: 15 passed, 16 unrelated tests skipped.
- Social count controller tests: 2 passed.
- TypeScript: `npm run typecheck` passed.

---
*Phase: 12-study-together*
*Completed: 2026-07-31*
