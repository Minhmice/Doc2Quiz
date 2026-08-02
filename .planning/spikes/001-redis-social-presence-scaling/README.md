---
spike: 001
name: redis-social-presence-scaling
type: standard
validates: "Given 100–1,000 concurrent users, when presence, typing, batching, and Redis failure paths run through stateless Next.js handlers, then hot state avoids per-action Postgres writes and failure behavior remains bounded and observable."
verdict: PARTIAL
related: []
tags: [redis, presence, typing, messaging, scaling, nextjs, supabase]
---

# Spike 001: Redis Social Presence Scaling

## What This Validates

Given 100–1,000 concurrent users, when presence and typing events use Redis TTL contracts and meaningful activity is queued for batching, then PostgreSQL does not receive one write per heartbeat, privacy scope remains enforceable, and Redis failure does not take down messaging.

## Research

### Current repository

- Existing social activity uses Supabase/Postgres and authenticated HTTP.
- Existing Supabase Realtime is already treated as invalidation; durable HTTP responses remain display authority.
- Existing messages use cursor-based history and durable conversation state.
- No Redis client or separate realtime service is installed.

### External guidance

- Redis presence should use per-session keys with expiry. Aggregate a user as online when any session key exists.
- Use `MGET` or pipelining for friend snapshots; never use `KEYS` in request paths.
- Typing state is ephemeral. A five-second TTL avoids explicit cleanup.
- Next.js Route Handlers are stateless; timers, workers, and WebSocket connection state need an external process.

### Chosen approach

Start with Next.js Route Handlers + Redis for heartbeat and snapshot APIs. Keep Supabase Realtime for invalidation/fan-out. Add a scheduled worker or managed job for Redis Stream → Postgres batches. Do not add a WebSocket gateway until traffic proves HTTP/realtime fan-out insufficient.

## How to Run

Protocol simulation uses only Node.js built-ins:

```bash
node .planning/spikes/001-redis-social-presence-scaling/validate.mjs
```

Real feasibility validation, after Redis is provisioned, requires:

```text
REDIS_URL=... npm run spike:presence
```

The production command is intentionally not added yet because no Redis dependency or deployment contract exists.

## What to Expect

The simulation must print `SPIKE PASS` and verify:

- Multiple sessions produce one online user.
- Presence expires after 60 seconds without a heartbeat.
- Typing expires after 5 seconds.
- Typing refreshes are rejected inside the two-second client/server throttle window.
- Activity batches reduce durable writes below heartbeat count.
- Redis failure returns `unknown` after last-known grace, not `offline`.
- Blocked users and non-participants cannot read protected state.

## Observability

A real implementation must log structured counters, without message bodies or presence payloads:

- `presence_heartbeats_accepted`
- `presence_heartbeats_rate_limited`
- `presence_snapshot_unknown`
- `typing_updates_accepted`
- `typing_updates_rate_limited`
- `activity_events_queued`
- `activity_batch_size`
- `activity_batch_failures`
- `redis_latency_ms`

Add request correlation IDs and exportable test logs before load testing. Never log user message content or raw Redis values.

## Investigation Trail

1. **Current state review:** Found durable `last_active_at` updates and existing HTTP-authoritative social snapshots. This protects correctness but can inflate database writes if called on every action.
2. **Architecture choice:** Kept Supabase/Postgres for durable social data and moved only hot ephemeral state to Redis. No new WebSocket service for target scale.
3. **Failure policy:** Redis failure cannot mean offline. Keep last-known state during a short grace window, then return `unknown`; durable chat remains available.
4. **Privacy boundary:** Presence requires accepted friendship and no block. Typing requires conversation participation.
5. **Remaining proof:** This repository lacks Redis dependency, deployment, and a disposable Redis target. Real TTL, latency, reconnect, and concurrent-load measurements remain unverified.

## Results

**Verdict: PARTIAL.**

The architecture is internally consistent and its protocol/failure contracts are testable without changing production code. Repository inspection confirms existing cursor messaging and HTTP-authoritative reconciliation fit the design. Real Redis integration remains unvalidated because no Redis service or client dependency is configured.

### Evidence threshold for VALIDATED

Mark this spike `VALIDATED` only after a disposable Redis target proves:

- 1,000 concurrent heartbeat sessions sustain the selected cadence without Postgres heartbeat writes.
- Friend snapshot reads stay bounded with `MGET`/pipelining.
- TTL expiry and multi-session aggregation behave correctly across reconnects.
- Typing keys expire within the expected five-second window.
- Rate limits return `429` under abuse without blocking normal chat.
- Redis outage returns `unknown`, preserves messaging, and drains queued durable activity after recovery.
- Batch worker retries are idempotent and do not duplicate durable activity.
