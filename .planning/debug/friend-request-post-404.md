---
status: resolved
trigger: "POST /api/friends/requests still returns 404 after prior client fixes"
created: 2026-07-30T23:27:00+07:00
updated: 2026-07-30T23:32:00+07:00
---

## Current Focus

hypothesis: Recipient profiles have username set in UI but username_normalized is null, so send_friend_request lookup fails with request_unavailable.
test: Apply SQL migration fixing lookup + explicit normalized writes; retry POST with known username.
expecting: Valid saved usernames resolve; dev log prints attempted username on 404.
next_action: User runs supabase db push and retries with recipient username from Settings/Profile (@handle).

## Evidence

- timestamp: 2026-07-30T23:32:00+07:00
  checked: Terminal still shows POST /api/friends/requests 404 after client-only fixes
  found: send_friend_request only matched profiles.username_normalized; legacy/missing normalized values cause false request_unavailable even when profiles.username is visible.
  implication: DB migration required, not just client messaging.

## Resolution

root_cause: Friend lookup ignored profiles.username when username_normalized was unset.
fix: Migration 20260730191000_fix_friend_request_username_lookup.sql + dev log + localized requestUnavailable copy.
verification: supabase db push; send request between two accounts with saved usernames; check dev terminal for [friends] request_unavailable log if still failing.
files_changed:
  - supabase/migrations/20260730191000_fix_friend_request_username_lookup.sql
  - src/app/api/friends/requests/route.ts
  - src/lib/locale/messages.ts
  - src/lib/locale/types.ts
  - src/lib/client/friends.ts
  - src/components/friends/AddFriendDialog.tsx
  - src/components/settings/SocialSafetySettings.tsx

