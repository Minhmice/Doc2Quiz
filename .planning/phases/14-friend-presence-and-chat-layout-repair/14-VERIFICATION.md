---
phase: 14-friend-presence-and-chat-layout-repair
verified: 2026-08-01T20:15:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Dùng hai tài khoản đã chấp nhận nhau với hơn 20 bạn ở mỗi bucket; phân trang Online và Offline."
    expected: "Online chỉ chứa presence online; Offline chỉ chứa recently_active/offline; Load more không bỏ sót, trùng hoặc dùng chéo cursor."
    why_human: "Không có database được phê duyệt và test hiện có chỉ mock RPC, không chứng minh dữ liệu SQL thật qua nhiều trang."
  - test: "Giữ Friends mở, cho bạn chuyển qua/ngược mốc 5 phút; kích hoạt focus, visibility và chờ cadence 60 giây."
    expected: "Bucket hiện tại refetch trang đầu; membership cũ biến mất khỏi bucket sai và không bị di chuyển cục bộ."
    why_human: "Test controller kiểm tra lịch callback, chưa chạy Next.js UI với activity thật và thời gian thật."
  - test: "Mở dialog desktop và route mobile; gửi câu dài có khoảng trắng và token 2.000 ký tự ở 375px và desktop."
    expected: "Tin nhắn incoming/outgoing không gây overflow ngang; reload, tải lịch sử cũ, reconnect, read và send vẫn giữ dữ liệu."
    why_human: "Node-Vitest kiểm tra class/controller contract, không đo layout trình duyệt hoặc flow hai tài khoản."
  - test: "Chạy static/runtime SQL proof trên local hoặc disposable Supabase được phê duyệt bằng PHASE12_TEST_DATABASE_URL."
    expected: "Proof xác nhận function 3 tham số, predicate bucket trong rows trước cursor/order/limit, scope auth/block và grant authenticated."
    why_human: "PHASE12_TEST_DATABASE_URL đang unset; không được tự chọn database hoặc chạy vào production/shared DB."
---

# Phase 14: Friend presence and chat layout repair — Verification Report

**Phase Goal:** Friends appear in their actual presence tab with offline presence visuals suppressed, while all chat messages remain readable inside their bubbles.
**Verified:** 2026-08-01T20:15:00Z
**Status:** HUMAN_NEEDED — code and focused behavior contracts pass; manual UI, live data, and approved SQL proof remain.
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Online requests return only server-derived online friends. | ✓ VERIFIED | `supabase/migrations/20260801233000_phase14_friend_presence_bucket.sql:18-36` computes presence in `rows` and applies online predicate before `page`; adapter sends `p_presence: "online"` in `src/lib/server/friends/socialLists.ts:53`; adapter test passes. |
| 2 | Offline requests return only recently-active or offline friends. | ✓ VERIFIED | Same SQL rows predicate maps offline to ranks 1/2; SQL output maps ranks to `recently_active`/`offline` at migration lines 45-55; offline adapter test passes. |
| 3 | Each bucket has independent complete keyset paging and cursors cannot replay across buckets. | ✓ VERIFIED | `socialLists.ts:10-19,22-43,53` binds friends cursors to destination, version and presence, requests limit-plus-one, trims results, and creates continuation from final returned tuple; `socialLists.test.ts` covers cross-bucket rejection and stable tuple. |
| 4 | Invalid presence and unauthenticated/untrusted query paths fail before social data access. | ✓ VERIFIED | `socialListQuery.ts:8-24` accepts only `online|offline`; `src/app/api/friends/route.ts:6-15` authenticates before parsing and maps invalid/cursor errors to generic responses; route tests cover default, valid, invalid, and auth-first behavior. |
| 5 | Offline/recently-active rows expose no online dot, ping, or online-status label; online rows retain online treatment. | ✓ VERIFIED | `FriendActionMenu.tsx:28-40,71-76` gates dot and online label on strict `presence === "online"`; `DirectMessageDialog.tsx:12-16,47` derives header online treatment from the same enum and uses existing last-active fallback otherwise; focused tests pass. |
| 6 | Open Friends bucket refreshes after focus, visible-document recovery, 60-second cadence, and earliest online five-minute boundary, with cleanup/stale guards. | ✓ VERIFIED | `FriendsHub.tsx:42-113` implements lifecycle controller and transition timer; `FriendsHub.tsx:128-164` resets first page, guards request identity and binds controller to current destination/bucket; tests cover lifecycle callbacks and cleanup. Live transition still needs human check. |
| 7 | Long ordinary and unbroken text stays within incoming/outgoing bubbles on desktop and mobile. | ✓ VERIFIED | `ConversationView.tsx:22-25,137` applies shared `min-w-0 wrap-anywhere max-w-[75%]` classes to both directions; desktop dialog and mobile page both render `ConversationView` (`DirectMessageDialog.tsx:8,48`; `ConversationPageClient.tsx:6,20`); four text/direction tests pass. |
| 8 | Existing paging, realtime invalidation, durable history, read/send reconciliation, and responsive shells remain wired. | ✓ VERIFIED | `ConversationView.tsx:33-81,114-140` preserves before-cursor history, dedupe/order merge, private realtime invalidation, read, send, focus/visibility reconciliation, and shared rendering; controller/history tests pass; mobile shell remains in `ConversationPageClient.tsx:10-20`. |

