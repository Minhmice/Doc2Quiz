# Phase 15: Social Presence Scaling — validation contract

**Status:** Planning contract; external targets and worker deployment remain human prerequisites.
**Scope:** SCALE-01–10, Spike 001 partial findings, and Phase 14 baseline boundaries.

## Locked planning decisions

- **D15-01:** Presence sessions use Redis sorted set `d2q:presence-sessions:{userId}`, maximum 8 members, score `expiresAtMs`, bounded cleanup, and exact-key `MGET`. No Postgres session registry, `KEYS`, or unbounded `SCAN`.
- **D15-02:** Heartbeat limits are 4/user and 8/trusted-proxy-IP per 60 seconds. Typing update limits are 30/user and 60/trusted-proxy-IP per 60 seconds. Typing snapshot limits are 60/user and 120/trusted-proxy-IP per 60 seconds. Limiter outage returns 503, never Postgres fallback.
- **D15-03:** Meaningful events are presence transitions, successful direct-message sends, and successful conversation reads. Current study producers are explicitly excluded: `src/lib/client/activityTracking.ts::recordQuizCompletion` and `FlashcardSession` completion remain outside the social activity queue. Queue tests must prove no study-action event is emitted.
- **D15-04:** Repository owns `scripts/social-presence-worker.mjs` with `--once` and `--serve`. Deployment owner chooses external process manager/scheduler. Worker hosting, restart, health, network, lease recovery, and real Redis/SQL proof are blocking human prerequisites.
- **D15-05:** `/api/friends?presence=online|offline` remains server-owned destination vocabulary. Canonical `PresenceBucket` is `online | active_15m | active_today | offline | unknown`; canonical DTO owner is `src/lib/social/presenceTypes.ts`. No `recently_active` compatibility enum remains.
- **D15-06:** Missing `REDIS_URL` is explicit disabled state. Heartbeat returns structured degraded 503; snapshots become `unknown` after 15 seconds; durable message GET/POST/read stays Postgres-backed. No process-memory production fallback. Current accepted/block/participant authorization runs before Redis reads.
- **D15-07:** Client last-known state is a bounded 15-second presentation cache only. Server bucket/source/filter/sort/cursor remains authoritative. Realtime payloads only trigger authenticated HTTP reconciliation; no event payload becomes display state.

## Environment contract

Repository policy forbids editing `.env.example` in Phase 15. Plans document this contract; deployment supplies values through server configuration.

| Variable | Use | Safety rule |
|---|---|---|
| `REDIS_URL` | Server-only app/worker Redis connection | Never `NEXT_PUBLIC_*`; external deployment uses TLS/auth (`rediss://` or equivalent), Redis OSS 6.2+ |
| `REDIS_CONNECT_TIMEOUT_MS` | Redis connect bound | Default 1000 |
| `REDIS_COMMAND_TIMEOUT_MS` | Redis command bound | Default 1000 |
| `REDIS_RECONNECT_MAX_MS` | Reconnect backoff ceiling | Default 5000 |
| `SOCIAL_UNKNOWN_GRACE_MS` | Last-known grace | Exactly 15000 |
| `PHASE15_TEST_REDIS_URL` | Approved disposable Redis integration/load target | Requires `PHASE15_REDIS_TEST_CONFIRM=YES`; allowlisted host; never production/shared |
| `PHASE15_REDIS_TEST_CONFIRM` | Explicit Redis safety gate | Exact value `YES` |
| `PHASE15_TEST_DATABASE_URL` | Approved disposable Phase 15 SQL target | Requires `PHASE15_TEST_CONFIRM=YES`; never fallback to Phase 12 variable |
| `PHASE15_TEST_CONFIRM` | Explicit SQL safety gate | Exact value `YES` |
| `PHASE15_ALLOW_DISPOSABLE_TEST_HOST` | Explicit nonlocal disposable host allowlist | Required for nonlocal targets |
| `SOCIAL_WORKER_GROUP` | Stable Redis consumer group | External worker only |
| `SOCIAL_WORKER_CONSUMER` | Unique worker consumer ID | Unique per process |
| `SOCIAL_WORKER_BATCH_SIZE` | Bounded batch | Default 100, maximum 200 |
| `SOCIAL_WORKER_BLOCK_MS` | Bounded stream block | External worker only |
| `SOCIAL_WORKER_LEASE_MS` | `XAUTOCLAIM` idle lease | Default 30000 |
| `SOCIAL_WORKER_RETRY_BASE_MS` | Retry backoff base | External worker only |
| `SOCIAL_WORKER_MAX_RETRIES` | Poison threshold | Exactly 5 |
| `SOCIAL_WORKER_HEALTH_FILE` | Optional supervisor health record | Host-writable path, no secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker-only durable RPC credential | Never browser-exposed |

