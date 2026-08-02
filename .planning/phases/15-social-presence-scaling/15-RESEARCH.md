# Phase 15: Social Presence Scaling - Research

**Researched:** 2026-08-02
**Domain:** Redis-backed ephemeral social presence, typing indicators, durable activity batching, Next.js Route Handlers, Supabase/PostgreSQL
**Confidence:** HIGH for repository architecture and protocol; MEDIUM for production Redis/load behavior until disposable Redis target exists

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

No phase-specific CONTEXT.md was present. Locked project decisions from `.planning/STATE.md` and the Phase 15 request apply:

- Redis owns hot per-session presence and conversation typing state; Postgres receives only batched durable activity.
- Accepted friends see presence/activity; conversation participants see typing; blocked users see none.
- Redis failure keeps last-known state briefly, then returns `unknown`; never increases Postgres write frequency and never blocks messaging.
- Existing authenticated HTTP snapshots remain display authority; realtime remains invalidation-only.
- No WebSocket gateway unless load evidence proves HTTP/realtime fan-out insufficient.

### Claude's Discretion

- Select exact Redis client/module boundaries, key names, rate-limit windows, batch size, worker deployment shape, and observability implementation while preserving locked decisions and SCALE-01–10.
- Select focused unit, route, integration, and load validation needed to prove the success criteria.

### Deferred Ideas (OUT OF SCOPE)

- Dedicated WebSocket gateway or direct client truth from Redis event payloads; revisit only after measured evidence.
- Replacing durable direct-message history, Supabase auth, Supabase RPC privacy boundaries, or cursor-based HTTP snapshots.
- Unbounded presence history, exact activity text, raw Redis-value logging, or a new social transport protocol.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCALE-01 | Presence heartbeats use Redis ephemeral session keys with a 60-second TTL and do not write to PostgreSQL on every heartbeat. | Per-session `presence:{userId}:{sessionId}` keys, `SET ... EX 60`, and heartbeat route with no RPC call. |
| SCALE-02 | Presence heartbeats run through stateless Next.js Route Handlers at a bounded cadence near 20 seconds; multiple sessions aggregate into one user status. | Client cadence near 20 seconds, idempotent POST handler, and `MGET`/known-session key aggregation. |
| SCALE-03 | Presence snapshots expose coarse buckets (`online`, `active_15m`, `active_today`, `offline`) and return `unknown` during stale or Redis-unavailable periods instead of falsely reporting offline. | Snapshot DTO and failure state machine define bucket mapping and `unknown` behavior. |
| SCALE-04 | Presence and current activity are returned only to authenticated accepted friends; blocked users receive no presence data. | Existing auth-first Route Handler plus server-side accepted-friend and block checks before Redis reads. |
| SCALE-05 | Typing indicators use conversation-scoped Redis keys with a five-second TTL, refresh no more than once every two seconds, and are visible only to conversation participants. | `typing:{conversationId}:{userId}` contract, atomic throttle, and participant authorization. |
| SCALE-06 | Meaningful social activity is queued for batched durable upserts to `private.social_activity` every 10–30 seconds; Next.js request handlers do not own worker timers or in-process queue state. | Redis Stream producer in handlers and separate worker consumer with retry/idempotent upsert. |
| SCALE-07 | Presence and typing endpoints enforce per-user/IP rate limits and return structured `429` responses with `Retry-After` when limits are exceeded. | Redis fixed-window/token counter keys and shared response mapper. |
| SCALE-08 | Redis failures do not block durable messaging; social UI keeps last-known presence briefly, then shows `unknown`, and never increases PostgreSQL write frequency as a fallback. | Explicit Redis degradation state machine; message route remains Postgres RPC path and broadcast best-effort. |
| SCALE-09 | Realtime events only invalidate or accelerate authenticated HTTP reconciliation; Redis event payloads never become direct client truth. | Supabase Realtime invalidation remains unchanged; snapshot endpoint owns displayed values. |
| SCALE-10 | Presence friend snapshots use bounded batched Redis reads and avoid unbounded key scans such as `KEYS` in request paths. | Fetch page from bounded SQL, derive exact session keys, issue one `MGET`/pipeline; never scan Redis in request path. |
</phase_requirements>

## Summary

