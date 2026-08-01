---
status: resolved
trigger: "Debug current local Doc2Quiz issue: clicking friend icon fails. Inspect all Phase 11 friend UI/API changes and existing relevant code. Use evidence (read code, available terminal logs/tests) to identify root cause and apply minimal safe fix. Preserve all dirty unrelated work. Do not commit. Run typecheck and focused test or reproduce if possible. Return exact cause, changed files, verification. If blocked by missing runtime error detail, inspect likely null/runtime assumptions and error boundary behavior before asking user."
created: 2026-07-30T23:19:00+07:00
updated: 2026-07-30T23:26:00+07:00
---

## Current Focus

hypothesis: Base UI requires DropdownMenuLabel inside DropdownMenuGroup; missing wrapper throws on menu open.
test: Open StreakButton and FriendsMenu after wrapping labels in DropdownMenuGroup.
expecting: Menus open without MenuGroupContext runtime error.
next_action: User verifies in browser.

## Symptoms

expected: Clicking friend icon opens friend UI without client or server failure.
actual: Clicking friend icon fails locally.
errors: Base UI MenuGroupContext is missing at DropdownMenuLabel.
reproduction: Click friend icon or streak button in AppTopBar.
started: Current local Phase 11 friend UI/API changes.

## Eliminated

- hypothesis: Nested button in DropdownMenuTrigger — fixed earlier; separate issue from menu open crash.
- hypothesis: Friends API failure on load — API returns 200; crash is client-side Base UI context error.

## Evidence

- timestamp: 2026-07-30T23:19:00+07:00
  checked: Reported symptom
  found: Failure occurs when clicking friend icon; no error text supplied.
  implication: Inspect event path, null assumptions, module availability, response contract, and error boundaries before requesting user input.
- timestamp: 2026-07-30T23:21:00+07:00
  checked: FriendsMenu integration and client request helper
  found: AppTopBar always renders FriendsMenu. On open, menu calls listAcceptedFriends and fetchIncomingFriendRequests concurrently.
  implication: Main candidates are dropdown trigger compatibility, a dependency runtime exception, or server route failure.
- timestamp: 2026-07-30T23:24:00+07:00
  checked: Dev server terminal logs
  found: `Base UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.` at DropdownMenuLabel in StreakButton and FriendsMenu.
  implication: DropdownMenuLabel must be wrapped in DropdownMenuGroup per Base UI contract (AccountMenu/LanguageSelector already do this).

## Resolution

root_cause: DropdownMenuLabel rendered outside DropdownMenuGroup in StreakButton, FriendsMenu, and FriendActionMenu. Base UI throws when the menu opens.
fix: Wrap all DropdownMenuLabel usages in DropdownMenuGroup.
verification: Terminal error should disappear; both top-bar menus should open on click.
files_changed:
  - src/components/layout/StreakButton.tsx
  - src/components/layout/FriendsMenu.tsx
  - src/components/friends/FriendActionMenu.tsx