`PHASE12_TEST_DATABASE_URL` remains Phase 12-owned. Phase 15 scripts must not read, overwrite, or claim proof from it.

## Artifact and test ownership

Every artifact has one primary owner. The only intentional handoff is the explicitly requested `/api/friends/activity` compatibility seam: 15-01 owns its Redis-only contract and tests; 15-02 owns the meaningful producer attachment and updates the same test after 15-01 completes.

| Plan/task | Owned files | Own command | Must not invoke |
|---|---|---|---|
| 15-01 T0–T3 | `package.json`, `package-lock.json`, `src/lib/server/redis/client.ts`, `src/lib/server/redis/keys.ts`, `src/lib/server/social/rateLimit.ts`, `src/lib/server/social/rateLimit.test.ts`, `src/lib/server/social/presence.ts`, `src/lib/server/social/presence.test.ts`, `src/lib/server/social/observability.ts`, `src/lib/server/social/observability.test.ts`, `src/app/api/friends/presence/heartbeat/route.ts`, `src/app/api/friends/presence/heartbeat/route.test.ts`, `src/app/api/friends/activity/route.ts`, `src/app/api/friends/friends.route.test.ts` | `npx vitest run src/lib/server/social/rateLimit.test.ts src/lib/server/social/presence.test.ts src/lib/server/social/observability.test.ts "src/app/api/friends/presence/heartbeat/route.test.ts" src/app/api/friends/friends.route.test.ts -t "activity|heartbeat|rate|degraded|auth"` | 15-02+ tests/scripts |
| 15-02 T1 | `src/lib/social/presenceTypes.ts`, `presenceTypes.test.ts`, `src/lib/server/social/presenceSnapshot.ts`, `presenceSnapshot.test.ts`, `src/lib/server/friends/socialLists.ts`, `socialListQuery.ts`, `socialLists.test.ts`, `src/app/api/friends/route.ts` | `npx vitest run src/lib/social/presenceTypes.test.ts src/lib/server/social/presenceSnapshot.test.ts src/lib/server/friends/socialLists.test.ts` | client tests, worker, validator |
| 15-02 T2 | `src/lib/server/social/typing.ts`, `typing.test.ts`, `src/app/api/friends/messages/[conversationId]/typing/route.ts`, `src/app/api/friends/messages/[conversationId]/typing/route.test.ts`, `supabase/migrations/20260802000000_social_presence_typing.sql`, `supabase/tests/social_presence_typing.sql` | `npx vitest run src/lib/server/social/typing.test.ts "src/app/api/friends/messages/[conversationId]/typing/route.test.ts"` plus SQL mirror assertions inside `typing.test.ts` | 15-03 queue/worker tests |
| 15-02 T3 handoff | `src/lib/server/social/activityProducer.ts`, `src/lib/server/social/activityProducer.test.ts`, `src/app/api/friends/activity/route.ts`, `src/app/api/friends/friends.route.test.ts` | `npx vitest run src/lib/server/social/activityProducer.test.ts "src/app/api/friends/friends.route.test.ts" -t activity` | 15-03 queue/worker and 15-04 client/load tests |
| 15-03 T1–T3 | `src/lib/server/social/activityQueue.ts`, `src/lib/server/social/activityQueue.test.ts`, `scripts/social-presence-worker.mjs`, `scripts/social-presence-worker.test.mjs`, `supabase/migrations/20260802010000_social_activity_scaling.sql`, `supabase/schemas/70_functions.sql`, `supabase/tests/social_activity_scaling.sql`, `src/app/api/friends/messages/[conversationId]/route.ts`, `src/app/api/friends/messages/[conversationId]/route.test.ts`, `src/app/api/friends/messages/[conversationId]/read/route.ts`, `src/app/api/friends/messages/[conversationId]/read/route.test.ts`, `src/lib/client/activityTracking.test.ts` | `npx vitest run src/lib/server/social/activityQueue.test.ts scripts/social-presence-worker.test.mjs "src/app/api/friends/messages/[conversationId]/route.test.ts" "src/app/api/friends/messages/[conversationId]/read/route.test.ts" src/lib/client/activityTracking.test.ts` and `node scripts/social-presence-worker.mjs --check-config` | 15-04/15-05 tests/scripts |
| 15-04 T1 | `src/lib/client/friends.ts`, `src/lib/client/friends.test.ts`, `src/components/layout/FriendsMenu.tsx`, `src/components/layout/FriendsMenu.test.tsx`, `src/components/friends/FriendActionMenu.tsx`, `src/components/friends/FriendActionMenu.test.tsx`, `src/components/friends/DirectMessageDialog.tsx`, `src/components/friends/DirectMessageDialog.test.tsx`, `src/components/friends/FriendsHub.tsx`, `src/components/friends/FriendsHub.test.tsx` | `npx vitest run src/lib/client/friends.test.ts src/components/layout/FriendsMenu.test.tsx src/components/friends/FriendActionMenu.test.tsx src/components/friends/DirectMessageDialog.test.tsx src/components/friends/FriendsHub.test.tsx` | validator/load/evidence |
| 15-04 T2 | `src/lib/client/messages.ts`, `src/lib/client/presenceSession.ts`, `src/lib/client/presenceSession.test.ts`, `src/lib/client/typing.ts`, `src/lib/client/typing.test.ts`, `src/components/layout/AppShell.tsx`, `src/components/friends/PlayfulReactionOverlay.tsx`, `src/components/friends/TypingIndicator.tsx`, `src/components/friends/ConversationView.tsx`, `src/components/friends/ConversationView.test.tsx` | `npx vitest run src/lib/client/presenceSession.test.ts src/lib/client/typing.test.ts src/components/friends/ConversationView.test.tsx` | 15-05 scripts |
| 15-04 T3 | `src/components/friends/FriendsHub.tsx`, `src/components/friends/FriendsHub.test.tsx`, `src/components/friends/ConversationView.tsx`, `src/components/friends/ConversationView.test.tsx`, `src/lib/server/friends/realtimeBroadcast.ts`, `src/components/friends/realtime-invalidation.test.tsx`, `scripts/social-presence-load.mjs`, `src/lib/client/presenceSession.load.test.ts` | `npx vitest run src/components/friends/FriendsHub.test.tsx src/components/friends/ConversationView.test.tsx src/components/friends/realtime-invalidation.test.tsx src/lib/client/presenceSession.load.test.ts && node scripts/social-presence-load.mjs --help && node scripts/social-presence-load.mjs --check-schema` | external evidence |
| 15-05 T1 | `scripts/verify-phase15-social-presence.mjs`, `scripts/verify-phase15-social-presence.test.mjs` | `npx vitest run scripts/verify-phase15-social-presence.test.mjs && node scripts/verify-phase15-social-presence.mjs --check-config && node scripts/verify-phase15-social-presence.mjs --schema-test` | real Redis/SQL/browser/load |
| 15-05 T2 | none; 15-04 owns `scripts/social-presence-load.mjs` and `src/lib/client/presenceSession.load.test.ts` | no command; defer to 15-04 owned `node scripts/social-presence-load.mjs --help && node scripts/social-presence-load.mjs --check-schema` | external run unless human gate approved |
| 15-05 T3 | `.planning/phases/15-social-presence-scaling/15-LOAD-EVIDENCE.md` | no automated command; checkpoint records approved external evidence and then reruns validator | no fake pass for external evidence |

