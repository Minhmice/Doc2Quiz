---
phase: 08-freemium-coupons
plan: "05"
subsystem: api
tags: [supabase, quota, reservations, rpc, typescript]
requires:
  - phase: 08-04
    provides: atomic reserve, commit, release, and availability RPCs
provides:
  - typed generationQuotaReservation adapter
  - availability-backed getUserUsage DTO
  - retired direct quota-table mutation path
affects: [08-06, quiz-generation, flashcard-generation, usage-api]
tech-stack:
  added: []
  patterns: [discriminated RPC JSON narrowing, pro-tier server bypass via resolveUserAiTier]
key-files:
  created:
    - src/lib/server/quota/generationQuotaReservation.ts
    - src/lib/server/quota/generationQuotaReservation.test.ts
  modified:
    - src/lib/server/quota/assertGenerationQuota.ts
    - src/lib/server/quota/recordQuotaConsumption.ts
    - src/lib/server/quota/getUserUsage.ts
    - src/lib/server/quota/assertGenerationQuota.test.ts
    - src/lib/server/quota/recordQuotaConsumption.test.ts
key-decisions:
  - "Pro users bypass reservation RPCs in TypeScript via resolveUserAiTier; tier is never accepted from client input."
  - "recordQuotaConsumption is retired as a no-op until Plan 08-06 routes commit reservations after pipeline success."
patterns-established:
  - "Quota adapter validates discriminated RPC payloads locally and maps quota_exceeded to QuotaExceededError unchanged."
requirements-completed: [PLAN-01, PLAN-02, PLAN-04, PLAN-05, PLAN-07]
duration: 18min
completed: 2026-07-30
---

# Phase 08 Plan 05: Typed Reservation RPC Adapter Summary

**Server quota authority now flows through typed Supabase RPC adapters instead of direct quota-table reads and writes.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-30T05:45:00+07:00
- **Completed:** 2026-07-30T06:03:00+07:00
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Added `generationQuotaReservation` adapter exposing reserve, commit, release, and availability RPCs with discriminated result parsing.
- Rewired `assertGenerationQuota` and `getUserUsage` to database availability authority; exported `GenerationInProgressError` for active duplicate work.
- Retired `recordQuotaConsumption` direct insert/upsert path; regression tests guard against reintroducing table mutations.

## Task Commits

1. **Task 1: Test typed database reservation adapter** — `d2869ed` (test)
2. **Task 2: Implement reservation adapter and availability-backed usage** — `d44198d` (feat)

## Files Created/Modified

- `src/lib/server/quota/generationQuotaReservation.ts` — typed RPC adapter and JSON narrowing.
- `src/lib/server/quota/generationQuotaReservation.test.ts` — reserve/commit/release/availability contract tests.
- `src/lib/server/quota/assertGenerationQuota.ts` — availability-backed pre-check with conflict and 402 mapping.
- `src/lib/server/quota/recordQuotaConsumption.ts` — retired direct writes (no-op until route lifecycle in 08-06).
- `src/lib/server/quota/getUserUsage.ts` — usage DTO from `get_generation_quota_availability`.
- `src/lib/server/quota/assertGenerationQuota.test.ts` — RPC authority regression tests.
- `src/lib/server/quota/recordQuotaConsumption.test.ts` — proves no quota-table mutation.

## Decisions Made

- Pro bypass remains server-side via `resolveUserAiTier`; reservation RPCs are not called for pro users.
- `recordQuotaConsumption` stays exported as a no-op compatibility shim until Plan 08-06 wires commit/release in routes.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

- `recordQuotaConsumption` is intentionally a no-op for free users until Plan 08-06 commits reservations after successful pipeline work. Routes still call it today without effect.

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| `threat_flag: rpc-json-parsing` | `src/lib/server/quota/generationQuotaReservation.ts` | Discriminated RPC payloads are narrowed before route decisions; unknown statuses throw. |

## Verification

```text
npm run test -- --run src/lib/server/quota/generationQuotaReservation.test.ts src/lib/server/quota/assertGenerationQuota.test.ts src/lib/server/quota/recordQuotaConsumption.test.ts
→ 3 files, 19 tests passed

rg direct quota mutation in src/lib/server/quota → no matches
```

## Next Phase Readiness

- Plan 08-06 can reserve before `runQuizGenerate` / `runFlashcardGenerate`, commit on success, and release on failure using exported adapter functions and `GenerationInProgressError`.

## Self-Check: PASSED

- Confirmed `generationQuotaReservation.ts` and `generationQuotaReservation.test.ts` exist.
- Confirmed task commits `d2869ed` and `d44198d` exist.
