# Spike Manifest

## Idea

Validate scalable social presence, typing, and durable activity for 100–1,000 concurrent users without turning frequent realtime signals into PostgreSQL write inflation.

## Requirements

- Redis stores hot ephemeral presence and typing state; Postgres stores durable social state.
- Next.js Route Handlers remain stateless; no in-process timers, WebSocket state, or worker assumptions.
- Presence uses per-session TTL keys, coarse UI buckets, accepted-friend privacy, and `unknown` on stale Redis failure.
- Typing is conversation-scoped, short-lived, rate-limited, and participant-only.
- Meaningful activity batches through a queue/stream before durable Postgres upsert.
- Existing authenticated HTTP snapshots remain display authority; realtime only invalidates or accelerates refresh.
- No new dependency or production Redis service is added until feasibility spike passes real integration gates.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | redis-social-presence-scaling | standard | Given 100–1,000 concurrent users, when presence, typing, batching, and Redis failure paths run through stateless handlers, then hot state avoids per-action Postgres writes and failure behavior remains bounded and observable. | PARTIAL | redis, presence, typing, messaging, scaling |