No plan edits `.env.example`. No alternate `/api/friends/typing/...` route exists. `src/lib/social/presenceTypes.ts` is the sole DTO/type owner. The stale consumer/test inventory is exact: `src/lib/client/friends.ts`, `FriendsMenu.tsx`, `FriendActionMenu.tsx`, `DirectMessageDialog.tsx`, `FriendsHub.tsx`, `ConversationView.tsx`, their named tests, and any `recently_active` fixtures in those files.

## Normative failure behavior

### Presence heartbeat/snapshot

| State | Heartbeat | Snapshot | Client behavior |
|---|---|---|---|
| Healthy | `204`; Redis `SET EX 60` | `200`, `source: redis`; live session `online`, otherwise server age buckets | Render server bucket |
| Degraded grace, <=15s | `503 {"error":"social_degraded","state":"unknown"}` | `200`, `source: last_known` | Bounded presentation cache only; no reclassification/filter/sort/cursor mutation |
| Degraded unknown, >15s | Same 503 | `200`, `source: unknown`, bucket `unknown` | Render unknown, never offline |
| Recovered | `204` | Next authenticated HTTP snapshot `source: redis` | Replace cache from server response; realtime cannot mutate state |

Healthy server age mapping: `<15m` → `active_15m`, `15m–<24h` → `active_today`, `>=24h` or null → `offline`. Destination `online` contains exactly `online`; destination `offline` contains `active_15m`, `active_today`, `offline`, and `unknown`. Server-issued cursor remains bound to destination, DTO version, and `(presenceRank, username, userId)` tuple.

