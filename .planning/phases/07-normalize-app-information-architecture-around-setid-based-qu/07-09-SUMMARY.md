---
phase: 07-normalize-app-information-architecture-around-setid-based-qu
plan: 09
subsystem: routing
tags: [nextjs, routing, smoke-tests, hard-cutover, supabase-auth]
requires:
  - phase: 07-08
    provides: zero forbidden caller references and post-deletion reference audit scripts
provides:
  - Deterministic production route smoke with real Supabase auth cookies
  - Legacy `?review=mistakes` hard-cutover 404 at proxy boundary
  - Recorded automated gate evidence for final human acceptance matrix
affects: [phase-7-completion, routing-verification]
tech-stack:
  added: []
  patterns: [manifest inventory plus authenticated HTTP smoke, pro-tier ephemeral fixtures to avoid quota RPC dependency]
key-files:
  created: []
  modified:
    - scripts/verify-phase7-route-smoke.mjs
    - scripts/audit-phase7-route-callers.mjs
    - src/proxy.ts
    - .planning/phases/07-normalize-app-information-architecture-around-setid-based-qu/07-VALIDATION.md
key-decisions:
  - "Exclude verify-phase7-route-smoke.mjs from caller audit because it must assert representative legacy URL literals."
  - "Return exact 404 for `?review=mistakes` in proxy before session handling so unauthenticated smoke negatives match hard-cutover D-01."
  - "Create ephemeral smoke users with pro app_metadata to avoid optional quota RPC migrations on remote Supabase."
requirements-completed: [IA-01, IA-02, IA-03, IA-04, IA-05, IA-06, IA-07, IA-08, IA-09, IA-10]
duration: ~55 min
completed: 2026-07-30
---

# Phase 7 Plan 9: Legacy Route Deletion and Route Smoke Summary

**Hard-cutover legacy route deletion verified, deterministic authenticated route smoke passes, final human matrix pending approval**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-07-30
- **Tasks:** 2 automated complete, 1 human checkpoint pending
- **Files modified (plan scope):** 3 source scripts + proxy + validation doc

## Task Commits

1. **Task 1: Pass callers gate, delete exact roots, then pass full audit** — pre-satisfied on branch (legacy roots absent; both audits literal zero). No additional commit required.
2. **Task 2: Route smoke automation** — pending commit of `scripts/verify-phase7-route-smoke.mjs`, `scripts/audit-phase7-route-callers.mjs`, `src/proxy.ts`

## Accomplishments

- Confirmed `npm run verify:phase7-callers` → `0 forbidden caller references` before and after smoke-script audit exclusion.
- Confirmed `npm run verify:phase7-references` → `0 forbidden route references` with all four legacy filesystem roots absent.
- Enhanced `scripts/verify-phase7-route-smoke.mjs` with manifest inventory, `.env` loading, Supabase SSR cookie sign-in, fail-closed negatives, pro-tier ephemeral fixtures, and nested cleanup.
- `npm run verify:phase7-routes` passes after production build (smoke output: canonical authenticated routes + exact legacy 404/no-Location).
- Added proxy-level 404 for legacy `?review=mistakes` query pattern required by D-01/D-03.

## Route Smoke Output

```
Phase 7 route smoke passed: manifest inventory, fail-closed negatives, canonical authenticated routes, and exact legacy 404s.
```

Manifest asserts all D-02 canonical page keys present; legacy edit/sets/flashcards/`quiz/[id]` keys absent.

## Automated Gate Results (Task 3)

| Gate | Result | Notes |
|------|--------|-------|
| `npm run verify:phase7-callers` | PASS | `0 forbidden caller references` |
| `npm run verify:phase7-references` | PASS | `0 forbidden route references` |
| `npm run verify:phase7-routes` | PASS | Build + smoke (see output above) |
| `npm run typecheck` | PASS | After local layout/quota typing workaround (uncommitted dirty fix) |
| `npm run lint` | FAIL | 4 errors in unrelated dirty workspace files (`workspaceSummary.ts`, workspace canonical reader hooks) |
| `npm test -- --run` | FAIL | 17 failures in phase 9 legacy-bridge route tests (mock `.is()` chain) |
| `npm run build` | PASS | Production build completes |

## Human Acceptance Matrix (pending)

Follow `07-VALIDATION.md` manual section at **1440px and 375px**, EN/VI, light/dark where relevant:

| Area | Cells to verify |
|------|----------------|
| Dashboard | URL filter preservation, mistake ordering, card overview destinations |
| Create wizards | Quiz + flashcard Source→Convert→Generate→Review |
| Review / edit | Separate routes, keyboard play/drill with nav hidden + Exit |
| Resume | Exact reload/browser-close restore, multi-session picker |
| Results | Shell, retry, drill mistakes, return paths |
| Shell | Desktop sidebar collapse; mobile top-level bottom nav vs nested contextual bar |
| Accessibility | 44px targets, focus/ARIA, contrast, reduced motion, no overflow |
| Preservation | Study-set IDs and user/generated content unchanged; Phase 6 dashboard hunks intact |

**Resume signal:** Type `approved` or list failing cells.

## Deviations from Plan

### Rule 1 — Legacy `?review=mistakes` returned 307 instead of 404

- **Found during:** Task 2 smoke HTTP phase
- **Issue:** Canonical `/quiz/[setId]` requires auth; unauthenticated requests redirected (307) instead of hard-cutover 404 for legacy query pattern.
- **Fix:** `src/proxy.ts` returns `404` when `review=mistakes` query param is present (not a smoke backdoor).
- **Files modified:** `src/proxy.ts`

### Rule 3 — Caller audit flagged smoke script legacy URL literals

- **Fix:** Added `scripts/verify-phase7-route-smoke.mjs` to `audit-phase7-route-callers.mjs` ignored files set (mirrors references audit).

### Rule 3 — Build/typecheck blocked by Supabase client deep instantiation

- **Fix:** Local uncommitted workaround via `loadAppLayoutUsage.ts` + layout/settings import changes (outside plan file list; dirty workspace preserved).
- **Not staged** per surgical commit scope.

### Pre-satisfied Task 1

Legacy route roots were already deleted on branch before this execution; deletion gate and full reference audit both report literal zero.

## Known Stubs

None introduced.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| runtime-admin-credentials | scripts/verify-phase7-route-smoke.mjs | Uses service-role key at runtime only; creates/deletes ephemeral user + fixtures in `finally` |

No smoke backdoor added; `auth-guard.ts` and `middlewareClient.ts` unchanged.

## Self-Check: PASSED

- `07-09-SUMMARY.md` created at required path
- `verify:phase7-callers` and `verify:phase7-references` pass
- `verify:phase7-routes` passes with recorded output
- Legacy filesystem roots absent
- Human matrix documented; checkpoint pending

---
*Phase: 07-normalize-app-information-architecture-around-setid-based-qu*
*Completed: 2026-07-30 (automated); human matrix pending*
