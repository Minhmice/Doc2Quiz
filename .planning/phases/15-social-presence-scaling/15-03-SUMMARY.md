---
phase: 15-social-presence-scaling
plan: 03
subsystem: social-activity
tags: [redis, streams, supabase, worker, vitest]
requires:
  - phase: 15-social-presence-scaling
    provides: Redis adapter and closed meaningful activity producer handoff
provides:
  - Closed, bounded Redis Stream activity queue with deterministic event/window dedupe
  - Post-commit message and read activity producers without Redis-dependent message failure
  - Service-role durable activity batch RPC and external Stream worker lifecycle
affects: [15-04, 15-05]
actuals:
  tokens: 7200
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns: [closed social activity events, ack-after-commit Redis Streams, service-role durable batch RPC]
key-files:
  created:
    - src/lib/server/social/activityQueue.ts
    - scripts/social-presence-worker.mjs
    - supabase/migrations/20260802010000_social_activity_scaling.sql
    - supabase/tests/social_activity_scaling.sql
  modified:
    - src/app/api/friends/messages/[conversationId]/route.ts
    - src/app/api/friends/messages/[conversationId]/read/route.ts
    - src/lib/server/social/activityProducer.ts
    - supabase/schemas/70_functions.sql
key-decisions:
  - "Activity events are closed to presence_transition, message_sent, and conversation_read; bodies, tokens, IPs, and study actions are rejected."
  - "Message/read commits remain successful when queue delivery fails; queue outcome is metric-observable and never rolls back durable messaging."
  - "Worker owns Streams consumer-group reads, stale claims, retry/dead-letter, and service-role durable writes outside Next.js Route Handlers."
patterns-established:
  - "Redis Stream entries are acknowledged only after apply_social_activity_batch succeeds."
  - "Durable activity only advances last_active_at via greatest incoming timestamp."
requirements-completed: [SCALE-06, SCALE-08]
coverage:
  - id: D1
    description: "Closed bounded Redis Stream queue and idempotent service-role durable activity batch contract"
    requirement: SCALE-06
    verification:
      - kind: unit
        ref: "npx vitest run src/lib/server/social/activityQueue.test.ts src/lib/server/social/activityProducer.test.ts"
        status: pass
      - kind: other
        ref: "node SQL static assertion for social_activity_scaling migration/tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "Successful direct-message sends and conversation reads enqueue exact post-commit activity events without changing durable route behavior"
    requirement: SCALE-08
    verification:
      - kind: unit
        ref: "src/app/api/friends/messages/[conversationId]/route.test.ts and read/route.test.ts"
        status: pass
      - kind: unit
        ref: "src/lib/client/activityTracking.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "External worker bounded consumer-group reads, stale claims, retry/dead-letter, ack-after-commit, config validation, and SIGTERM close"
    requirement: SCALE-06
    verification:
      - kind: unit
        ref: "npx vitest run scripts/social-presence-worker.test.mjs"
        status: pass
      - kind: other
        ref: "node scripts/social-presence-worker.mjs --check-config"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real Redis/Supabase worker deployment, Stream recovery, and SQL privacy/idempotency behavior"
    requirement: SCALE-06
    verification: []
    human_judgment: true
    rationale: "Requires approved external Redis and disposable Supabase targets plus supervisor-managed worker process; repository tests use fakes and static SQL proof only."
duration: 35min
completed: 2026-08-09
status: complete
---

# Phase 15 Plan 03: Durable social activity queue and worker Summary

**Bounded Redis Stream activity events, post-commit message/read producers, idempotent service-role durable batch RPC, and external worker lifecycle.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-09T09:20:00Z
- **Completed:** 2026-08-09T09:55:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added closed activity validation, deterministic per-minute dedupe keys, bounded `d2q:activity` `MAXLEN ~10000`, 24-hour Stream trimming, and rejection of raw/private or study-action payloads.
- Added `apply_social_activity_batch(jsonb)` service-role RPC with private event/dedupe records, newest-per-user/window/kind coalescing, and monotonic `last_active_at` upserts.
- Enqueued one `message_sent` or `conversation_read` event only after successful durable message/read RPCs; queue failure remains observable and does not roll back messaging.
- Added `--once`, `--serve`, and `--check-config` worker modes with bounded `XREADGROUP`, `XAUTOCLAIM`, retry/dead-letter at five attempts, ack-after-commit, redacted health state, and SIGTERM close.

