# Debug: Dashboard 500 — Unexpected end of JSON input

**Status:** fix applied  
**Started:** 2026-07-26

## Symptoms

- `GET /dashboard 500` with `SyntaxError: Unexpected end of JSON input` (~10s compile stall)
- Browser: `JSON.parse` errors during client navigation
- Often after login redirect to `/edit/new/quiz` or post-logout navigation
- Related: `ChunkLoadError` for `CommandPalette` dynamic chunk

## Root cause

1. **Hydration mismatch (dashboard cache):** `useDashboardHome` read `sessionStorage` during `useState` init. Server rendered loading skeleton (`<main>`) while client first paint used cached data (`<div>`), causing React to tear down and re-fetch RSC — sometimes aborting in-flight payloads → empty JSON.
2. **Dev chunk races (Windows):** `CommandPalette` dynamic import and aggressive `RoutePrefetch` competed with webpack dev compile, producing chunk load failures and aborted RSC fetches.

## Fix

1. **`useDashboardHome.ts`:** Always start with empty/loading state; hydrate from `sessionStorage` only in `useEffect` after mount.
2. **`AppProviders.tsx`:** `DeferredCommandPalette` — load palette after idle/2s delay.
3. **`RoutePrefetch.tsx`:** Defer route prefetch until `window.load` + 2.5s.
4. **`chunkLoadRecoveryScript.ts`:** Treat `Unexpected end of JSON input` as recoverable (delayed reload, max 2).

## Files changed

- `src/hooks/useDashboardHome.ts`
- `src/components/layout/AppProviders.tsx`
- `src/components/layout/RoutePrefetch.tsx`
- `src/lib/dev/chunkLoadRecoveryScript.ts`

## Verify

1. `npm run dev:clean` → wait for Ready
2. Log in → navigate to `/dashboard` — no 500, no JSON parse errors
3. Navigate away and back — cached dashboard shows without hydration mismatch
4. Cmd+K still opens command palette after brief delay
