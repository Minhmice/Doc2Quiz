---
phase: 15-social-presence-scaling
plan: 02
subsystem: social-presence
tags: [redis, presence, typing, nextjs, supabase, vitest]
requires:
  - phase: 15-social-presence-scaling
    provides: Redis presence sessions, limits, and activity compatibility seam
provides:
  - Canonical server-owned presence DTO, cursor, and bounded snapshot contract
  - Participant-authorized five-second Redis typing route with degraded unknown state
  - Closed meaningful activity producer attached after successful compatibility presence touch
affects: [15-03, 15-04, 15-05]
actuals:
  tokens: 7600
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns: [server-owned presence buckets, auth-before-Redis typing, Redis Stream producer handoff]
key-files:
  created:
    - src/lib/social/presenceTypes.ts
    - src/lib/server/social/presenceSnapshot.ts
    - src/lib/server/social/typing.ts
    - src/app/api/friends/messages/[conversationId]/typing/route.ts
    - src/lib/server/social/activityProducer.ts
    - supabase/migrations/20260802000000_social_presence_typing.sql
  modified:
    - src/app/api/friends/route.ts
    - src/lib/server/friends/socialLists.ts
    - src/app/api/friends/activity/route.ts
    - src/lib/server/redis/client.ts
    - src/lib/server/social/rateLimit.ts
key-decisions:
  - "Presence snapshot state is request-scoped; Redis outages return only explicitly supplied bounded last-known state, then unknown."
  - "Typing checks durable participant and accepted-friend/block authority before every Redis operation."
  - "Compatibility activity emits one closed presence_transition only after successful Redis touch; study completion remains excluded."
patterns-established:
  - "Canonical social display DTOs and cursors live in src/lib/social/presenceTypes.ts."
  - "Redis outage snapshot paths report unknown instead of inferring stopped or offline."
requirements-completed: [SCALE-03, SCALE-04, SCALE-05, SCALE-06, SCALE-10]
coverage:
  - id: D1
    description: "Server-authoritative canonical presence buckets, source metadata, cursor versioning, and bounded snapshot aggregation"
    requirement: SCALE-03
    verification:
      - kind: unit
        ref: "npx vitest run src/lib/social/presenceTypes.test.ts src/lib/server/social/presenceSnapshot.test.ts src/lib/server/friends/socialLists.test.ts src/app/api/friends/friends.route.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Accepted-friend snapshot and participant-authorized typing privacy contracts"
    requirement: SCALE-04
    verification:
      - kind: unit
        ref: "src/app/api/friends/messages/[conversationId]/typing/route.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Five-second typing TTL, two-second refresh guard, and unknown outage snapshot"
    requirement: SCALE-05
    verification:
      - kind: unit
        ref: "src/lib/server/social/typing.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Closed meaningful activity event producer attached after successful Redis compatibility presence touch"
    requirement: SCALE-06
    verification:
      - kind: unit
        ref: "src/lib/server/social/activityProducer.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Disposable SQL privacy behavior and real Redis TTL/privacy proof"
    requirement: SCALE-10
    verification: []
    human_judgment: true
    rationale: "Requires approved disposable Redis and Supabase targets; external proof is deferred to Plan 15-05."
duration: 29min
completed: 2026-08-09
status: complete
---

# Phase 15 Plan 02: Canonical presence snapshots, privacy, typing, and activity handoff Summary

**Server-owned social presence snapshots, participant-scoped Redis typing, and bounded meaningful activity handoff.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-08-09T01:50:00Z
- **Completed:** 2026-08-09T02:18:51Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments

- Added canonical presence DTO/source/cursor contracts and Redis-backed friend snapshot aggregation with explicit unknown degradation.
- Added the sole typing route with participant authorization before Redis, exact five-second TTL, two-second refresh rejection, and durable SQL authorization mirror.
- Attached one closed `presence_transition` producer event to successful compatibility touches; quiz and flashcard completions remain excluded.