## Task Commits

1. **Task 1: Define bounded queue and idempotent SQL batch contract** — `7e1fc9b` (`feat`)
2. **Task 2: Wire message and read success events** — `3e7e824` (`feat`)
3. **Task 3: Implement external worker lifecycle and retry contract** — `c85def3` (`feat`)
4. **Hardening: queue producer handoff, Stream age trimming, recovery tests, and SQL dedupe correction** — `d36a119` (`fix`)

## Files Created/Modified

- `src/lib/server/social/activityQueue.ts` — closed event contract, bounded Stream producer, and redacted metrics.
- `src/lib/server/social/activityProducer.ts` — compatibility handoff to queue validation.
- `src/app/api/friends/messages/[conversationId]/{route.ts,read/route.ts}` — post-commit exact activity producers.
- `scripts/social-presence-worker.mjs` — external Redis Streams worker.
- `supabase/migrations/20260802010000_social_activity_scaling.sql` — private dedupe storage and service-role batch RPC.
- `supabase/schemas/70_functions.sql` / `supabase/tests/social_activity_scaling.sql` — schema mirror and SQL privilege static assertions.
- `15-USER-SETUP.md` — worker deployment configuration and external evidence checklist.

## Decisions Made

- Queue input never includes message body, token, IP, exact typing content, or study action.
- Worker only acknowledges after a successful durable RPC; retryable events stay pending until lease claim and poison entries dead-letter after exactly five attempts.
- `last_active_at` uses `greatest` to prevent reordered events from moving durable activity backward.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Queue producer handoff bypassed closed event validator**
- **Found during:** Final integration verification
- **Issue:** Existing `activityProducer` duplicated Stream event construction instead of using Task 1 validation/metrics.
- **Fix:** Delegated it to `enqueueActivity`.
- **Files modified:** `src/lib/server/social/activityProducer.ts`
- **Verification:** Focused queue and producer tests pass.
- **Committed in:** `d36a119`

**2. [Rule 1 - Bug] Stream age policy and worker shutdown proof were incomplete**
- **Found during:** Task 3 contract review
- **Issue:** `MAXLEN` bounded length but did not enforce 24-hour Stream age trimming; SIGTERM lacked lifecycle test.
- **Fix:** Added bounded `XTRIM MINID` and worker SIGTERM/close test.
- **Files modified:** `scripts/social-presence-worker.mjs`, `scripts/social-presence-worker.test.mjs`
- **Verification:** Worker lifecycle suite passes.
- **Committed in:** `d36a119`

**Total deviations:** 2 auto-fixed (2 bugs). **Impact:** Required queue safety corrections; no scope expansion.

## Verification

- PASS — 29 focused tests: queue, producer handoff, message/read routes, activity tracking exclusion, and worker lifecycle.
- PASS — required static SQL migration/test assertion.
- PASS — `--check-config` with inert local validation values; no Redis/Supabase network connection attempted.
- PASS — targeted ESLint for all Plan 15-03 owned code/tests.
- PASS — `npm run typecheck`.
- BLOCKED/OUT OF SCOPE — `npm run lint` retains 2 pre-existing errors at `src/app/share/[token]/page.tsx:23` and `src/legacy/loading/PageTransitionProvider.tsx:60`, plus 45 warnings; none from Plan 15-03 files.
- EXTERNAL REQUIRED — real Redis/Supabase worker and SQL proof remain unrun by design.

## Issues Encountered

- `node scripts/social-presence-worker.mjs --check-config` without deployment secrets correctly fails closed on missing `REDIS_URL`; inert local validation values proved config bounds only.
- Existing dirty planning reconciliation, Phase 16 artifacts, and `next-env.d.ts` were left untouched and unstaged. `STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md` were intentionally not updated to avoid committing concurrent planning reconciliation.

## User Setup Required

**External worker configuration required.** See [15-USER-SETUP.md](./15-USER-SETUP.md) for worker-only secrets, bounded settings, supervisor requirements, and evidence steps.

## Next Phase Readiness

- Plan 15-04 can consume closed producers and worker-backed durable activity without adding client queue integration.
- Plan 15-05 must capture approved external Redis/Supabase/worker/privacy/load evidence before Phase 15 validation.

## Self-Check: PASSED

---
*Phase: 15-social-presence-scaling*
*Completed: 2026-08-09*