**Score:** 8/8 observable truths verified at source/unit-contract level.

## Deferred / Blocked Checks

| Item | Status | Exact gap |
|---|---|---|
| Runtime SQL proof | BLOCKED / DEFERRED | `PHASE12_TEST_DATABASE_URL` is unset. No approved local/disposable Supabase target exists, so runtime SQL must not run. |
| Static SQL proof contract | UPDATED | `supabase/tests/phase12_bounded_social_lists.sql:5-11` now checks the `p_presence` bucket predicates and shared `CASE` expression used by the migration. Runtime proof remains deferred without an approved database URL. |

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/20260801233000_phase14_friend_presence_bucket.sql` | Additive bucket predicate before keyset page | ✓ VERIFIED | Exists, substantive SQL, preserves auth scope/block exclusion, `SECURITY DEFINER`, restricted search path, bounded limit, and authenticated grant. New 3-argument function is referenced by route adapter. |
| `supabase/schemas/70_functions.sql` | Final schema mirror and grants | ✓ VERIFIED | Contains 3-argument function at line 3350 and authenticated-only grants at lines 3701-3703. |
| `supabase/tests/phase12_bounded_social_lists.sql` | Static SQL signature/order/grant proof | ✓ UPDATED | Exists and checks signature, bucket predicates, CASE expression, ordering, auth/block scope, and grant. Runtime unavailable. |
| `src/lib/server/friends/socialLists.ts` | Typed bucket-bound cursor/RPC adapter | ✓ VERIFIED | Exports `PresenceBucket`, `listSocialFriends`; real route consumer and focused tests. |
| `src/lib/server/friends/socialListQuery.ts` | Zod presence parser | ✓ VERIFIED | Friends-only enum parser, default offline, limit/cursor validation. Route imports and uses it. |
| `src/app/api/friends/route.ts` | Authenticated API boundary | ✓ VERIFIED | Auth first, parser second, typed adapter forwarding, generic error mapping. |
| `src/lib/client/friends.ts` | Enum DTO and bucket page client | ✓ VERIFIED | `AcceptedFriendSummary.presence` is sole enum; page helper sends limit, bucket and server cursor. FriendsHub and launcher consume it. |
| `src/components/friends/FriendsHub.tsx` | URL-authoritative bucket tabs and refresh lifecycle | ✓ VERIFIED | Real client fetch, request identity guard, page reset, tab URL state, lifecycle controller, and render wiring. |
| `src/components/layout/FriendsMenu.tsx` | Compact launcher enum grouping and dialog handoff | ✓ VERIFIED | Splits strictly by presence and passes real enum to action/dialog components. |
| `src/components/friends/FriendActionMenu.tsx` | Online-only visual affordance | ✓ VERIFIED | Dot/label only in strict online branch; actions remain wired for all enum values. |
| `src/components/friends/DirectMessageDialog.tsx` | Enum-derived header | ✓ VERIFIED | No stale `isOnline: boolean`; online header status derives from presence enum. |
| `src/components/friends/ConversationView.tsx` | Shared safe bubble and preserved chat controller | ✓ VERIFIED | CSS-only wrapping change; durable history/realtime/send/read controller remains substantive and consumed by both shells. |
| Focused tests under `src/components/friends/*.test.tsx`, `src/lib/server/friends/socialLists.test.ts`, `src/lib/client/messages.test.ts` | Behavior proof | ✓ VERIFIED | Phase 14 UI/chat tests pass 26/26; server cursor tests pass 3/3; message client test passes 1/1; relevant route/client presence assertions pass. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `src/app/api/friends/route.ts` | `src/lib/server/friends/socialListQuery.ts` | `parseFriendsListQuery` after `requireApiUser` | ✓ WIRED | Imports parser and calls it only after auth at route lines 6-10. |
| `src/lib/server/friends/socialLists.ts` | `public.list_social_friends` | RPC name plus `p_presence` and bucket-bound cursor | ✓ WIRED | `listSocialFriends` passes `p_presence` and cursor decoder receives requested bucket. |
| Phase 14 migration | `public.list_social_friends` | `rows` bucket predicate before page cursor/order/limit | ✓ WIRED | `rows` closes at line 36; `page` cursor/order/limit starts lines 37-43. |
| `FriendsHub.tsx` | `src/lib/client/friends.ts` | `listAcceptedFriendPage(presence, cursor)` | ✓ WIRED | `load` passes active bucket and optional server cursor at line 132. |
| `FriendsHub.tsx` | refresh controller | focus/visibility/cadence/transition callbacks | ✓ WIRED | Controller is created, started, rescheduled on page replacement, and stopped on effect cleanup. |
| `FriendsMenu.tsx` | `DirectMessageDialog.tsx` | `friend={messageFriend}` | ✓ WIRED | `messageFriend` is real `AcceptedFriendSummary` selected from launcher and passed at line 103. |
| `FriendsMenu.tsx` | `FriendActionMenu.tsx` | strict enum presence prop | ✓ WIRED | Both online/offline groups pass `presence={friend.presence}` at lines 92 and 97. |
| `DirectMessageDialog.tsx` | `friend.presence` | strict `presence === "online"` | ✓ WIRED | Header helper and render branch use enum, no second serialized boolean. |
| `ConversationView.tsx` | desktop dialog/mobile page | shared component import/render | ✓ WIRED | Both shells render the same `ConversationView`; shared bubble class is single source. |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| `FriendsHub.tsx` | `page` | Authenticated `/api/friends?limit=20&presence=...&cursor=...` through `listAcceptedFriendPage` | Yes; API delegates to authenticated Supabase RPC | ✓ FLOWING |
| `FriendsMenu.tsx` | `friends` | `listAcceptedFriends`, which requests bounded online and offline pages | Yes; no static friend list | ✓ FLOWING |
| `DirectMessageDialog.tsx` | `conversationId`, messages | `openDirectConversation` and `ConversationView` controller | Yes; protected conversation/history APIs and private realtime invalidation | ✓ FLOWING |
| `ConversationView.tsx` | `state.messages` | `transport.list`, `transport.send`, `transport.read`, and private channel invalidation | Yes; durable history is display authority | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Cursor/RPC bucket contract | `npx vitest run src/lib/server/friends/socialLists.test.ts` | 3 tests passed | ✓ PASS |
| FriendsHub, enum visuals, bubble classes, history/controller | `npx vitest run src/components/friends/FriendsHub.test.tsx src/components/friends/DirectMessageDialog.test.tsx src/components/friends/FriendActionMenu.test.tsx src/components/friends/ConversationView.test.tsx src/lib/client/messages.test.ts` | 26 tests passed | ✓ PASS |
| Full Plan 14-02 focused command including legacy friends client test | Same command plus `src/lib/client/friends.test.ts` | 35 passed, 1 failed: `incoming.items is not iterable` in legacy friend-request aggregation | ⚠️ NEEDS REVIEW; unrelated to Phase 14 bucket behavior |
| Plan 14-01 route/client aggregate command | `npx vitest run src/lib/server/friends/socialLists.test.ts src/app/api/friends/friends.route.test.ts src/lib/client/friends.test.ts` | 43 passed, 5 failed; failures are legacy request/block/overview response-shape fixtures, not Phase 14 presence assertions | ⚠️ NEEDS REVIEW |
| TypeScript | `npm run typecheck` | Exit 0 after generated `.next` types existed | ✓ PASS |
| Production build | `npm run build` | Compiled successfully; TypeScript and static page generation completed; exit 0 | ✓ PASS |
| Target implementation lint | `npx eslint` on Phase 14 implementation files | 0 errors, 7 warnings (ignored SQL file plus existing image/hook warnings) | ✓ PASS with warnings |
| Repository lint | `npm run lint` | Exit 1: 2 errors, 49 warnings; errors in `src/app/share/[token]/page.tsx` and `src/legacy/loading/PageTransitionProvider.tsx` | ⚠️ NEEDS REVIEW; pre-existing/out of Phase 14 scope |

## Probe Execution

No `probe-*.sh` was declared by Phase 14 plans, and no Phase 14 probe was found. Static SQL proof was not executed because the approved database URL is unavailable.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SOCIAL-09 | 14-01, 14-02 | `/friends` provides scalable destinations and compact launcher | ✓ SATISFIED at code/contract level | Bounded RPC, keyset cursor, validated bucket query, URL tabs, launcher grouping, and relevant tests. Manual >20-row paging remains required. |
| SOCIAL-10 | 14-02 | Chat works on mobile/desktop, resumes durable history, safely receives realtime updates | ✓ SATISFIED at code/contract level | Shared `ConversationView` remains used by desktop/mobile, controller tests cover before cursor/dedupe/reconnect/read/send, and bubble class protects long text. Browser layout/history flow remains human verification. |

No orphaned Phase 14 requirement IDs found in `REQUIREMENTS.md`; roadmap and both plans map SOCIAL-09/SOCIAL-10.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| Phase 14 implementation files | — | No TODO/FIXME/XXX/HACK/placeholder markers or placeholder returns found | — | No phase stub detected. |
| `src/components/friends/ConversationView.tsx` | 101 | Raw `<img>` warning | Info | Existing performance/lint warning; does not affect message wrapping or chat data flow. |
| `src/components/friends/DirectMessageDialog.tsx` | 28, 42 | Raw `<img>` and missing hook dependency warnings | Warning | Existing warning; no Phase 14 functional failure observed. |
| `src/components/friends/FriendActionMenu.tsx` | 74 | Raw `<img>` warning | Info | Existing performance warning. |
| `src/components/layout/FriendsMenu.tsx` | 34, 68 | Missing hook dependency and raw `<img>` warnings | Warning | Existing warning; no Phase 14 functional failure observed. |
| `supabase/tests/phase12_bounded_social_lists.sql` | 5-11 | Runtime proof not executed | Info | Static contract now matches migration predicates; execute against approved database before claiming runtime SQL gate passed. |

## Human Verification Required

### 1. Real bucket pagination

**Test:** Use two accepted accounts with more than 20 friends across Online and Offline. Page both tabs fully, including Load more and cursor reuse attempts.

**Expected:** Online contains only online; Offline contains recently_active/offline; no duplicate, skipped row, or cross-bucket cursor replay.

**Why human:** Requires approved populated database and real API/RPC results; current tests mock adapter payloads.

### 2. Presence transition refresh

**Test:** Leave Friends open. Trigger focus and visibility recovery, wait one 60-second cadence, and move a friend across five-minute activity boundary.

**Expected:** Current bucket refetches first page and stale membership disappears without local row movement.

**Why human:** Requires real activity timestamps, browser lifecycle, and live timer behavior.

### 3. Desktop/mobile chat layout and durability

**Test:** Send normal long text and a 2,000-character unbroken token in both directions at 375px and desktop. Reload, load older history, reconnect, mark read, and send again.

**Expected:** No horizontal viewport overflow; messages remain persisted, ordered, deduplicated, and visible in both shells.

**Why human:** CSS layout, responsive viewport behavior, persistence, and realtime reconnection cannot be proven by Node-only tests.

### 4. Runtime SQL proof

**Test:** Set `PHASE12_TEST_DATABASE_URL` only to an approved local/disposable Supabase target and run the repository SQL proof.

**Expected:** Function signature, bucket-before-pagination predicate, auth/block scope, search path/security attributes, and authenticated grant all pass.

**Why human:** External database prerequisite unavailable; never substitute production/shared target.

## Gaps Summary

Phase 14 implementation goal is supported by source-level data-flow evidence and all Phase 14-specific focused behavior tests. Remaining review items are validation gaps, not an observed missing UI/API artifact:

1. Runtime SQL proof is deferred because `PHASE12_TEST_DATABASE_URL` is unset.
2. Static SQL proof contract now matches migration CASE spelling; runtime execution remains deferred until an approved database target is available.
3. The requested aggregate test command is not clean because it includes unrelated legacy fixtures: one client `incoming.items` mismatch and four route tests expecting retired overview/blocked/request shapes. These failures were reproduced and are outside the Phase 14 presence/chat paths.
4. Repository lint remains red from two unrelated existing errors; target Phase 14 lint has no errors.
5. Manual two-account and browser viewport/realtime checks remain outstanding.

**Overall assessment:** NEEDS REVIEW (`human_needed`). Phase 14 code goal appears achieved; do not mark fully passed until manual scenarios and approved SQL proof complete, and record whether legacy test/lint failures are accepted baseline debt.

---

_Verified: 2026-08-01T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
