---
status: awaiting_human_verify
trigger: "Debug and fix current local Doc2Quiz issue: Friends dropdown action “Xem hồ sơ” does not work. Inspect Phase 11 friend action UI, profile route/page/API, auth and safe profile constraints. Reproduce/analyze root cause through code and available logs; apply minimal safe fix. Preserve dirty unrelated work, do not commit. Run typecheck and focused test(s). Return root cause, changed files, checks. If user profile access needs a missing safe route, implement authorization consistent with existing friendship/block controls; do not expose profiles publicly."
created: 2026-07-30T23:44:00+07:00
updated: 2026-07-31T00:59:00+07:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "Friend profile avatar signing runs as viewing user, but storage grants profile-avatar SELECT only to its owner; accepted friends cannot safely read the target avatar object."
test: "Compare avatar upload path with active storage SELECT policies and get_friend_profile authorization."
expecting: "Profile paths are owner-scoped and no friend-profile storage policy exists, while friend-profile RPC already enforces accepted friendship and blocks."
next_action: Wait for user to apply migration and confirm target friend avatar renders; resume investigation if it does not.

reasoning_checkpoint:
  hypothesis: "Friend profile avatar signing runs as viewing user, but storage grants profile-avatar SELECT only to its owner; accepted friends cannot safely read the target avatar object."
  confirming_evidence:
    - "Profile uploads use {ownerId}/profile/avatar.{extension}, while the baseline doc2quiz SELECT policy permits only owner = auth.uid()."
    - "get_friend_profile checks private.social_require_friend before returning avatarPath, and the API validates the target-user avatar path."
    - "No storage SELECT policy permits accepted friends to read only profile-avatar objects."
  falsification_test: "If an active storage policy already grants accepted friends SELECT for the exact target profile-avatar path, this hypothesis is false."
  fix_rationale: "A separate SELECT policy restricted to exact profile-avatar paths and private.social_are_accepted_friends lets Supabase create a signed URL only for accepted, unblocked friends; all other bucket objects remain private."
  blind_spots: "No local Supabase database run is available to execute RLS integration checks; the user must apply the migration and verify in the real Supabase workflow."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Selecting “Xem hồ sơ” in Friends dropdown opens selected friend's safe profile.
actual: “Xem hồ sơ” now opens, but friend avatar is incorrect or unavailable.
errors: Not provided; inspect available local logs.
reproduction: Open Friends dropdown, select “Xem hồ sơ”, and compare displayed avatar with selected friend's saved avatar.
started: Current local issue; timing not provided.

## Eliminated
<!-- APPEND only - prevents re-investigating -->


## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-30T23:44:00+07:00
  checked: Active debug-session directory and terminal log
  found: Existing friend-related sessions exist; terminal has no runtime output.
  implication: Prior diagnoses may identify a related routing/API pattern; direct code tracing is required.
- timestamp: 2026-07-30T23:52:00+07:00
  checked: FriendActionMenu, app routes, profile API/page, and social SQL migration
  found: Xem hồ sơ only calls onStatus("Hồ sơ được bảo vệ."); no friend-profile route or API exists. /api/profile and /profile are caller-only and include private study-set stats. private.social_are_accepted_friends enforces accepted friendship and block state.
  implication: Implement a separate protected friend-profile read path returning safe identity data only; reusing the caller profile API would expose private data.
- timestamp: 2026-07-30T23:54:00+07:00
  checked: Focused social route tests and TypeScript typecheck
  found: src/app/api/friends/friends.route.test.ts passed 22/22, including safe friend-profile data and hidden authorization tests. Typecheck is blocked by existing dirty src/app/api/friends/requests/route.ts errors accessing NextResponse.body.error.
  implication: The new route/page changes are lint-clean and focused behavior passes; unrelated dirty work must remain unchanged.
- timestamp: 2026-07-31T00:53:00+07:00
  checked: Friend profile route, avatar upload path, and active storage policies
  found: Friend avatars use {userId}/profile/avatar.{extension}. The friend-profile route signs that target path as viewing user, but doc2quiz storage permits SELECT only when owner = auth.uid(); no accepted-friend policy exists. The profile RPC and API already bind the target avatar path to an accepted, unblocked friend.
  implication: Add a storage SELECT policy limited to profile-avatar paths, mediated by a helper that compares auth.uid() with target owner through private.social_are_accepted_friends; do not widen profile API or bucket access.
- timestamp: 2026-07-31T00:58:00+07:00
  checked: Focused friend-profile tests and TypeScript typecheck
  found: Targeted friend-profile tests passed 2/2, including signed target avatar and raw-path rejection. Full social route file has 2 unrelated dirty failures: friends-list test expects no avatarUrl and reaction mock now causes expected delivery 503. Typecheck fails only in dirty reactions route test at TS18048 on a possibly undefined response.
  implication: Avatar access fix passes direct route-contract checks; existing unrelated failures remain untouched.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Friend profile avatar URL creation executed with viewer credentials, but doc2quiz storage granted profile-avatar SELECT only to its owner. The protected profile RPC returned target avatarPath, but storage denied the viewer access needed to sign/read it.
fix: Added a narrow storage SELECT policy for only {ownerId}/profile/avatar.{png|jpg|jpeg|webp|gif}. It derives target owner from exact path and grants access only when private.social_are_accepted_friends(auth.uid(), targetOwner) is true, retaining block checks and all other object privacy.
verification: Targeted friend-profile tests passed 2/2. Full social route test has 2 unrelated dirty failures (friend-list avatarUrl expectation and reaction delivery mock). Typecheck fails only in dirty src/app/api/friends/reactions/route.test.ts TS18048; migration SQL has no editor diagnostics. Live Supabase RLS requires user verification after migration deployment.
files_changed:
  - supabase/migrations/20260731010000_friend_profile_avatar_access.sql
