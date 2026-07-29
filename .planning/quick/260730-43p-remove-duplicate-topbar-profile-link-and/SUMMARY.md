---
status: complete
id: 260730-43p-remove-duplicate-topbar-profile-link-and
subsystem: ui
tags: [nextjs, react, shadcn, sidebar, account-menu]
key-files:
  created:
    - src/components/layout/AccountMenu.tsx
  modified:
    - src/components/layout/AppSidebar.tsx
    - src/components/layout/AppTopBar.tsx
key-decisions:
  - "Keep one AccountMenu implementation and supply sidebar trigger presentation through props."
duration: 12min
completed: 2026-07-30
---

# Quick Task: Remove duplicate topbar profile link and account trigger

**Sidebar footer now owns account access through one shadcn dropdown with navigation, theme, and sign-out actions.**

## Accomplishments

- Removed topbar profile link and account-menu trigger.
- Added Profile, Settings, and Help menu actions while retaining theme toggle and Supabase sign-out redirect.
- Made expanded, collapsed, and mobile sidebar footer triggers keyboard-accessible; mobile navigation closes after destination selection.

## Task Commits

1. **Task 1: Make account menu reusable from profile row** — `acc8303` (`feat`)
2. **Task 2: Remove topbar duplicate and wire sidebar footer trigger** — `928773e` (`feat`)

## Files Created/Modified

- `src/components/layout/AccountMenu.tsx` — reusable compact and profile-row dropdown triggers.
- `src/components/layout/AppSidebar.tsx` — sidebar footer account trigger; removes duplicate utility links.
- `src/components/layout/AppTopBar.tsx` — removes profile and account controls.

## Validation

- `npm run typecheck` — passed.
- `npm run lint -- src/components/layout/AccountMenu.tsx src/components/layout/AppSidebar.tsx src/components/layout/AppTopBar.tsx` — passed.
- `git diff --check` for target layout files — passed.

## Decisions Made

- Account destinations live in the existing dropdown, not separate sidebar links.
- Collapsed sidebar uses an icon-only trigger with `aria-label="Account menu"`.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- Summary file exists.
- Task commits `acc8303` and `928773e` exist.
