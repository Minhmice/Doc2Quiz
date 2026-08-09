# Phase 15 Redis and worker setup

## Status

Incomplete — external Redis, Supabase, worker deployment, and load proof are required before Phase 15 validation.

## Required deployment configuration

| Variable | Source | Rule |
| --- | --- | --- |
| `REDIS_URL` | Deployment owner Redis connection | Server-only; TLS/authenticated target; never `NEXT_PUBLIC_*`. |
| `REDIS_CONNECT_TIMEOUT_MS` | Optional deployment config | Default `1000`. |
| `REDIS_COMMAND_TIMEOUT_MS` | Optional deployment config | Default `1000`. |
| `REDIS_RECONNECT_MAX_MS` | Optional deployment config | Default `5000`. |
| `SOCIAL_WORKER_GROUP` | Worker process configuration | Stable bounded Redis consumer group. |
| `SOCIAL_WORKER_CONSUMER` | Worker process configuration | Unique per running worker process. |
| `SOCIAL_WORKER_BATCH_SIZE` | Worker process configuration | Default `100`; range `50`–`200`. |
| `SOCIAL_WORKER_BLOCK_MS` | Worker process configuration | Range `10000`–`30000`. |
| `SOCIAL_WORKER_LEASE_MS` | Worker process configuration | Range `30000`–`60000`. |
| `SOCIAL_WORKER_RETRY_BASE_MS` | Worker process configuration | Range `100`–`30000`. |
| `SOCIAL_WORKER_MAX_RETRIES` | Worker process configuration | Exactly `5`. |
| `SOCIAL_WORKER_HEALTH_FILE` | Optional worker supervisor path | Absolute host-writable path; health output is redacted. |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker deployment secret | Worker-only; never browser-exposed. |
| `PHASE15_TEST_REDIS_URL` | Approved disposable Redis 6.2+ target | Test-only; isolated from production. |
| `PHASE15_REDIS_TEST_CONFIRM` | Deployment owner | Set exact value `YES` only for disposable target. |
| `PHASE15_TEST_DATABASE_URL` | Approved disposable Supabase target | Requires `PHASE15_TEST_CONFIRM=YES`; never production/shared. |
| `PHASE15_TEST_CONFIRM` | Deployment owner | Set exact value `YES` only for disposable target. |

## Checklist

- Confirm Redis and Supabase targets are disposable, allowlisted, TLS/authenticated, and isolated from production.
- Configure `REDIS_URL` only in server deployment and worker environments.
- Run `node scripts/social-presence-worker.mjs --check-config` in worker configuration.
- Run worker under external supervisor with restart, unique consumer identity, SIGTERM delivery, health path, and network access to approved Redis/Supabase targets.
- Record real Stream `XREADGROUP`, `XAUTOCLAIM`, durable RPC, ack-after-commit, retry/dead-letter, restart, Redis TTL, reconnect, bounded-command, privacy, and load evidence before Phase 15 validation.
