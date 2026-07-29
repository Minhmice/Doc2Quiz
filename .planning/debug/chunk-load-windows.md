# Debug: ChunkLoadError on /dashboard (Windows dev)

**Status:** fix applied  
**Started:** 2026-07-25

## Symptoms

- Browser: `ChunkLoadError: Loading chunk app/layout failed (timeout)`
- Browser: `ChunkLoadError: Loading chunk app-pages-internals failed (timeout)`
- Server: `GET /dashboard 200` then `GET /dashboard 500` with `SyntaxError: Unexpected end of JSON input`
- React: state update on unmounted component (cascade from failed hydration)

## Root cause

1. **Windows + webpack dev race:** After `.next` cache clear or first compile, HTML is sent while large client chunks (`main-app.js` ~12MB, `layout.js` ~2MB) are still being written. Browser requests time out.
2. **Aggressive reload:** `ChunkLoadRecovery` reloaded immediately on chunk error, aborting in-flight RSC fetches → `Unexpected end of JSON input` 500.
3. **Duplicate recovery handlers:** Inline script + React component both fired reloads.

## Fixes applied

- `next.config.ts`: `chunkLoadTimeout` 300s, `watchOptions.poll` on Windows dev
- `ChunkLoadRecovery`: 3s delayed reload with cache-bust `?_cb=`, max 2 retries
- Removed duplicate `ChunkLoadRecovery` from `AppRootProviders` (inline script in root layout only)
- `experimental.optimizePackageImports` for lucide-react, framer-motion

## Verify

1. Stop dev server
2. `npm run dev:clean`
3. Wait for `✓ Ready`, then open **new incognito tab** to `http://localhost:3000/dashboard`
4. First load may take ~7s compile; if chunk error occurs, page auto-retries after 3s
5. Second load should be stable

## Optional (Node 25)

If `--localstorage-file` warning persists, check system `NODE_OPTIONS` and remove invalid flag.