### Typing

| State | Response | Behavior |
|---|---|---|
| Authorized healthy write | `204` | `typing` key TTL exactly 5s; `stopped` deletes key |
| Refresh under 2s | `429 {"error":"rate_limited","retryAfterSeconds":2}` and `Retry-After: 2` | No Redis mutation |
| Invalid/unauthorized | `400`, `401`, or generic `404 {"error":"social_unavailable"}` | Auth and participant/block checks precede Redis; no enumeration |
| Redis unavailable | POST `503` degraded; GET `200 {"data":{"state":"unknown","users":[]}}` | Never claim stopped; durable messages unaffected |

Canonical path everywhere: `/api/friends/messages/[conversationId]/typing/route.ts`.

### Durable activity

`d2q:activity` uses bounded `MAXLEN ~ 10000` and 24-hour age policy. Events contain only UUID `eventId`, authenticated `userId`, UTC `occurredAt`, closed `activityKind`, closed `source`, and deterministic `dedupeKey`. Worker batches 50–200 entries every 10–30 seconds, coalesces newest event per user/window/kind, calls service-role `apply_social_activity_batch`, and `XACK`s only after commit. Retryable failures remain pending for lease claim; poison events after exactly 5 attempts go to `d2q:activity:dead` then acknowledge. `private.social_activity(user_id)` is conflict target; older timestamps never move `last_active_at` backward.

Current study-action exclusion is executable: `recordQuizCompletion` and flashcard completion do not call the social queue, and `activityQueue.test.ts`/`activityTracking.test.ts` assert no `study_action` event. Queue emits only `presence_transition`, `message_sent`, and `conversation_read` from their exact successful server operations.

## Automated versus external evidence

Automated checks may prove repository contracts only: Vitest fake adapter/clock and route mocks, source/SQL static assertions, typecheck, lint targeting Phase 15 files, Spike simulation, validator schema/config checks, and load-harness schema. They cannot prove real TTL, provider latency, worker deployment, SQL runtime privacy, browser behavior, outage recovery, or capacity.

External/human evidence requires approved disposable targets and must be recorded in `15-LOAD-EVIDENCE.md`:

1. Real Redis TTL/index/MGET/throttle/reconnect and no `KEYS`/unbounded scan.
2. Approved disposable `PHASE15_TEST_DATABASE_URL` SQL privacy, durable upsert idempotency, worker RPC, and message independence.
3. External worker process with unique consumer, bounded `XREADGROUP`, `XAUTOCLAIM`, ack-after-commit, retries, dead-letter, SIGTERM, health, restart, and network access.
4. Two accepted accounts plus blocked/nonparticipant account; browser desktop/375px mobile presence, typing, privacy, last-known→unknown, message send/read/history/reconnect, and invalidation-only realtime.
5. Healthy 100-session and 1,000-session load, then Redis stop/latency/recovery.

## Load scenarios and thresholds

