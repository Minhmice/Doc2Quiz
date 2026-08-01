---
status: awaiting_human_verify
trigger: "Debug and fix current local Doc2Quiz issue: sending playful reaction from Friends action does not work. Inspect FriendActionMenu, FriendsMenu, reaction client/API route, SQL RPC/migrations, Realtime broadcast, auth/error handling, and available dev logs. Reproduce/analyze code evidence and apply minimal safe fix. Preserve unrelated dirty work; no commit. Run typecheck and focused tests. If migration must be applied for feature to work, identify clearly but still fix client/API defects. Return root cause, files, results, and exact deployment prerequisite."
created: 2026-07-31T00:42:00+07:00
updated: 2026-07-31T00:48:00+07:00
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Realtime delivery fails silently because broadcastSocialEvent ignores both thrown httpSend errors and its { success: false } result; reaction route therefore returns 200 and UI reports success despite no delivered event."
  confirming_evidence:
    - "broadcastSocialEvent catches every httpSend exception and always returns undefined."
    - "Installed realtime-js declares httpSend can resolve { success: false, status, error }, not only throw."
    - "Reaction route awaits broadcaster but does not inspect delivery result before returning data."
  falsification_test: "Mock broadcaster to resolve false; POST /api/friends/reactions must currently return 200, then return 503 after targeted route change."
  fix_rationale: "Expose broadcaster delivery success and make the reaction API fail closed when no realtime event was accepted, so UI cannot claim a reaction was sent when recipient gets none."
  blind_spots: "Remote Supabase migration cannot be queried because project is not linked; browser-to-recipient Realtime delivery still needs two-account verification after deployment."
hypothesis: Realtime broadcast rejection is hidden and reports a false reaction-send success.
test: focused route tests verify success, malformed payload rejection, and failed delivery response.
expecting: HTTP 200 only after Realtime accepts delivery; HTTP 503 when it does not.
next_action: verify two authenticated accounts after applying social migration to target Supabase project.

## Symptoms

expected: Sending a preset playful reaction from Friends action reports success and recipient receives reaction.
actual: Sending a playful reaction from Friends action does not work.
errors: none supplied
reproduction: Open Friends menu, select friend action, choose Gửi phản ứng, choose preset.
started: current local state

## Eliminated

## Evidence

- timestamp: 2026-07-31T00:42:00+07:00
  checked: FriendActionMenu, FriendsMenu, reaction route, realtime broadcaster, social migration
  found: UI invokes sendPresetReaction(userId, reactionId); route calls public.send_preset_reaction then broadcasts recipient topic; RPC exists only in migration 20260730170000_friends_messages_presence.sql.
  implication: failure can come from missing client module/contract, unavailable database migration/RPC, RPC authorization, or broadcast delivery.
- timestamp: 2026-07-31T00:44:00+07:00
  checked: Reaction client/API contract, auth helper, overlay subscription, local dev logs, focused tests
  found: Client payload, Zod contract, authenticated RPC arguments, recipient topic, and overlay event all match. Dev logs show no reaction POST; current focused suite passes reaction path but has unrelated friends-list assertion drift from avatarUrl addition.
  implication: Static request contract is not broken; missing runtime POST leaves deployment state and Realtime delivery as primary candidates.
- timestamp: 2026-07-31T00:46:00+07:00
  checked: Installed @supabase/realtime-js httpSend contract and server broadcaster
  found: httpSend resolves either { success: true } or { success: false, status, error }, while broadcastSocialEvent discarded its result and caught every throw. Reaction route then returned HTTP 200 regardless.
  implication: Realtime rejection produced a false "Đã gửi phản ứng." success and no recipient reaction.
- timestamp: 2026-07-31T00:46:00+07:00
  checked: Remote migration status
  found: `npx supabase migration list` returned LegacyProjectNotLinkedError because this checkout has no linked Supabase project.
  implication: Remote existence of send_preset_reaction and realtime RLS policies cannot be verified locally; migration deployment remains a required external check.

## Resolution

root_cause: broadcastSocialEvent swallowed Realtime REST broadcast failures and ignored the documented { success: false } result from channel.httpSend. The reaction route therefore returned 200 and FriendActionMenu announced success even though recipient event was not accepted or delivered.
fix: broadcastSocialEvent now returns delivery success; POST /api/friends/reactions returns 503 reaction_unavailable when Realtime rejects or throws. Added regression assertion for rejected delivery.
verification: `npm run test -- src/lib/client/messages.test.ts src/app/api/friends/reactions/route.test.ts` passed (2 tests). Editor diagnostics are clean. Full social suite remains blocked by unrelated friends-list avatarUrl assertion drift. `npm run typecheck` remains blocked by unrelated locale catalog/type drift.
files_changed:
  - src/lib/server/friends/realtimeBroadcast.ts
  - src/app/api/friends/reactions/route.ts
  - src/app/api/friends/reactions/route.test.ts
