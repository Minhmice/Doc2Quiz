# Debug: GET /logout returns 405

**Status:** fix applied  
**Started:** 2026-07-26

## Symptoms

- Server log: `GET /logout 405` (repeated on logout attempts)
- `POST /logout 303` works when called directly (curl / programmatic form)
- User stays on app or lands on blank `/logout` page; session may not clear

## Root cause

1. `/logout` route exported **POST only** — any GET navigation returns 405.
2. AppTopBar used a dynamic `form.submit()` POST inside a Base UI menu item. In practice the browser/Next.js dev flow often ended on **GET `/logout`** (client navigation) instead of completing the POST redirect chain to `/login`.

## Fix

1. **`logout/route.ts`**: Shared `signOutAndRedirect()` for both `GET` and `POST` (UI-SPEC allows GET logout navigation).
2. **`AppTopBar.tsx`**: `window.location.assign("/logout")` — full-page navigation that hits server `signOut()` then 303 → `/login`.

## Files changed

- `src/app/(auth)/logout/route.ts`
- `src/components/layout/AppTopBar.tsx`

## Verify

1. Log in, open account menu → **Log out**
2. Server should log `GET /logout 303` (or 302/303) then `GET /login 200`
3. No `405` on `/logout`
4. Revisiting `/dashboard` should redirect to login