| Scenario | Parameters | Required thresholds |
|---|---|---|
| Healthy 100 | Ramp 10 sessions/s; 120s; 18–22s randomized heartbeats; snapshot 20%/cadence; typing 5% at 2–5s; message send/read 1% each | Heartbeat Postgres fallback writes 0; heartbeat success >=99%; non-abusive 429 0; abusive structured 429 >=99%; heartbeat p95 <=500ms/p99 <=1000ms; snapshot p95 <=750ms/p99 <=1500ms; typing expiry 5s ±1s; queue oldest <=30s; duplicate durable rows 0; no scan |
| Healthy 1,000 | Ramp 10 sessions/s to 100 sessions/s; 120s; cross 60s TTL and two 30s worker windows; same mix | Same thresholds; report Redis command/key counts, Postgres calls/writes per heartbeat, batch/retry/dead-letter counts, capacity caveats |
| Outage/recovery | Stop Redis or inject bounded latency after healthy run; observe 15s grace and recovery | Last-known <=15s then unknown; typing unknown/empty not stopped; message send/read >=99%; no Postgres fallback flood; worker drains idempotently after recovery |

Evidence JSON schema must include `runId`, UTC timestamps, target class/version, machine/Node/Redis/provider versions, scenario, ramp, duration, concurrency, cadence/jitter, page/session/batch limits, request/status/error counts, p50/p95/p99, Redis command/key/latency/reconnect counts, Postgres calls/writes per heartbeat, queue age/batches/retries/dead letters, TTL/expiry checks, privacy outcomes, outage/recovery timestamps, threshold results, redaction scan, and caveats. It must reject URLs with credentials, message bodies, raw Redis values, tokens, session IDs, and IP addresses.

## Spike 001 partial mapping

| Spike partial | Owning plan/artifact | Evidence row |
|---|---|---|
| No Redis client/service/config | 15-01 adapter, package, documented env contract | Automated config plus external Redis |
| No worker/deployment contract | 15-03 worker; 15-05 checkpoint | Worker deployment prerequisite |
| Real TTL/latency/reconnect absent | 15-01 fake tests; 15-05 harness | Redis integration |
| 1,000-session load absent | 15-05 load harness | Healthy 100/1,000 rows |
| Privacy simulated only | 15-02 auth/SQL contracts | SQL and two-account rows |
| Retry/idempotency absent | 15-03 queue/worker/SQL | Claim/ack/retry/dead-letter rows |
| Outage messaging absent | 15-04 message regression/client state | Browser outage/recovery row |
| Observability recommended only | 15-01 metric seam; 15-05 validator/evidence | Metric/redaction/load rows |

## Phase 14 baseline

Phase 14 focused behavior was green. Known unrelated baseline debt remains separate: legacy aggregate fixtures (`incoming.items is not iterable` and four retired response-shape failures), repository lint errors in `src/app/share/[token]/page.tsx` and `src/legacy/loading/PageTransitionProvider.tsx`, existing warnings, and Phase 12/14 runtime SQL blocked without `PHASE12_TEST_DATABASE_URL`. Phase 15 focused tests must pass cleanly; no Phase 15 task may weaken or rewrite those baseline fixtures.

## Requirement traceability

| Requirement | Automated owner | External/human proof |
|---|---|---|
| SCALE-01 | 15-01 heartbeat unit/route/static no RPC | Real 60s TTL and zero heartbeat DB writes |
| SCALE-02 | 15-01 presence; 15-04 session cadence | 100/1,000 cadence/reconnect |
| SCALE-03 | 15-02 DTO/snapshot; 15-04 cache/recovery | Real outage/browser buckets |
| SCALE-04 | 15-02 route/SQL privacy | Disposable SQL and two-account privacy |
| SCALE-05 | 15-02 typing unit/route; 15-04 client | Real TTL/throttle/browser |
| SCALE-06 | 15-02 producer; 15-03 queue/worker/SQL | External worker drain/retry/idempotency |
| SCALE-07 | 15-01 limiter; 15-02 typing | Real normal/abuse traffic |
| SCALE-08 | 15-01 degraded; 15-04 messages/cache | Redis outage message success/no fallback |
| SCALE-09 | 15-04 FriendsHub/ConversationView/realtime tests | Browser stale-payload reconciliation |
| SCALE-10 | 15-02 bounded snapshot/static | Runtime command/key bounds |

## Final gate

Phase 15 status is `VALIDATED` only when focused automated evidence is clean, validator schema passes, `15-LOAD-EVIDENCE.md` has every required automated/external row, approved targets and worker runtime are recorded, browser/privacy checks pass, healthy 100/1,000 scenarios and outage/recovery thresholds pass, and all caveats are explicit. Missing external prerequisites produce `BLOCKED_PREREQUISITE`, never a simulated pass.
