# Debug: Login dev warnings (Fast Refresh + React state + Node localStorage)

**Status:** fix applied  
**Started:** 2026-07-25

## Symptoms

- `(node) Warning: --localstorage-file was provided without a valid path`
- `Fast Refresh had to perform a full reload`
- `[browser] Can't perform a React state update on a component that hasn't mounted yet`
- `GET /login 200` (page works; warnings are dev-time noise)

## Root cause

| Warning | Cause |
|---------|--------|
| `--localstorage-file` | Cursor / Node 25 injects flag without path into `NODE_OPTIONS` |
| Fast Refresh full reload | Server `layout.tsx` imported `chunkLoadRecoveryScript` from a `"use client"` module — invalid server/client boundary |
| React state before mount | `Toaster` called `useTheme()` before mount; auth clients set state after async work without unmount guards |

## Fixes applied

- `scripts/dev.mjs` — strips invalid `--localstorage-file` from `NODE_OPTIONS`; spawns `next` directly (no `npx` / `shell: true`) → fixes DEP0190
- `package.json` — `cross-env NODE_OPTIONS=` on `dev` and `dev:clean`
- `src/lib/dev/chunkLoadRecoveryScript.ts` — server-safe script string (no `"use client"`)
- `src/app/layout.tsx` — imports script from server-safe module
- `src/components/ui/sonner.tsx` — mount guard before rendering themed toaster
- `LoginClient` / `SignupClient` — `cancelled` / `alive` guards on async auth flows

## Remaining (harmless)

Webpack compile workers may still log `--localstorage-file` once per cold compile when Cursor injects the flag at the OS level (separate from `NODE_OPTIONS` on the main process). **Does not affect runtime.** To silence permanently:

1. Windows → Environment Variables → remove `NODE_OPTIONS` if it contains `--localstorage-file`
2. Restart Cursor / terminal

## Verify

1. Restart: `npm run dev` (or `npm run dev:clean`)
2. Open `http://localhost:3000/login` — no `--localstorage-file` warning in terminal
3. Edit a non-layout file — Fast Refresh should hot-update without full reload
4. No React "state update before mount" in browser console on login