## Task Commits

1. **Task 1: Define canonical DTO and server-authoritative friend snapshot** — `402c02f` (`feat`)
2. **Task 2: Add canonical typing route and privacy SQL contract** — `988cad3` (`feat`)
3. **Task 3: Attach meaningful activity producer to compatibility route** — `f130adb` (`feat`)
4. **Task 1 correction: keep presence snapshots stateless** — `2724fc0` (`fix`)
5. **Task 2 correction: preserve typing unknown outage state** — `1882d0c` (`fix`)

## Files Created/Modified

- `src/lib/social/presenceTypes.ts` — sole DTO, source, and versioned cursor owner.
- `src/lib/server/social/presenceSnapshot.ts` — bounded Redis aggregation and explicit degradation state.
- `src/app/api/friends/route.ts` / `src/lib/server/friends/socialLists.ts` — server-authoritative friend snapshots and destination-bound cursors.
- `src/lib/server/social/typing.ts` / `src/app/api/friends/messages/[conversationId]/typing/route.ts` — participant-scoped typing state.
- `supabase/migrations/20260802000000_social_presence_typing.sql` — protected durable participant authorization RPC.
- `src/lib/server/social/activityProducer.ts` / `src/app/api/friends/activity/route.ts` — closed activity producer handoff.

## Decisions Made

- Presence cache is not process-global; request state is authoritative and only caller-supplied bounded last-known state can be returned during grace.
- Typing GET returns `{ state: "unknown", users: [] }` when Redis is unavailable, never a false stopped state.
- Activity producer emits only `presence_transition`, `message_sent`, and `conversation_read`; Plan 15-03 owns worker consumption and message/read producers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Process-global last-known snapshot cache**
- **Found during:** Task 1 verification
- **Issue:** Module state would conflict with stateless route-handler constraints.
- **Fix:** Made snapshot cache request-scoped and injectable for tests.
- **Files modified:** `src/lib/server/social/presenceSnapshot.ts`, related route/tests.
- **Verification:** Focused Vitest, targeted ESLint, and `npm run typecheck` pass.
- **Committed in:** `2724fc0`

**2. [Rule 1 - Bug] Typing GET treated Redis outage as rate-limiter failure**
- **Found during:** Final contract review
- **Issue:** Documented outage response requires unknown snapshot rather than 503/stopped semantics.
- **Fix:** Return documented unknown response before snapshot rate-limit access when Redis is unavailable.
- **Files modified:** typing route and route test.
- **Verification:** Focused Vitest and `npm run typecheck` pass.
- **Committed in:** `1882d0c`

**Total deviations:** 2 auto-fixed (2 bugs). **Impact:** Required correctness fixes; no scope expansion.

## Verification

- PASS — focused Plan 15-02 Vitest: 56 tests passed.
- PASS — required typing SQL static assertion.
- PASS — targeted Phase 15 ESLint.
- PASS — `npm run typecheck`.
- BLOCKED/OUT OF SCOPE — repository-wide `npm run lint` retains two pre-existing errors in `src/app/share/[token]/page.tsx` and `src/legacy/loading/PageTransitionProvider.tsx`, plus warnings.

## Issues Encountered

- External Redis and disposable Supabase SQL privacy/TTL proof require deployment-owner credentials and remain deferred to Plan 15-05.

## User Setup Required

**External SQL/privacy verification remains required.** Provide `PHASE15_TEST_DATABASE_URL` and `PHASE15_TEST_CONFIRM=YES` only for an approved disposable target.

## Next Phase Readiness

- Plan 15-03 can add Stream consumption and durable activity batch ownership using `enqueueMeaningfulActivity`.
- Plan 15-04 owns stale client consumer migration from `recently_active`, presence cache presentation, and typing UI.
- Real Redis/SQL privacy and load proof remains a Phase 15 validation prerequisite.

## Self-Check: PASSED

---
*Phase: 15-social-presence-scaling*
*Completed: 2026-08-09*
