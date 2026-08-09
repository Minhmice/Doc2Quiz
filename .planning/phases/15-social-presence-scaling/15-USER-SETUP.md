# Phase 15 Redis setup

## Status

Incomplete — external Redis proof is required before Phase 15 validation.

## Required deployment configuration

| Variable | Source | Rule |
| --- | --- | --- |
| `REDIS_URL` | Deployment owner Redis connection | Server-only; TLS/authenticated target; never `NEXT_PUBLIC_*`. |
| `REDIS_CONNECT_TIMEOUT_MS` | Optional deployment config | Default `1000`. |
| `REDIS_COMMAND_TIMEOUT_MS` | Optional deployment config | Default `1000`. |
| `REDIS_RECONNECT_MAX_MS` | Optional deployment config | Default `5000`. |
| `PHASE15_TEST_REDIS_URL` | Approved disposable Redis 6.2+ target | Test-only; isolated from production. |
| `PHASE15_REDIS_TEST_CONFIRM` | Deployment owner | Set exact value `YES` only for disposable target. |

## Checklist

- Confirm Redis target is disposable, allowlisted, TLS/authenticated, and isolated from production.
- Configure `REDIS_URL` only in server deployment and worker environments.
- Run Phase 15 external Redis TTL, reconnect, bounded-command, and load evidence before phase validation.
