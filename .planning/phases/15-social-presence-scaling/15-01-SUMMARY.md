---
phase: 15-social-presence-scaling
plan: 01
subsystem: social-presence
tags: [redis, presence, rate-limit, nextjs, vitest]
requires:
  - phase: 14-friend-presence-and-chat-layout-repair
    provides: authenticated friend and messaging routes
provides:
  - Redis-backed bounded presence session contract and fixed-window limiter
  - Authenticated Redis-only heartbeat route with degraded and rate-limited responses
  - Redis-only activity compatibility seam for Plan 15-02 producer handoff
affects: [15-02, 15-03, 15-04, 15-05]
actuals:
  tokens: 7000
  tasks: 4
  commits: 4
tech-stack:
  added: [redis@6.2.0]
  patterns: [server-only Redis adapter, bounded exact-key presence reads, Redis-only social degradation]
key-files:
  created:
    - src/lib/server/redis/client.ts
    - src/lib/server/redis/keys.ts
    - src/lib/server/social/rateLimit.ts
    - src/lib/server/social/presence.ts
    - src/lib/server/social/observability.ts
    - src/app/api/friends/presence/heartbeat/route.ts
  modified:
    - src/app/api/friends/activity/route.ts
    - src/app/api/friends/friends.route.test.ts
key-decisions:
  - "Missing or unavailable Redis returns social_degraded/unknown with no Postgres fallback."
  - "Presence discovery uses a maximum-eight-member sorted-set index and exact MGET keys."
  - "Activity route remains a Redis-only compatibility seam until 15-02 attaches meaningful activity production."
patterns-established:
  - "Social routes authenticate before Redis access and use Redis-only fixed-window limits."
  - "Redis metrics redact URLs, credentials, values, tokens, session IDs, and IPs."
requirements-completed: [SCALE-01, SCALE-02, SCALE-07, SCALE-08, SCALE-10]
coverage:
  - id: D1
    description: "Bounded Redis presence adapter, session index, fixed-window limits, and redacted metric seam"
    requirement: SCALE-01
    verification:
      - kind: unit
        ref: "npx vitest run src/lib/server/social/rateLimit.test.ts src/lib/server/social/presence.test.ts src/lib/server/social/observability.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Authenticated Redis-only heartbeat with 204, 429 Retry-After, and degraded 503 contracts"
    requirement: SCALE-07
    verification:
      - kind: unit
        ref: "src/app/api/friends/presence/heartbeat/route.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Redis-only activity compatibility seam with zero durable activity RPC calls"
    requirement: SCALE-08
    verification:
      - kind: unit
        ref: "src/app/api/friends/friends.route.test.ts#activity"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real Redis TTL, reconnect, and bounded-command behavior"
    requirement: SCALE-10
    verification: []
    human_judgment: true
    rationale: "Requires approved disposable Redis target; deferred to Phase 15 external evidence."
duration: 29min
completed: 2026-08-09
status: complete
---

# Phase 15 Plan 01: Redis contracts, heartbeat, rate limiting, observability, and activity seam Summary

**Redis-backed bounded presence sessions, fail-closed rate limits, authenticated heartbeat endpoint, and Redis-only activity compatibility path.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-08-09T01:20:00Z
- **Completed:** 2026-08-09T01:49:07Z
- **Tasks:** 4
- **Files modified:** 14

## Accomplishments

- Added approved `redis@6.2.0` behind a server-only, timeout-bounded adapter with disabled and unavailable states.
- Added 60-second opaque per-session presence keys, maximum-eight session index, exact-key `MGET`, fixed-window user/IP limits, and redacted metric seam.
- Added authenticated heartbeat and converted activity compatibility route to Redis-only behavior with 204, structured 429, and structured degraded 503 contracts.

## Task Commits

1. **Task 1: Add bounded Redis adapter, keys, limits, and metric seam** — `fd2e662` (`feat`)
2. **Task 2: Add heartbeat endpoint and owned route test** — `63f5d9e` (`feat`)
3. **Task 3: Convert activity route to Redis-only compatibility seam** — `b15f3ec` (`feat`)
4. **Task 1 correction: isolate Redis rate counters** — `435ca03` (`fix`)

## Files Created/Modified

- `package.json` / `package-lock.json` — approved `redis@6.2.0` dependency.
- `src/lib/server/redis/client.ts` — server-only Redis singleton, health, timeouts, reconnect policy.
- `src/lib/server/redis/keys.ts` — validated namespaced keys and bounded presence constants.
- `src/lib/server/social/{rateLimit,presence,observability}.ts` — bounded social Redis contracts.
- `src/app/api/friends/presence/heartbeat/route.ts` — authenticated heartbeat endpoint.
- `src/app/api/friends/activity/route.ts` — Redis-only compatibility heartbeat seam.

## Decisions Made

- Redis unavailability returns `{ error: "social_degraded", state: "unknown" }`; no process-memory or Postgres fallback exists.
- Fixed-window limiter keys include scope, subject kind, subject, and window to isolate user/IP counters.
- Activity seam uses server-derived compatibility session ID and does not enqueue meaningful activity; Plan 15-02 owns producer attachment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rate-limit key initially omitted subject value**
- **Found during:** Final static/contract review
- **Issue:** Same subject class shared one counter in a fixed window.
- **Fix:** Added subject to `d2q:rate` key and strengthened test assertion.
- **Files modified:** `src/lib/server/redis/keys.ts`, `src/lib/server/social/rateLimit.test.ts`
- **Verification:** Focused Vitest suite and `npm run typecheck` pass.
- **Committed in:** `435ca03`

---

**Total deviations:** 1 auto-fixed (1 bug). **Impact:** Required correctness fix; no scope expansion.

## Verification

- PASS — focused plan Vitest command: 20 selected tests passed; 31 nonmatching tests skipped.
- PASS — static assertions found no `touch_social_activity`, `KEYS`, scan usage, or Supabase import in heartbeat/activity routes.
- PASS — focused Phase 15 lint.
- PASS — `npm run typecheck`.
- BLOCKED/OUT OF SCOPE — repository-wide `npm run lint` has 2 pre-existing errors in `src/app/share/[token]/page.tsx` and `src/legacy/loading/PageTransitionProvider.tsx`, plus 45 warnings.

## Issues Encountered

- `npm install redis@6.2.0` reported 17 existing dependency audit vulnerabilities; no unapproved package was installed.
- External Redis proof is unavailable without approved disposable target; captured in `15-USER-SETUP.md` and deferred to Plan 15-05 evidence.

## User Setup Required

**External Redis configuration required.** See [15-USER-SETUP.md](./15-USER-SETUP.md).

## Next Phase Readiness

- Plan 15-02 can consume Redis adapter/presence contracts and attach meaningful activity producer to activity seam.
- Real Redis TTL, reconnect, bounded-command, privacy, and load proof remains a blocking human prerequisite for Phase 15 validation.

---
*Phase: 15-social-presence-scaling*
*Completed: 2026-08-09*
