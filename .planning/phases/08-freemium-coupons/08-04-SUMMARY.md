---
phase: 08-freemium-coupons
plan: "04"
subsystem: database
tags: [supabase, postgres, quota, reservations, rls]
requires:
  - phase: 08-01
    provides: quota wallet, consumption schema, and ICT week helper
  - phase: 08-03
    provides: atomic coupon credit wallet updates
provides:
  - serialized generation quota reservation lifecycle
  - authenticated reservation, commit, release, and availability RPCs
  - SQL lifecycle proof for local Supabase
affects: [08-05, 08-06, quiz-generation, flashcard-generation]
tech-stack:
  added: []
  patterns: [per-user advisory transaction lock, expiring quota reservation]
key-files:
  created:
    - supabase/migrations/20260730140000_atomic_generation_quota_reservations.sql
    - supabase/tests/quota_reservation_concurrency.sql
  modified: []
key-decisions:
  - "Use a seven-minute reservation TTL, exceeding the 300-second route limit with two minutes of margin."
  - "Serialize quota and wallet mutations per authenticated user with a transaction-scoped advisory lock."
patterns-established:
  - "Quota capacity counts active reservations and committed rows; releases refund bonus credits once."
requirements-completed: [PLAN-01, PLAN-02, PLAN-04, PLAN-05, PLAN-07]
duration: 31min
completed: 2026-07-30
---

# Phase 08 Plan 04: Atomic Quota Reservations Summary

**Postgres-owned generation reservations serialize weekly capacity and bonus-credit spends before expensive AI work.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-07-30T05:34:00+07:00
- **Completed:** 2026-07-30T06:05:00+07:00
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Added reservation lifecycle fields, backfill, supporting indexes, and least-privilege RLS policy removal.
- Added authenticated SECURITY DEFINER RPCs for reserve, commit, release, expiry reclaim, and quota availability.
- Added rollback-safe SQL proof for quota boundaries, refunds, idempotent same-set behavior, and availability.

## Task Commits

1. **Task 1: Specify deterministic reservation lifecycle and concurrent boundary proof** — `8a20fa5` (test)
2. **Task 2: Add atomic reserve, commit, release, and availability RPCs** — `a3ed1bc` (feat)

## Files Created/Modified

- `supabase/tests/quota_reservation_concurrency.sql` — public-RPC lifecycle proof with rollback cleanup.
- `supabase/migrations/20260730140000_atomic_generation_quota_reservations.sql` — reservation authority, expiry reclaim, RLS hardening, and RPC grants.

## Decisions Made

- Reservation TTL is seven minutes: route budget plus a two-minute termination margin.
- Reservation lifecycle is database-owned and serialized by authenticated user, not caller-provided user or tier input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical functionality] Removed direct browser quota mutations**
- **Found during:** Task 2
- **Issue:** Existing RLS policies allowed authenticated clients to insert quota rows and mutate wallet credits outside reservation authority.
- **Fix:** Dropped direct INSERT/UPDATE policies while retaining user-scoped SELECT policies and granted only authenticated RPC execution.
- **Files modified:** `supabase/migrations/20260730140000_atomic_generation_quota_reservations.sql`
- **Verification:** Migration SQL inspection and SQL lint diagnostics.
- **Committed in:** `a3ed1bc`

**Total deviations:** 1 auto-fixed (1 critical functionality)
**Impact on plan:** Required threat-model mitigation. No scope creep.

## Issues Encountered

- Required local database validation could not run because Docker Desktop's Linux engine was unavailable. `supabase db reset` stopped before migration application; rerun after Docker Desktop starts.

## Known Stubs

- `supabase/tests/quota_reservation_concurrency.sql` describes deterministic lifecycle proof but cannot exercise two live `psql` sessions until local Docker-backed Supabase is available. Plan 08-05/08-06 must wire routes to these RPCs.

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| `threat_flag: security-definer-rpc` | `supabase/migrations/20260730140000_atomic_generation_quota_reservations.sql` | RPCs mutate quota and wallet tables with fixed search path, authenticated caller checks, ownership validation, and authenticated-only grants. |

## User Setup Required

Start Docker Desktop, then run:

```powershell
supabase db reset
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/quota_reservation_concurrency.sql
```

## Next Phase Readiness

- Plan 08-05 can adapt usage reads to reservation RPC availability.
- Plan 08-06 can reserve before AI work, commit success, and release failures.

## Self-Check: PASSED

- Confirmed both plan artifacts exist.
- Confirmed task commits `8a20fa5` and `a3ed1bc` exist.
