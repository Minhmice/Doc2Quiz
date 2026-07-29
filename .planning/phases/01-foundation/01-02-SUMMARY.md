---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [supabase, ssr, proxy, session-refresh]
requires:
  - phase: 01-01
    provides: schema baseline (no runtime dependency)
provides:
  - Supabase SSR client trio
  - proxy.ts session refresh
  - requireUser auth guard
affects: [01-04, 01-05]
tech-stack:
  added: []
  patterns: [getClaims in proxy, x-next-pathname deep-link redirects]
key-files:
  created: [src/lib/client/supabase.ts, src/proxy.ts]
  modified: [src/lib/supabase/middlewareClient.ts, src/lib/supabase/server.ts]
key-decisions:
  - "Use getClaims() in proxy per RESEARCH; getUser() in requireUser"
patterns-established:
  - "Thin re-export at src/lib/client/supabase.ts for stable import paths"
requirements-completed: [CORE-AUTH-01]
duration: 10min
completed: 2026-07-25
---

# Phase 1 Plan 02: Supabase SSR Clients Summary

**Real Supabase SSR clients and Next.js 16 proxy session refresh replace mocks and passthrough.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Restored `src/lib/supabase/*` modules (env, browser, server, middlewareClient, auth-guard)
- Wired `src/proxy.ts` to `updateSession` with `getClaims()` refresh
- Replaced `MockSupabaseClient` with browser client re-export

## Task Commits

1. **Tasks 1–2: Clients + proxy** - `8805408` (feat)

## Deviations from Plan

None.

## Verification

- `npm run typecheck` — PASS
- `src/proxy.ts` contains `updateSession`
- `src/lib/client/supabase.ts` has no `MockSupabaseClient`

## Self-Check: PASSED