Phase 15 should move only hot, short-lived social state out of PostgreSQL. Authenticated Next.js Route Handlers write per-session presence keys and conversation-scoped typing keys to Redis; a bounded HTTP snapshot joins those Redis values with the existing accepted-friend/conversation authorization and profile data. PostgreSQL remains authoritative for durable friendship, blocks, conversations, messages, and the `private.social_activity` row. Existing Supabase Realtime channels continue to signal invalidation only, preserving Phase 12 and Phase 14 decisions. [VERIFIED: repository inspection] [CITED: https://nextjs.org/docs/app/building-your-application/routing/route-handlers] [CITED: https://redis.io/docs/latest/develop/clients/nodejs/]

Use `redis` (`node-redis`) as the only new runtime package, behind a server-only singleton/factory with explicit connection health and bounded command timeouts. Redis keys must be namespaced, TTL-backed, and addressed from IDs already authorized by Postgres. Presence snapshots should query a bounded SQL page first, then use `MGET` for exact per-session keys; they must not discover keys with `KEYS` or an unbounded `SCAN`. A separate worker or managed scheduled job must consume a Redis Stream and batch idempotent durable activity updates every 10–30 seconds. [VERIFIED: npm registry] [CITED: https://redis.io/docs/latest/develop/clients/nodejs/] [CITED: https://redis.io/docs/latest/commands/mget/] [CITED: repository spike]

The spike simulation passes TTL, multi-session aggregation, typing throttle, batching, privacy, and `unknown` semantics, but real Redis integration and 1,000-session load remain unvalidated. Planning must include disposable Redis provisioning, failure injection, worker retry evidence, and load measurements before marking the phase fully validated. [VERIFIED: repository spike] Production latency/throughput remains external evidence only; no provider capacity claim is made by repository tests.

**Primary recommendation:** Add a small server-only Redis adapter plus four authenticated HTTP endpoints, preserve existing Postgres/Realtime boundaries, and run durable activity through an external Redis Stream worker with idempotent 10–30 second batches.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Presence heartbeat writes | API / Backend | Redis / Storage | Auth, validation, rate limits, and TTL write belong in Route Handler; Redis owns ephemeral value. |
| Presence snapshot aggregation | API / Backend | Database / Storage | Postgres determines authorized bounded friend page; API merges Redis session state into DTO. |
| Typing updates and reads | API / Backend | Redis / Storage | Conversation membership must be checked server-side; Redis owns five-second state. |
| Durable activity queue | API / Backend | Redis / Storage, worker | Request publishes compact event; external worker owns consumption, retries, and batch timing. |
| Durable activity record | Database / Storage | Worker | `private.social_activity` remains durable display fallback and must not be written per heartbeat. |
| Realtime invalidation | API / Backend | Supabase Realtime / Browser | Broadcast only prompts authenticated HTTP reconciliation; payload never becomes display truth. |
| Presence rendering and cadence | Browser / Client | API / Backend | Client schedules roughly 20-second heartbeat and renders server DTO buckets; server enforces contracts. |

## Current State

### Existing implementation

- `POST /api/friends/activity` currently authenticates with `requireApiUser()` then calls `touch_social_activity` on every accepted request. 15-01 replaces this with Redis-only presence touch; 15-02 attaches the meaningful producer after Redis success; 15-04 removes the client caller. The SQL RPC remains durable activity infrastructure, not heartbeat path. [VERIFIED: repository inspection]
- `private.social_activity(user_id primary key, last_active_at)` is private and currently indexed by `last_active_at`. `list_social_friends(integer,jsonb,text)` joins it and derives Phase 14 `online`/`recently_active`/`offline` rows before keyset pagination. [VERIFIED: repository inspection]
- `src/lib/client/messages.ts` exposes `touchSocialActivity()`. `PlayfulReactionOverlay.tsx` calls it on mount, focus, visible-document recovery, and a 60-second interval. The Phase 15 client cadence must replace or supplement this with a session heartbeat near 20 seconds without causing duplicate legacy DB touches. [VERIFIED: repository inspection]
- `/api/friends` authenticates first, parses bounded query values, then calls `listSocialFriends`. The existing SQL output and client DTO only expose three display states (`online`, `recently_active`, `offline`), while SCALE-03 requires four coarse buckets plus `unknown`; plan a versioned DTO or carefully additive mapping, not a silent enum break. [VERIFIED: repository inspection]
- Direct message GET/POST uses authenticated Postgres RPCs and cursor history. POST broadcasts `social-messages:{conversationId}` and `social-counts:{recipientId}` through Supabase Realtime; `ConversationView` reconciles HTTP history after subscription, invalidation, focus, and visibility recovery. Messaging must remain independent of Redis. [VERIFIED: repository inspection]
- No Redis dependency, `REDIS_URL`, worker command, or Redis service exists. `package.json` has Next.js 16.2.11, React 19.2.8, Zod 4.4.3, Vitest 3.2.4; `redis` is absent. [VERIFIED: repository inspection]
- Phase 14 verified bounded friend pagination, enum-only row visuals, shared chat rendering, and HTTP-authoritative reconciliation at source/unit level. Live SQL, two-account, and browser checks remain human-needed; preserve that boundary. [VERIFIED: Phase 14 verification]

### Existing architectural boundary to preserve

```text
Browser heartbeat / typing intent
        |
        v
Authenticated Next.js Route Handler -- auth, zod, privacy, rate limit
        |
        +--> Redis SET/MGET/stream (hot ephemeral or queued event)
        |
        +--> HTTP response DTO (only display authority)
        |
        +--> Supabase Realtime invalidate (optional, no state payload)

Browser snapshot request
        |
        v
/api/friends or typing snapshot
        |
        +--> Postgres RPC: bounded authorized IDs/page
        +--> Redis MGET exact keys for those IDs
        +--> coarse DTO: online/active_15m/active_today/offline/unknown

External worker (separate process/job)
        |
        v
Redis Stream consumer group --> compact/dedupe events --> Postgres RPC/upsert
```

## Constraints

1. Decision D15-06 resolves local Redis behavior: absent `REDIS_URL` creates a disabled adapter, route heartbeat returns `503 { error: "social_degraded", state: "unknown" }`, snapshot responses use `source: "unknown"` after the 15-second grace policy, and direct message GET/POST/read continue through existing Postgres RPCs. Local Docker is the documented disposable proof path; no process-memory production fallback. [VERIFIED: project decision]
2. Route Handlers are request handlers using Web Request/Response APIs and support `runtime = "nodejs"`; timers, worker loops, and in-process queue state do not belong in the request module. [CITED: https://nextjs.org/docs/app/building-your-application/routing/route-handlers]
3. Auth and privacy checks must happen before protected Redis reads/writes. Do not let user-provided `userId` or `conversationId` authorize access; ask Postgres RPCs for membership and use the authenticated `auth.uid()`. [VERIFIED: repository SQL/auth boundary]
4. Accepted-friend visibility excludes blocked users. Conversation typing visibility requires accepted conversation participants. Treat denied and nonexistent relationships as the same generic unavailable response to avoid relationship enumeration. [VERIFIED: repository SQL and STATE]
5. HTTP snapshots stay display authority. Realtime can trigger `refetch`, never set presence/typing/message values from its payload. [VERIFIED: STATE and Phase 14 verification]
6. Snapshot work must be bounded by requested page size and session IDs. Never issue `KEYS`; never scan all user/session keys in a request path. [CITED: https://redis.io/docs/latest/commands/mget/]
7. Durable activity is meaningful/coarsened, not every heartbeat. Worker retries must be idempotent and bounded; a Redis outage cannot increase Postgres write frequency. [VERIFIED: SCALE requirements and spike]
8. Do not log message bodies, typing payloads, raw Redis values, session IDs, auth tokens, or IP addresses. Structured metrics may include counts, status, latency, route, and failure class. [VERIFIED: spike observability contract; security recommendation]

## Recommended Architecture

### 1. Server-only Redis adapter

Create a narrow module such as `src/lib/server/redis/client.ts` or `src/lib/server/social/redis.ts`:

- Read server-only `REDIS_URL`; fail closed to a disabled adapter when absent, with health state `disabled`, not an import-time throw.
- Use `createClient({ url: process.env.REDIS_URL })`, attach an error listener, connect once per Node process, and expose `isReady`/health. `node-redis` is Redis's documented/recommended Node.js client and supports URL connection plus `set`, `get`, hashes, and `mGet`. [CITED: https://redis.io/docs/latest/develop/clients/nodejs/]
- Keep adapter methods narrow: `setPresence`, `readPresence`, `readPresenceBatch`, `setTyping`, `readTyping`, `rateLimit`, `enqueueActivity`, `claimActivityBatch`, `ackActivity`, `retryActivity`.
- Do not expose a generic Redis command executor to route code. Validate IDs and TTLs at adapter boundary.
- Set command/connect timeouts appropriate to route latency; on timeout return typed `RedisUnavailable`, record metric, and let caller apply failure policy.
- In tests, inject a fake adapter/clock. Do not import a real client into Vitest unit tests.

Use exact version `redis@6.2.0` when implementing: npm registry reports current version `6.2.0`, MIT license, repository `redis/node-redis`, modified `2026-07-31T19:58:58.027Z`; Redis official docs prescribe `npm install redis`. [VERIFIED: npm registry] [CITED: https://redis.io/docs/latest/develop/clients/nodejs/]

### 2. Presence heartbeat

Add `POST /api/friends/presence/heartbeat` as the canonical session-aware presence contract and keep `POST /api/friends/activity` as the Redis-only compatibility adapter until the client caller migration in 15-04. Canonical planning shape:

```text
POST /api/friends/presence/heartbeat
Request: { sessionId: opaque client-generated ID, activity?: "idle" | "studying" | "chatting" }
Response 204 or { data: { accepted: true, expiresInSeconds: 60 } }
```

- Require authenticated user first.
- Validate `sessionId` as bounded opaque safe text; never accept arbitrary Redis key syntax or a target user ID.
- Apply per-user and per-IP limit before Redis write. A normal client cadence near 20 seconds should pass; duplicate/replay abuse should receive `429` with `Retry-After`.
- `SET presence:{userId}:{sessionId} <compact JSON> EX 60` on each accepted heartbeat. Store only `activity` and server timestamp if needed; user ID/session ID are already key coordinates. [CITED: https://redis.io/docs/latest/commands/set/]
- Enqueue only the closed meaningful events from D15-03 after the corresponding operation succeeds. Do not call `touch_social_activity` from heartbeat or compatibility route.
- Browser owns stable session ID per tab/device and stops heartbeat when hidden/logout; server TTL remains the correctness backstop. Avoid relying on Next.js process memory for session registration.

The spike sets `PRESENCE_TTL_MS = 60_000`, while SCALE-02 asks cadence near 20 seconds. Plan a client interval around 20 seconds with visibility/focus immediate heartbeat, jitter to avoid synchronized bursts, and expiry after three missed cadences. [VERIFIED: requirements and spike]

### 3. Presence snapshot

Keep `/api/friends` as the display-authoritative snapshot endpoint. Preferred server flow:

1. Authenticate with `requireApiUser()`.
2. Parse `limit`, cursor, and presence destination using existing `parseFriendsListQuery`.
3. Ask Postgres/RPC for a bounded page of accepted, unblocked friend IDs, profile fields, and durable `last_active_at`. This preserves current keyset ordering and privacy.
4. Derive exact `presence:{friendUserId}:{knownSessionId}` keys only if session IDs are available from a bounded registry; otherwise maintain a bounded per-user session index (for example `presence:sessions:{userId}` with expiring members) and trim/remove stale entries. Never discover keys via `KEYS` or unbounded `SCAN`.
5. Issue one `MGET` or pipeline for those exact keys. Redis `MGET` is O(N) in requested key count and returns aligned nil values for missing keys. [CITED: https://redis.io/docs/latest/commands/mget/]
6. Aggregate `online` if any session key is live. If no live session, use durable activity age for `active_15m`, `active_today`, or `offline`; if Redis health is stale/unavailable, return `unknown` rather than `offline` during the configured grace policy.
7. Return only allowlisted DTO fields. Preserve cursor tuple semantics; cursor must bind to destination/presence version if bucket membership changes.

Decision D15-01 resolves bounded session discovery: use Redis sorted set `d2q:presence-sessions:{userId}` with member `{sessionId}` and score `expiresAtMs`; cap index at 8 sessions per user, prune scores below `now` and retain only newest 8 members, then derive at most 8 exact presence keys for one bounded `MGET`. Do not add a Postgres session registry and never use `KEYS` or unbounded `SCAN`. Real Redis TTL/index behavior remains external evidence, not an unresolved design question.

Recommended DTO:

```typescript
type PresenceBucket = "online" | "active_15m" | "active_today" | "offline" | "unknown";
type PresenceSnapshot = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  presence: PresenceBucket;
  activity: "idle" | "studying" | "chatting" | null;
  lastActiveAt: string | null;
};
```

Decision D15-05 resolves the DTO transition: keep `/api/friends?presence=online|offline` as the two server-owned destinations, replace `recently_active` with canonical `PresenceBucket = online | active_15m | active_today | offline | unknown`, and add `PresenceSource = redis | last_known | unknown`. `src/lib/social/presenceTypes.ts` owns `ConversationView`-independent DTOs and cursor/page types. `FriendsHub` and every stale consumer/test listed in `15-VALIDATION.md` migrate to imports from that file. The server owns bucket, filter, sort, and cursor; client last-known state is bounded presentation cache only and cannot reclassify, filter, sort, or mutate cursor. Realtime payloads remain invalidation-only. No compatibility enum remains after migration.

### 4. Typing indicators

Add participant-scoped endpoints, preferably:

```text
POST /api/friends/messages/{conversationId}/typing
Request: { state: "typing" | "stopped" }
Response: 204

GET /api/friends/messages/{conversationId}/typing
Response: { data: { users: [{ userId: string, state: "typing", expiresAt: string }] } }
```

- Authenticate before parsing `conversationId` and body.
- Call an existing protected RPC or a new narrow RPC to prove the authenticated user participates in the conversation and remains an accepted, unblocked friend. Do not trust a client-supplied participant list.
- Store `typing:{conversationId}:{userId}` with `SET ... EX 5` for `typing`; delete on `stopped` when possible. A missing key means not typing.
- Enforce server-side refresh throttle of 2 seconds per conversation/user. Use an atomic Redis counter/window or Lua/function-backed compare-and-set so multiple Next.js instances cannot bypass it. A rejected refresh returns `429`, `Retry-After: 2`.
- Keep snapshot reads bounded by the known two conversation participants; do not scan `typing:*`.
- Never send message body or raw Redis values through Realtime. A typing invalidation may trigger GET reconciliation, but HTTP response remains truth.

Use Redis key names with a fixed namespace and no user-controlled segments beyond validated UUID/opaque IDs:

| Key | Value | TTL | Owner |
|-----|-------|-----|-------|
| `d2q:presence:{userId}:{sessionId}` | compact activity/timestamp JSON | 60s | heartbeat route |
| `d2q:presence-sessions:{userId}` | bounded session index | bounded/cleanup | heartbeat + snapshot |
| `d2q:typing:{conversationId}:{userId}` | `1` or compact state | 5s | typing route |
| `d2q:typing-throttle:{conversationId}:{userId}` | last-accepted timestamp/window | 2s minimum | typing route |
| `d2q:rate:{scope}:{subject}:{window}` | counter | window TTL | shared limiter |
| `d2q:activity` | Redis Stream entries | retention policy | request producer/worker |

Key prefixes and stream names are implementation choices; centralize them in one module. Do not expose them to clients.

### 5. Durable activity queue and worker

Use Redis Streams for request-to-worker handoff. Redis documents Streams as an append-only log suitable for event processing and consumer groups; use `XADD` from the request and `XREADGROUP`/acknowledgement in an external worker. [CITED: https://redis.io/docs/latest/develop/data-types/streams/]

Request producer:

- Emit only compact fields: `eventId` (UUID), `userId`, `occurredAt`, `activityKind`, and optional bounded source enum. Do not emit message bodies or exact typing content.
- Use a deterministic event ID and dedupe key. A presence request may enqueue at most one meaningful transition per coarse window; ordinary TTL refreshes must not create one stream entry each.
- Apply stream max length/retention so Redis memory cannot grow without bound. Keep a metric for queued, trimmed, failed, and oldest age.

Worker:

1. Claim messages from one consumer group in bounded batches, for example 50–200 entries.
2. Coalesce by `userId`, keeping newest meaningful event per user in current batch. Set/update durable `last_active_at` through a service-role RPC or parameterized Postgres operation.
3. Upsert with event/window dedupe. The database operation must be safe to retry; duplicate delivery after worker crash must not create extra rows or move time backwards.
4. Acknowledge only after the database transaction succeeds. On transient database error, retain pending entry for retry; on poison payload, move to a bounded dead-letter stream and emit an alert rather than hot-looping.
5. Run as a separate process, managed scheduled job, or platform worker. No `setInterval`/long-lived consumer loop inside `src/app/api/**` Route Handlers. [CITED: Next.js Route Handlers docs; repository spike]
6. Target a 10–30 second flush window, but measure queue age and batch size. Use a lease/claim timeout so crashed workers do not lose entries.

Decision D15-03 resolves durable activity: preserve `private.social_activity(user_id primary key,last_active_at)`, expose one service-role-only `apply_social_activity_batch(jsonb)` RPC, coalesce by `(user_id, activity_window, activity_kind)`, update only when incoming `occurredAt` is newer, and use `user_id` as the conflict target. Retain bounded Stream entries with `MAXLEN ~ 10000` and age policy `24h`; move poison entries after 5 attempts. No client table grant. Update `supabase/schemas/70_functions.sql` mirror and SQL tests with the migration.

### 6. Rate limits

Decision D15-02 resolves rate limits: heartbeat allows 4 accepted requests/user and 8/trusted-proxy-IP per 60 seconds; typing updates allow 30/user and 60/trusted-proxy-IP per 60 seconds; typing snapshots allow 60/user and 120/trusted-proxy-IP per 60 seconds. Same-conversation typing refresh still requires 2 seconds. Limits are Redis-only; limiter outage returns structured 503 and never falls back to Postgres. Use server-generated keys and fixed windows:

| Operation | Suggested limit | Window | Response |
|-----------|-----------------|--------|----------|
| Presence heartbeat | 4 accepted requests/user and 8/IP | 60s | `429`, `Retry-After` until window reset |
| Typing refresh | 30/user and 60/IP | 60s, plus 2s same conversation throttle | `429`, `Retry-After` |
| Typing snapshot | 60/user and 120/IP | 60s | `429`, `Retry-After` |

The limits are implementation decisions for this phase. Automated fake-adapter tests prove them; external load evidence measures normal traffic and abuse behavior. Deployment may tune values only by updating the contract and focused tests together.

Return stable JSON and header:

```json
{ "error": "rate_limited", "retryAfterSeconds": 12 }
```

Set `Retry-After: 12`, never leak Redis error details, and reuse existing client mapping (`SocialRateLimitedError`) where possible. On limiter Redis failure, choose fail-open only for low-risk heartbeat/typing writes if abuse controls remain elsewhere, or fail-closed with `503` if policy demands it; document the selected policy. Do not convert Redis outage into a Postgres write fallback.

### 7. Failure state machine

Use explicit health states instead of treating a missing Redis value as offline:

```text
HEALTHY
  Redis command succeeds
  -> snapshot = online if any session key live
  -> no live session = durable coarse bucket

DEGRADED_GRACE
  Redis command fails/timeouts
  -> retain in-memory/client last-known snapshot for UNKNOWN_GRACE_MS (spike: 15s)
  -> response marks state as last_known or unknown-source metadata, never fabricated offline

DEGRADED_UNKNOWN
  grace expires without successful Redis read
  -> presence = unknown
  -> typing = empty/unknown, never claim stopped from missing Redis
  -> messaging remains available through existing Postgres RPCs

RECOVERING
  Redis health returns
  -> next authenticated HTTP snapshot is authoritative
  -> reconcile and replace last-known/unknown; do not replay stale client events as truth

QUEUE_BACKLOG
  worker or Postgres unavailable
  -> retain pending stream entries, retry with bounded backoff/claim lease
  -> keep chat send/read independent; alert on queue age/dead-letter count
```

Recommended semantics: API can attach non-display metadata such as `source: "redis" | "last_known" | "unknown"`; client renders only the server bucket. Do not return `offline` merely because `MGET` returned nil during a known Redis failure. A browser may keep its last rendered value for at most the grace window, then must render `unknown`.

### 8. Realtime and client integration

Decision D15-07 fixes client ownership: `src/lib/social/presenceTypes.ts` is canonical DTO owner; `src/lib/client/friends.ts`, `src/components/layout/FriendsMenu.tsx`, `src/components/friends/FriendActionMenu.tsx`, `src/components/friends/DirectMessageDialog.tsx`, and `src/components/friends/FriendsHub.tsx` are stale consumers to migrate. `ConversationView` consumes message DTOs and typing DTOs but never treats event payloads as display state. Client last-known is a bounded 15-second presentation cache only; server bucket/source/cursor remains authoritative. `FriendsHub` tests must prove `ConversationView`-independent `ConversationView` realtime invalidation and `FriendsHub` HTTP reconciliation, with no event payload promoted to display state.

- Keep `src/lib/server/friends/realtimeBroadcast.ts` as best-effort invalidation. If presence/typing invalidation is added, use private topics whose authorization mirrors friend/conversation membership.
- Keep `ConversationView` HTTP reconciliation model. A subscription callback may call `listDirectMessages` or typing snapshot, not mutate state from broadcast payload.
- Extend `FriendsHub` refresh cadence only after snapshot contract is ready. Its current 60-second refresh and five-minute transition timer are compatible with coarse server buckets but should not locally move rows between buckets.
- Replace `PlayfulReactionOverlay`'s 60-second `touchSocialActivity` timer with a reusable presence session heartbeat controller near 20 seconds. Keep focus/visibility behavior and cleanup; avoid one heartbeat per component instance by placing controller at authenticated app-shell scope.
- Preserve `src/lib/client/friends.ts` `Retry-After` parsing and `SocialRateLimitedError`; add typed presence/typing DTOs without duplicating bucket parsing.
- Realtime should accelerate reconciliation after a durable activity batch or meaningful presence transition only if needed. Broadcasts must contain `{ source: "presence" }`/`{ source: "typing" }`, not user state payloads.

## Exact Files / Modules / Routes Likely Affected

| Path | Planned responsibility |
|------|------------------------|
| `package.json`, lockfile | Add `redis@6.2.0`; add worker/load commands only if implementation proves needed. |
| Deployment secrets/config (not repository `.env.example`) | Define server-only `REDIS_URL`, timeout/retention/limit settings, and worker connection settings through deployment configuration; repository policy forbids editing `.env.example` in Phase 15. Never expose via `NEXT_PUBLIC_*`. |
| `src/lib/server/redis/client.ts` (new) | Singleton/factory, health, reconnect/error handling, injected adapter contract. |
| `src/lib/server/redis/keys.ts` (new) | Namespace, key builders, validated IDs, TTL constants. |
| `src/lib/server/social/rateLimit.ts` (new) | Per-user/IP counters, atomic increment/expiry, `Retry-After` calculation. |
| `src/lib/server/social/presence.ts` (new) | Heartbeat write, session index, bounded read/aggregation, coarse bucket mapper, last-known policy. |
| `src/lib/server/social/typing.ts` (new) | Participant authorization integration, throttle, TTL write/delete, bounded snapshot. |
| `src/lib/server/social/activityQueue.ts` (new) | Stream producer and compact event/dedupe contract. |
| `src/lib/server/social/observability.ts` (new or existing logger) | Metrics/correlation IDs with redaction. Avoid abstraction if existing logger already fits. |
| `src/app/api/friends/presence/heartbeat/route.ts` (new or `activity/route.ts`) | Authenticated POST, body validation, rate limit, Redis write, 204/429/503 contract. |
| `src/app/api/friends/route.ts` | Merge bounded Postgres friend rows with Redis presence; preserve auth-first errors and cursor behavior. |
| `src/app/api/friends/messages/[conversationId]/typing/route.ts` (new) | Authenticated POST/GET typing state, participant scope, 2s throttle, 5s TTL. This is the only canonical typing route. |
| `src/app/api/friends/messages/[conversationId]/route.ts` | Preserve durable GET/POST; optional invalidation only; never make Redis required for send/read. |
| `src/lib/client/messages.ts` | Presence heartbeat and typing fetch/update clients; retain durable message transport. |
| `src/lib/client/friends.ts` | Presence bucket DTO, `unknown` mapping, 429 handling, compatibility response parsing. |
| `src/components/friends/FriendsHub.tsx` | Reconcile snapshots; do not infer/move membership client-side. |
| `src/components/friends/ConversationView.tsx` | Typing controller/snapshot reconciliation; preserve durable history and realtime invalidation. |
| `src/components/friends/PlayfulReactionOverlay.tsx` or app-shell provider | Remove legacy per-minute DB heartbeat and mount one near-20s session controller. |
| `src/components/layout/AppShell.tsx` | Likely stable location for authenticated heartbeat lifecycle if no existing provider is suitable. |
| `supabase/migrations/<timestamp>_phase15_social_scaling.sql` | Durable activity RPC/dedupe support, membership helper if needed, privacy/grant updates. |
| `supabase/schemas/70_functions.sql`, `supabase/schemas/80_rls.sql` | Schema mirrors and private table/grant proof. |
| `supabase/tests/phase15_social_presence.sql` (new) | Static/runtime SQL auth, block, participant, function signature, and grant proof. |
| `scripts/social-presence-worker.mjs` or worker entrypoint | Separate Stream consumer; only if repository deployment supports a worker process. |
| `scripts/social-presence-load.mjs` or `scripts/phase15-load.mjs` | Reproducible 100/1,000 session load and failure injection using Node built-ins or verified load tool. |
| `src/lib/server/social/*.test.ts`, route tests, client/component tests | Fake Redis/clock contract, route privacy/rate limits, failure state machine, DTO/realtime invariants. |

Do not create every listed file automatically. Start with existing route/client boundaries and add a module only when it owns a real testable contract.

## Data Contracts

### Presence

```typescript
type PresenceActivity = "idle" | "studying" | "chatting";
type PresenceHeartbeatInput = {
  sessionId: string;
  activity?: PresenceActivity;
};
type PresenceBucket = "online" | "active_15m" | "active_today" | "offline" | "unknown";
type PresenceRow = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  presence: PresenceBucket;
  activity: PresenceActivity | null;
  lastActiveAt: string | null;
};
```

Heartbeat: authenticated user identity comes from `requireApiUser`, never from body. `sessionId` is bounded and opaque. `activity` is enum-only. Snapshot rows are allowlisted and privacy-filtered.

### Typing

```typescript
type TypingInput = { state: "typing" | "stopped" };
type TypingUser = { userId: string; state: "typing"; expiresAt: string };
type TypingSnapshot = { users: TypingUser[] };
```

Do not include usernames/avatars unless the existing authorized conversation DTO already supplies them; client can join by participant data. Do not expose arbitrary user IDs outside a verified conversation participant set.

### Activity stream

```typescript
type ActivityEvent = {
  eventId: string;
  userId: string;
  occurredAt: string;
  activityKind: "presence_transition" | "message_sent" | "conversation_read";
  source: "heartbeat" | "message" | "client";
  dedupeKey: string;
};
```

Only include event kinds that genuinely update `last_active_at`; avoid adding typing refreshes and passive snapshot reads. Event IDs/dedupe keys must be persisted or encoded in an idempotent upsert contract.

## Redis TTL / Key / Rate-Limit Strategy

- Presence key TTL: exactly 60 seconds. Client cadence target: approximately 20 seconds with jitter and lifecycle refresh. [VERIFIED: SCALE-01/02]
- Typing key TTL: exactly 5 seconds. Accepted refresh spacing: at least 2 seconds. [VERIFIED: SCALE-05]
- Unknown grace: spike simulation uses 15 seconds; lock exact production value during planning and test it with a fake clock. [VERIFIED: spike]
- Activity stream: exact bounded retention is `MAXLEN ~ 10000` plus age policy `24h`; oldest-entry age alert is `30s`; no unbounded retention. External load evidence measures whether these bounds fit deployment capacity.
- Rate limiting: separate per-user and per-IP keys; never trust `x-forwarded-for` blindly. Use deployment's trusted proxy configuration, normalize one client IP, and avoid logging it.
- Atomicity: use Redis atomic `INCR` plus `EXPIRE` initialization for fixed windows, or a Lua/function script if increment/expiry must be one atomic operation. Use equivalent atomic compare-and-set for two-second typing throttle.
- Bounded reads: Postgres returns page IDs; Redis reads exact key list with `MGET`/pipeline. Cap page and session index sizes; reject oversized query limits using existing Zod parser.

## Worker / Batching Strategy

Decision D15-04 resolves worker shape: repository owns one external Node worker entrypoint, `scripts/social-presence-worker.mjs`, with `--once` and `--serve`; deployment chooses process manager/scheduler outside repository. `--serve` is a long-lived external process, never a Route Handler timer. Human deployment proof must record consumer identity, restart, SIGTERM, health, network, `XREADGROUP`, `XAUTOCLAIM`, `XACK` after durable success, retry, and dead-letter evidence. Missing deployment/Redis proof is a blocking human prerequisite, not an unresolved architecture decision. [CITED: https://redis.io/docs/latest/develop/data-types/streams/]

- Producer adds compact D15-03 event to `d2q:activity`; meaningful events only.
- Worker reads bounded batch every 10–30 seconds, coalesces newest event per user, invokes a dedicated durable RPC with service-role authorization, then acknowledges successful entries.
- Duplicate delivery is expected. Dedupe by deterministic `(user_id, activity_window)` or event marker; update only when incoming timestamp is newer. Retry transient failures with backoff; dead-letter poison entries after bounded attempts.
- Worker shutdown/restart must leave unacked entries recoverable by consumer-group claim/lease. Metrics must expose batch size, queue age, retries, dead letters, and DB latency.
- If deployment cannot run a worker yet, use a managed scheduled job with the same queue/ack contract; do not replace it with in-process `setInterval` or per-request durable activity writes.

## Privacy / Auth Boundaries

1. `requireApiUser()` remains first operation in each authenticated Route Handler.
2. Presence target IDs come only from authenticated Postgres friend-list RPC rows; accepted friendship and block exclusion remain server-side.
3. Typing route verifies conversation membership via the protected conversation RPC/helper before Redis access. Accepted friendship must still hold; block revocation invalidates access.
4. Return generic `social_unavailable`/`404` for unauthorized relationship, nonexistent conversation, and blocked cases; do not reveal which condition failed.
5. Redis contains only short-lived IDs/activity enums; no message bodies, tokens, profiles, or relationship grants.
6. Worker uses server-only credentials; no Redis or service-role credential reaches browser bundles or client-callable environment variables.
7. Realtime private-topic authorization stays aligned with current SQL policy. Event payloads contain only invalidation source.

## Observability

Emit structured counters/timers with request correlation ID and route/outcome labels, never raw values:

- `presence_heartbeats_accepted`
- `presence_heartbeats_rate_limited`
- `presence_snapshot_unknown`
- `presence_snapshot_last_known`
- `presence_snapshot_redis_errors`
- `typing_updates_accepted`
- `typing_updates_rate_limited`
- `typing_snapshot_reads`
- `activity_events_queued`
- `activity_events_deduped`
- `activity_batch_size`
- `activity_batch_failures`
- `activity_queue_oldest_age_seconds`
- `activity_dead_letters`
- `redis_latency_ms`
- `redis_reconnects`
- `social_route_5xx`

Measure p50/p95/p99 route latency, Redis command latency, Postgres calls per heartbeat, queue age, batch write count, and message send success during Redis outage. Load evidence must show Postgres heartbeat writes remain zero (or unchanged legacy migration count) while Redis handles target traffic.

## Failure State Machine

| State | Redis | Presence snapshot | Typing | Messaging | Recovery |
|-------|-------|-------------------|--------|-----------|----------|
| Healthy | Ready | Redis aggregate plus durable bucket | Live keys | Normal Postgres RPC | — |
| Degraded grace | Timeout/error | Client/API last-known only within grace; never fabricated offline | Empty/last-known only within explicit grace, no false stopped claim | Normal | Retry next snapshot; metric/error count |
| Degraded unknown | Unavailable past grace | `unknown` | Empty or `unknown` metadata | Normal | Redis health recovery then HTTP reconciliation |
| Queue backlog | Stream/worker delayed | Last successful durable state plus Redis if available | Live Redis if available | Normal | Retry/claim pending entries, alert queue age |
| Recovered | Ready again | Fresh HTTP snapshot replaces stale state | Fresh typing snapshot | Normal | No client event replay as truth |

## Testing / Load Validation Plan

### Contract tests

- Fake clock + fake Redis adapter proves presence key expiry at 60s, two simultaneous sessions aggregate online, one expired session does not force offline while another remains, and all sessions expired remove online state.
- Typing tests prove participant-only access, five-second expiry, 2-second refresh rejection, stop/delete behavior, and no key scan.
- Rate-limit tests prove user/IP counters, `429` JSON, integer `Retry-After`, window reset, and no Postgres fallback.
- Failure tests prove Redis timeout returns last-known only during grace, then `unknown`; direct message POST still invokes durable RPC and does not await Redis.
- Cursor/DTO tests prove page-bound Redis reads, no blocked rows, bucket compatibility, and no client-side bucket inference.

### Route and SQL tests

- Extend route tests modeled on `src/app/api/friends/friends.route.test.ts` and existing `social-lists.route.test.ts`: auth-first behavior, malformed session/conversation IDs, privacy denial, rate limit, Redis unavailable, and generic error mapping.
- Add `supabase/tests/phase15_social_presence.sql` to assert durable activity function signatures, authenticated-only grants, private-table revocation, participant/block predicates, and idempotent newest-timestamp behavior. Run only against approved local/disposable DB; current Phase 14 verification records `PHASE12_TEST_DATABASE_URL` unavailable.
- Update `supabase/schemas/70_functions.sql` and `80_rls.sql` mirrors with each migration; static proof must match exact current signatures.

### Integration and browser checks

- Start disposable Redis and app with `REDIS_URL`; run heartbeat from two sessions, inspect TTL behavior through adapter/integration tests, and verify snapshot buckets across 0/1/2 live sessions.
- Use two accepted accounts plus blocked/nonparticipant accounts. Verify accepted friend sees status/activity, blocked account gets generic unavailable/no row, participant sees typing, nonparticipant does not.
- Open desktop and mobile chat; verify typing expiry, message send/read/history/reconnect while Redis is stopped. Expected: chat continues, presence moves to `unknown` after grace, no PostgreSQL heartbeat flood.
- Verify Realtime invalidation triggers fresh HTTP GET and payload contents cannot directly alter displayed presence/typing/message state.

### Load evidence

1. Baseline: record Postgres writes and route/Redis latency with Redis healthy and heartbeat disabled/current implementation.
2. Target: 100, then 1,000 concurrent sessions, client heartbeat around 20s with randomized jitter, bounded friend snapshots, and a representative typing workload. Run long enough to cross TTL and 10–30s worker batches.
3. Assertions: no per-heartbeat Postgres writes; accepted heartbeat rate; Redis p95/p99; snapshot p95/p99; bounded Redis command/key count; queue oldest age; batch count lower than event count; no `KEYS`; no privacy leaks.
4. Fault injection: stop Redis, add latency, reconnect; verify last-known grace then `unknown`, 429 behavior remains structured, message sends/read continue, and worker drains after recovery without duplicates.
5. Record machine/provider, Node version, Redis version, concurrency, cadence, page size, batch size, duration, error rate, and raw aggregate metrics in a phase artifact. Do not claim production capacity from local Docker alone.

## Likely Implementation Sequence

1. Add Redis URL/config and server-only adapter with fake implementation, key builders, health, and metrics seam.
2. Add heartbeat route/client controller and remove legacy frequent DB heartbeat call; prove 60s TTL, 20s cadence, multiple sessions, and rate limits.
3. Adapt bounded friend snapshot merge and DTO compatibility; prove accepted/block scope, `unknown`, and MGET boundedness.
4. Add typing route/client controller and participant/privacy tests; keep Realtime invalidation-only.
5. Add activity stream producer, durable idempotent RPC/migration, worker entrypoint, and recovery/dead-letter tests.
6. Add load harness/disposable Redis runbook and capture 100/1,000-user evidence.
7. Run targeted Vitest, SQL proof on approved DB, typecheck/lint/build, then Phase 14 manual regression. Do not mark phase complete until Redis outage and load assertions pass.

## Common Pitfalls

### Pitfall 1: Treating Redis nil as offline
**What goes wrong:** Redis outage or timeout looks identical to no active session, falsely showing a friend offline.
**Why it happens:** Missing values are normal Redis semantics and command errors are swallowed into empty arrays.
**How to avoid:** Carry Redis health separately from values; use last-known grace, then `unknown`.
**Warning signs:** `presence_snapshot_unknown` absent during outage, or all rows suddenly become offline.
**Confidence:** HIGH — locked failure policy and spike contract.

### Pitfall 2: Unbounded session discovery
**What goes wrong:** Snapshot scans global Redis keys or reads an unbounded user session list.
**Why it happens:** Per-session keys need an index for aggregation; `KEYS` is tempting during initial implementation.
**How to avoid:** bounded session index plus exact `MGET`/pipeline; cap members and clean stale entries.
**Warning signs:** Redis command count grows with global key count, `KEYS` appears in source, p99 rises with unrelated users.
**Confidence:** HIGH — SCALE-10 and Redis command guidance.

### Pitfall 3: Worker in Route Handler
**What goes wrong:** queue timers vanish on deployment restart or multiply across instances; events are lost/duplicated.
**Why it happens:** Route Handler code is convenient but request instances are not a worker contract.
**How to avoid:** external worker/managed job with consumer group, ack, claim lease, retry, and dead-letter behavior.
**Warning signs:** no durable process identity, queue age cannot be observed, duplicate updates after scale-out.
**Confidence:** HIGH — SCALE-06 and spike.

### Pitfall 4: Realtime payload becomes UI authority
**What goes wrong:** forged/stale event payload directly changes status or typing.
**Why it happens:** broadcast arrives faster than HTTP and looks like complete state.
**How to avoid:** event only schedules authenticated snapshot reconciliation.
**Warning signs:** client sets state from broadcast `payload`, or test passes without HTTP snapshot.
**Confidence:** HIGH — STATE and Phase 14 verification.

### Pitfall 5: Auth after Redis access
**What goes wrong:** attacker probes typing/presence keys or relationship existence.
**Why it happens:** key lookup seems cheaper than database authorization.
**How to avoid:** auth and relationship RPC first; generic denial response; Redis access second.
**Warning signs:** route accepts target IDs before `requireApiUser`, or adapter method receives unauthenticated request.
**Confidence:** HIGH — existing auth/RPC pattern.

### Pitfall 6: Rate limit allows synchronized heartbeat bursts
**What goes wrong:** 1,000 clients reconnect/focus simultaneously and overload Redis or handler.
**Why it happens:** fixed client interval without jitter and no per-IP limit.
**How to avoid:** client jitter, server per-user/IP limits, bounded body and response, observe p95/p99.
**Warning signs:** sharp periodic latency spikes at cadence boundaries.
**Confidence:** MEDIUM — recommended scaling practice; verify in load run.

### Pitfall 7: Idempotency absent in stream worker
**What goes wrong:** worker retry duplicates durable activity or moves `last_active_at` backward.
**Why it happens:** acknowledgement occurs before DB commit or upsert only checks row existence.
**How to avoid:** ack after commit; deterministic event/window dedupe; newest timestamp update only.
**Warning signs:** duplicate rows/metrics, retry changes timestamp backward.
**Confidence:** HIGH — success criteria and spike.

### Pitfall 8: Legacy client heartbeat remains active
**What goes wrong:** new Redis heartbeat and old durable activity caller run together, inflating Postgres writes and confusing tests.
**Why it happens:** old activity touch is embedded in reaction overlay lifecycle.
**How to avoid:** one app-shell-owned controller; delete/retire old call or turn it into a compatibility no-op after migration.
**Warning signs:** legacy durable activity caller still appears in browser lifecycle path after 15-04 migration.
**Confidence:** HIGH — repository inspection.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redis protocol/client | Custom TCP/client wrapper | `redis` (`node-redis`) | Official Redis Node client handles connection, command encoding, readiness, reconnect options. |
| Redis bounded batch reads | Key discovery/scanning helper | `MGET` or pipelined exact keys | Bounded O(N) read aligned to authorized page. |
| Durable queue | In-process array/setTimeout queue | Redis Streams consumer group + external worker | Survives request process churn and supports ack/retry/claim. |
| Authorization | Redis-only friend/conversation ACL cache | Existing Supabase auth + protected RPCs | Durable relationship/block state remains authoritative. |
| UI truth | Realtime payload state reducer | Authenticated HTTP snapshot/reconciliation | Prevents stale/forged event state. |
| Rate limiting | Process-local Map | Redis atomic counter/window | Works across stateless Next.js instances; process-local state disappears on scale-out. |
| Input validation | Manual string checks scattered in routes | Existing Zod route schemas | Consistent bounds and malformed-input behavior. |

**Key insight:** Fewest new moving parts wins: one official Redis client, one adapter, existing Supabase privacy RPCs, one external worker. Do not build a WebSocket service or generic cache framework before load evidence demands it.

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory exists in the repository. No repository-local directives were found. Existing project constraints come from `.planning/STATE.md`, Phase 14 verification, and current auth/RPC patterns above.

## Runtime State Inventory

This is a migration from Postgres-backed activity to Redis-backed hot state, so runtime state must be checked explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `private.social_activity` stores one durable `last_active_at` row per user. | Keep table; migrate heartbeat writer to queue/worker. No destructive data migration. |
| Live service config | No Redis service/config found in repository; Supabase Realtime private topics and SQL policies exist. | Provision disposable then production Redis; verify private Realtime policies remain unchanged. |
| OS-registered state | No project evidence of worker/task registration. | Verify deployment/host scheduler before worker rollout; register external worker only there. |
| Secrets/env vars | `.env.example` has no `REDIS_URL`; Supabase server credentials already exist outside client env. | Document env contract in plan/validation only; deployment owner supplies server-only `REDIS_URL` and worker config; never `NEXT_PUBLIC_`. |
| Build artifacts / installed packages | No `redis` dependency in `package.json`; `.next` contains generated dev artifacts and is untracked. | Add lockfile dependency; do not commit generated `.next`; rebuild after install. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Postgres `touch_social_activity` on client activity cadence | Redis per-session TTL keys plus batched durable activity | Phase 15 target, 2026-08 | Removes hot writes while retaining durable fallback. |
| One coarse `isOnline`/five-minute timestamp | Server-authoritative coarse buckets plus explicit `unknown` | SCALE-03 / Phase 14→15 | Avoids false offline during cache failure and supports bounded UI destinations. |
| Broadcast complete message/status payload as UI state | Broadcast invalidation, then authenticated HTTP reconciliation | Phase 12 decision | Preserves authorization and durable display authority. |
| Process-local queue/timer | External Stream worker with consumer group and retries | SCALE-06 | Survives stateless handler scaling and restarts. |

**Deprecated/outdated for this phase:**
- Calling the legacy durable activity endpoint from every client lifecycle event after Redis heartbeat migration.
- Reading raw Redis payloads directly in browser or using Redis key scans in request paths.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-user session index will use bounded sorted-set/member cleanup or an equivalent bounded registry. | Presence snapshot | Wrong choice can make multi-session reads unbounded or inaccurate. |
| A2 | Suggested rate limits (4/user heartbeat per 60s, 8/IP, 30/user typing per 60s) fit client traffic and deployment proxy behavior. | Rate limits | Too strict blocks normal clients; too loose permits abuse. |
| A3 | Redis Stream consumer groups and the selected managed worker platform are available in deployment. | Worker strategy | May require a different managed queue while preserving external-worker contract. |
| A4 | `redis@6.2.0` API/configuration remains compatible with the repository's Node 25 runtime and deployment runtime. | Standard Stack | Package/runtime incompatibility blocks installation or requires pinned Node version. |
| A5 | A single exact `unknown` grace value of 15 seconds is acceptable for product UX. | Failure state machine | Too short/long changes stale-state behavior and test expectations. |
| A6 | Existing social RPC can expose enough authorized friend/session metadata or can be extended without leaking it. | Snapshot architecture | Need a new narrow server RPC if current friend rows lack session index inputs. |

## Open Questions

All six prior questions are resolved by explicit decisions below. They remain only as traceability labels; none is unresolved design work.

1. **Where does bounded session discovery live?**
   - Decision D15-01: Redis sorted-set index `d2q:presence-sessions:{userId}`, maximum 8 session members, score is `expiresAtMs`; bounded cleanup and exact-key MGET only. No Postgres registry, KEYS, or unbounded SCAN. External Redis proof validates TTL/index behavior.

2. **What deployment runs the worker?**
   - Decision D15-04: repository provides one external Node worker entrypoint with `--once` and `--serve`; deployment operator chooses host/process manager outside repository. External worker/Redis proof is a blocking human prerequisite and cannot be replaced by static config or simulation.

3. **What is the canonical SCALE-03 DTO transition?**
   - Decision D15-05: keep two server destinations, replace `recently_active` with five-value `PresenceBucket`, add `PresenceSource`, and migrate all stale consumers/tests to `src/lib/social/presenceTypes.ts`. No client inference or compatibility enum remains.

4. **What happens when Redis is absent in local development?**
   - Decision D15-06: absent `REDIS_URL` is a disabled adapter state for local/unit checks; heartbeat returns structured degraded 503, snapshots transition to unknown after 15 seconds, and durable messages remain Postgres-backed. Docker is the disposable real-Redis proof path; no in-memory fallback.

5. **Which events are meaningful activity?**
   - Decision D15-03: enqueue `presence_transition` from the canonical heartbeat route only when activity changes, `message_sent` after `send_direct_message` succeeds, and `conversation_read` after `mark_direct_conversation_read` succeeds. Explicitly exclude current study producers: `src/lib/client/activityTracking.ts::recordQuizCompletion` and `src/components/flashcards/FlashcardSession.tsx::completeStudySession`; task-level tests assert neither calls the social queue and no `study_action` event is serializable. Do not enqueue typing refreshes, passive snapshots, or focus. Each event uses closed kind/source, server timestamp, UUID, and deterministic 30-second dedupe key.

6. **What are accepted privacy semantics after relationship changes?**
   - Decision D15-06: authorize every snapshot/typing read through current durable accepted-friend, participant, and block checks before Redis access; block/unfriend revocation denies immediately, regardless of Redis TTL or client last-known cache.
   - Generic `social_unavailable`/404 hides denied versus nonexistent relationships. Redis stores only short-lived IDs/activity enums; it never grants access.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js, worker, load scripts | ✓ | 25.2.1 | Use repository-pinned deployment runtime if different; verify compatibility. |
| npm | package/install/registry verification | ✓ | 11.6.2 | — |
| Docker | disposable Redis/load validation | ✓ | 29.6.1 | Managed Redis target; Docker preferred locally. |
| Redis server | TTL/integration/load proof | ✗ | `redis-cli` absent; server not verified | Start disposable Redis via Docker or use approved managed target. |
| `redis` npm package | Node Redis adapter | ✓ registry only | 6.2.0 | No production fallback; disabled adapter only for local/unit tests. |
| Supabase/PostgreSQL target | SQL/privacy/runtime proof | ? | `PHASE12_TEST_DATABASE_URL` not set per Phase 14 verification | Approved local/disposable target required; never use production/shared DB. |
| Vitest | focused unit/route/component tests | ✓ | 3.2.4 from `package.json` | — |
| Playwright | browser/manual automation support | ✓ | 1.52.0 from `package.json` | Manual browser checks. |
| `redis-cli` | optional CLI inspection | ✗ | — | Node integration script or Docker exec; do not block implementation. |

**Missing dependencies with no fallback:**
- Approved disposable Redis/Supabase targets are not currently configured; live integration/load proof is blocked until provisioned.

**Missing dependencies with fallback:**
- `redis-cli` can be replaced by Docker Redis commands or Node adapter integration tests.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` — Node environment, `@` alias |
| Quick run command | `npx vitest run <focused-test-files>` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---------|----------|-----------|-------------------|-------------|
| SCALE-01 | Presence key writes with 60s TTL; no heartbeat RPC/DB call | unit + route | `npx vitest run src/lib/server/social/presence.test.ts src/app/api/friends/presence/heartbeat/route.test.ts` | ❌ Wave 0 |
| SCALE-02 | 20s client cadence, stateless route, multi-session aggregation | unit + browser | `npx vitest run src/lib/server/social/presence.test.ts src/components/layout/PresenceHeartbeat.test.tsx` | ❌ Wave 0 |
| SCALE-03 | Coarse buckets and `unknown` failure semantics | unit + route | `npx vitest run src/lib/server/social/presence.test.ts src/app/api/friends/route.test.ts` | Existing route needs extension; new unit ❌ |
| SCALE-04 | Accepted friends only; blocked users excluded | route + SQL | `npx vitest run src/app/api/friends/friends.route.test.ts src/lib/server/social/presence.test.ts` | Existing route; new tests ❌ |
| SCALE-05 | Typing 5s TTL, 2s throttle, participants only | unit + route | `npx vitest run src/lib/server/social/typing.test.ts "src/app/api/friends/messages/[conversationId]/typing/route.test.ts"` | 15-02 |
| SCALE-06 | Stream enqueue, 10–30s external batch, idempotent retry | unit + worker/integration | `npx vitest run src/lib/server/social/activityQueue.test.ts scripts/social-presence-worker.test.ts` | ❌ Wave 0 |
| SCALE-07 | User/IP limits, 429 JSON, Retry-After | unit + route | `npx vitest run src/lib/server/social/rateLimit.test.ts src/app/api/friends/presence/heartbeat/route.test.ts` | ❌ Wave 0 |
| SCALE-08 | Redis failure unknown grace; messages continue | integration + route | `npx vitest run src/lib/server/social/failurePolicy.test.ts src/app/api/friends/messages/[conversationId]/route.test.ts` | ❌ new failure test; message route exists |
| SCALE-09 | Realtime only invalidates; HTTP remains truth | component + route | `npx vitest run src/components/friends/ConversationView.test.tsx src/components/friends/FriendsHub.test.tsx` | Existing tests need additions |
| SCALE-10 | Bounded MGET and no `KEYS`/unbounded scan | unit + static | `npx vitest run src/lib/server/social/presence.test.ts` plus `rg -n "\bKEYS\b|scan\(" src/lib/server/social src/app/api/friends` | New unit ❌ |

### Sampling Rate

- **Per task commit:** `npx vitest run <focused-test-files>`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** focused suite, full suite, typecheck, lint, build, disposable Redis integration, approved SQL proof, and 100/1,000-user load evidence green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] Add fake Redis adapter/clock fixtures and `src/lib/server/social/presence.test.ts` — SCALE-01/02/03/10.
- [ ] Add heartbeat route/client cadence tests — SCALE-01/02/07.
- [ ] Add typing adapter/route tests — SCALE-05/07.
- [ ] Add activity queue/worker tests with duplicate/retry/dead-letter cases — SCALE-06.
- [ ] Add failure policy and message independence tests — SCALE-08.
- [ ] Add Realtime payload-invalidation tests — SCALE-09.
- [ ] Provision disposable Redis integration harness and approved SQL target — SCALE-01–10 runtime evidence.
- [ ] Add load harness and metrics artifact format — success criteria 1,000 concurrent sessions.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireApiUser()`/Supabase Auth before every endpoint; worker uses server-only credentials. |
| V3 Session Management | yes | Authenticated server session; opaque bounded client session ID never treated as auth. |
| V4 Access Control | yes | Existing accepted-friend/block and conversation-participant SQL checks before Redis access. |
| V5 Input Validation | yes | Zod schemas for bounded session IDs, activity/state enums, UUIDs, limits, cursors. |
| V6 Cryptography | yes | Do not hand-roll tokens or encryption; rely on Supabase auth and TLS Redis URL/provider configuration. |
| V7 Error Handling and Logging | yes | Generic relationship failures; structured redacted metrics; no raw message/Redis values. |
| V8 Data Protection | yes | Redis TTLs, no message bodies, private table grants, server-only secrets. |
| V13 API and Web Service | yes | Per-user/IP rate limits, `429`/`Retry-After`, bounded payloads and reads. |

### Known Threat Patterns for Next.js + Redis + Supabase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User-controlled target/session key | Tampering / Information disclosure | Auth first, validate IDs, derive target IDs from authorized RPC results, central key builders. |
| Blocked user reads stale key | Information disclosure | Durable block check on every snapshot/typing read; no Redis-only ACL. |
| Redis outage interpreted as offline | Tampering / availability | Health-aware `unknown` state and last-known grace. |
| Heartbeat/typing flood | Denial of service | User/IP atomic rate limits, body limits, jitter, metrics, 429. |
| Stream duplicate/lost activity | Tampering / availability | Ack after DB commit, idempotent newest-only upsert, claim lease, dead-letter. |
| Redis key/value logging | Information disclosure | Redacted structured counters; never log raw key/value/session/IP. |
| Realtime forged/stale payload | Tampering | Private topics and HTTP reconciliation authority. |
| Cross-instance process state | Availability / repudiation | External Redis counters/queue; no in-memory limiter/worker/timer contract. |

## Sources

### Primary (HIGH confidence)

- [Redis node-redis guide](https://redis.io/docs/latest/develop/clients/nodejs/) — official client recommendation, install, connection, readiness, SET/GET/MGET examples.
- [Redis MGET command](https://redis.io/docs/latest/commands/mget/) — O(N) bounded batch read, nil alignment, Node API.
- [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/) — stream/consumer-group basis for external batching (planner should verify exact command examples against selected Redis version).
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) — current Route Handler API, Node runtime segment config, request/response model.
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast) — existing invalidation transport; current repository SQL policies and client usage remain the concrete authority.
- Repository artifacts: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/spikes/001-redis-social-presence-scaling/README.md`, `validate.mjs`, Phase 14 verification, current source and SQL migrations.

### Secondary (MEDIUM confidence)

- npm registry metadata for `redis@6.2.0`: package current version, modified date, repository, license; combined with official Redis docs and `slopcheck scan redis --pkg npm` `[OK]`. [VERIFIED: npm registry]

### Tertiary (LOW confidence)

- No unverified WebSearch-only architectural claims retained as requirements. Exact provider limits, proxy IP trust, worker deployment, and rate numbers remain assumptions below.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `redis@6.2.0` | npm | 15+ years (package created 2010-12-30; current release 2026-07-31) | Not queried in this session | `github.com/redis/node-redis` | [OK] | Approved; official Redis docs also recommend package |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Code Examples

### node-redis connection

```typescript
import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URL });
client.on("error", (error) => {
  // Send redacted metric; do not log URL, credentials, keys, or values.
  recordRedisClientError(error);
});
await client.connect();
```

Source: [Redis node-redis guide](https://redis.io/docs/latest/develop/clients/nodejs/). Example is adapted to this repository's server-only/error-redaction boundary.

### Exact bounded presence read

```typescript
const keys = authorizedFriends.flatMap((friend) => sessionIdsByUser.get(friend.userId) ?? []);
const values = await redis.mGet(keys);
const onlineByUser = aggregateLiveSessions(keys, values);
```

Source: [Redis MGET](https://redis.io/docs/latest/commands/mget/). `keys` must be bounded by the authorized page/session cap; `aggregateLiveSessions` is application logic to test.

### Route Handler boundary

```typescript
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const input = heartbeatSchema.parse(await request.json());
  await presenceHeartbeat(auth.user.id, input);
  return new Response(null, { status: 204 });
}

export const runtime = "nodejs";
```

Source: [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers), adapted to existing `requireApiUser` and Zod patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `redis@6.2.0` verified with npm registry, `slopcheck [OK]`, and official Redis docs; existing Next.js/Zod/Vitest versions verified in `package.json`.
- Architecture: HIGH for repository boundaries and locked HTTP/Realtime/privacy decisions; MEDIUM for exact session index and worker deployment because no Redis/deployment target exists.
- Pitfalls: HIGH for auth, bounded reads, TTL, invalidation-only, and failure semantics; MEDIUM for provider-specific rate/latency tuning.

**Research date:** 2026-08-02
**Valid until:** 2026-09-01 for architecture; 2026-08-09 for package/version/provider details.

## RESEARCH COMPLETE

Phase 15 research is complete. Planner has implementation-ready guidance for Redis ephemeral presence, typing TTL/throttle, durable Stream batching, auth/privacy, rate limits, Redis failure behavior, invalidation-only Realtime, exact affected modules, test mapping, and 100–1,000-user load evidence. Real Redis and approved SQL proof remain explicit execution gates.