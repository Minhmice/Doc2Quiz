# Debug: Base UI hydration id mismatch in AppTopBar

**Status:** fix applied  
**Started:** 2026-07-26

## Symptoms

- React hydration error: server/client `id` mismatch on Base UI primitives in `AppTopBar`
- Affected: search `Input`, API status tooltip trigger, account `DropdownMenuTrigger`
- Pattern: `base-ui-_R_19beitmlb_` (client) vs `base-ui-_R_19baitmlb_` (server) — one character shift in React `useId` suffix

## Root cause

`CommandPalette` was imported with `next/dynamic(..., { ssr: false })` and rendered **before** `AppShell` in `AppProviders`.

- **Server:** dynamic component does not mount → no `useId` calls from CommandPalette subtree
- **Client:** CommandPalette mounts (CommandDialog, CommandInput, etc.) → extra `useId` hooks run before `AppShell`

React 19 `useId` is tree-order dependent. Extra client-only hooks before `AppShell` shifted all Base UI auto-ids inside `AppTopBar`.

## Fix

Move `<CommandPalette />` after `<AppShell>` so client-only subtree does not precede shell UI during id allocation.

## Files changed

- `src/components/layout/AppProviders.tsx`

## Verify

1. `npm run dev`
2. Open `/dashboard` in a fresh tab
3. Console should show no hydration mismatch on `AppTopBar` inputs/buttons
4. Command palette still opens via keyboard shortcut (Cmd/Ctrl+K)
