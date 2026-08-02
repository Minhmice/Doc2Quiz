---
title: Social scaling architecture
date: 2026-08-02
context: Performance and backend scaling exploration
status: decided
---

# Social scaling architecture

## Target

Support roughly 100–1,000 concurrent users without turning presence heartbeats into PostgreSQL write inflation.

## Locked boundaries

- Next.js Route Handlers + Redis first. No separate Node.js service yet.
- Redis owns hot, ephemeral presence and typing state.
- Supabase/Postgres owns friends, messages, read state, challenges, and durable activity.
- Existing Supabase Realtime remains invalidation/fan-out transport, not display authority.
- Authenticated HTTP snapshots remain UI truth for presence, counts, and durable social data.
- Accepted friends can see presence and current activity.
- Typing indicators are visible only to conversation participants.
- Blocked users receive no presence, activity, or typing data.

## Presence

- Store one Redis key per `userId + sessionId` so multiple devices aggregate safely.
- Heartbeat every 20 seconds. Presence key TTL: 60 seconds.
- Classify UI state coarsely: `online`, `active_15m`, `active_today`, `offline`, and `unknown` when infrastructure is stale or unavailable.
- Never store precise heartbeat seconds as durable product state.
- Redis outage keeps last-known state briefly, then exposes `unknown`; never manufacture `offline` and never fall back to frequent Postgres writes.
- Friend snapshots must batch Redis reads with `MGET`/pipelining. Never use `KEYS` in request paths.

## Typing

- Key shape: `typing:{conversationId}:{userId}`.
- TTL: 5 seconds.
- Refresh no more than once per 2 seconds. Clear on send, blur, or explicit stop.
- Expiry means not typing. Typing payloads are hints, not durable state.

## Durability

- Meaningful activity events enter a Redis Stream or equivalent queue.
- A scheduled/worker process batches upserts to `private.social_activity` every 10–30 seconds.
- Next.js handlers stay stateless. No in-process heartbeat timers, WebSocket state, or worker assumptions.
- Chat remains available if Redis fails.

## Security and limits

- Every presence snapshot checks authenticated friendship and block state before returning data.
- Every typing snapshot checks conversation participation.
- Heartbeats and typing updates need per-user/IP limits. Initial target: heartbeat around 6/min and typing around 1/sec; return `429` with `Retry-After` when exceeded.
- Redis key values never become direct client authority.

## Rollout order

1. Validate Redis presence, batching, TTLs, rate limits, and failure semantics.
2. Ship presence vertical slice.
3. Add conversation-scoped typing indicators.
4. Add optimistic message/reaction/request UI with rollback.
5. Add durable activity batching and load tests.
