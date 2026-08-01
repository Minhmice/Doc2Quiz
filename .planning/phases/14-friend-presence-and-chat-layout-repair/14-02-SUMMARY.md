---
phase: 14-friend-presence-and-chat-layout-repair
plan: 02
subsystem: ui
tags: [react, nextjs, tailwind, vitest, friends, chat]

# Dependency graph
requires:
  - phase: 14-friend-presence-and-chat-layout-repair
    provides: server-filtered online/offline friend pages, bucket-bound cursors, and enum-only accepted-friend DTO
provides:
  - URL-authoritative Online/Offline Friends tabs using independent server-bucketed page requests
  - bounded FriendsHub focus, visibility, cadence, and five-minute presence-boundary refresh lifecycle
  - strict enum-derived online visuals for launcher rows and desktop message headers
  - shared flex-safe message bubble wrapping for normal and unbroken long text
 affects:
  - Phase 15 social presence scaling
  - responsive Friends and durable chat verification

# Tech tracking
tech-stack:
  added: []
  patterns:
    - presence query state defaults invalid or missing values to offline and requests matching server pages only
    - current-bucket refreshes replace the first page and ignore stale request completions
    - shared message bubbles use min-w-0 and wrap-anywhere without changing chat transport

key-files:
  created:
    - src/components/friends/DirectMessageDialog.test.tsx
    - src/components/friends/FriendActionMenu.test.tsx
  modified:
    - src/components/friends/FriendsHub.tsx
    - src/components/friends/FriendsHub.test.tsx
    - src/components/layout/FriendsMenu.tsx
    - src/components/friends/DirectMessageDialog.tsx
    - src/components/friends/FriendActionMenu.tsx
    - src/components/friends/ConversationView.tsx
    - src/components/friends/ConversationView.test.tsx

tags: [friends, presence, pagination, chat, responsive, vitest]
key-decisions:
  - "Use presence=online|offline as URL state only for Friends destination; missing or invalid values normalize to offline."
  - "Refresh the active server bucket from its first page on focus, visible-document recovery, 60-second cadence, and earliest displayed online five-minute boundary; do not move rows locally or add realtime protocol."
  - "Derive every online affordance from strict presence === online; recently_active and offline remain visually offline."
  - "Apply min-w-0 wrap-anywhere directly through the shared ConversationView bubble class so desktop and mobile retain one durable controller."

patterns-established:
  - "AcceptedFriendSummary.presence remains the sole UI presence truth."
  - "Presence refresh callbacks are lifecycle-scoped, timer-cleaned, and request-identity guarded."

requirements-completed: [SOCIAL-09, SOCIAL-10]

# Metrics
duration: 27min
completed: 2026-08-02
---

# Phase 14 Plan 02: Presence tabs and chat bubble wrapping Summary

**Friends now use URL-authoritative server-bucketed presence tabs with lifecycle revalidation, while shared desktop/mobile message bubbles safely contain normal and unbroken long text.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-01T18:54:00Z
- **Completed:** 2026-08-01T19:21:00Z
- **Tasks:** 2/2
- **Files modified:** 9 implementation/test files plus this summary

## Accomplishments

- Added Online and Offline tabs only for the Friends destination. Tab selection is URL-authoritative, resets accumulated page state, requests `listAcceptedFriendPage(presence, cursor)`, and rejects stale request completions.
- Added `createFriendsPresenceRefreshController` for focus, visible-document recovery, one-minute bounded revalidation, and earliest displayed online `lastActiveAt + 5 minutes` refresh. Cleanup removes listeners and timers on bucket, destination, or unmount changes.
- Replaced stale `isOnline` consumers with strict enum comparisons. Online rows retain dot/status treatment; recently-active and offline rows render no online affordance. Desktop dialog header uses the same enum contract.
- Added shared `min-w-0 wrap-anywhere` bubble classes for both sent and received messages. Durable history, before-cursor paging, dedupe, realtime invalidation, read reconciliation, send flow, and desktop/mobile shells remain unchanged.

## Task Commits

Each TDD task was committed atomically:

1. **Task 1 RED: presence and bubble contract tests** — `8e42a94` — `test(14-02): add presence and bubble contract tests`
2. **Task 1 GREEN: bucketed friend presence UI** — `f060517` — `feat(14-02): add bucketed friend presence UI`
3. **Task 2 GREEN: shared bubble wrapping** — `0ce868d` — `feat(14-02): contain long chat bubble text`

**Plan metadata:** summary commit follows self-check.

## Files Created/Modified

- `src/components/friends/FriendsHub.tsx` — URL bucket state, server paging reset, stale request guard, refresh controller, and lifecycle scheduling.
- `src/components/friends/FriendsHub.test.tsx` — bucket normalization, URL/paging contract, lifecycle cleanup, and tracer evidence.
- `src/components/layout/FriendsMenu.tsx` — enum-based online/offline launcher groups and dialog handoff.
- `src/components/friends/DirectMessageDialog.tsx` — exact presence enum friend contract and derived header status.
- `src/components/friends/DirectMessageDialog.test.tsx` — online/non-online header contract proof.
- `src/components/friends/FriendActionMenu.tsx` — online-only dot and status rendering.
- `src/components/friends/FriendActionMenu.test.tsx` — enum-only visual presentation proof.
- `src/components/friends/ConversationView.tsx` — shared flex-safe bubble class.
- `src/components/friends/ConversationView.test.tsx` — four direction/text-shape wrapping cases plus existing controller proof.

## Validation

- PASS — `npx vitest run src/components/friends/FriendsHub.test.tsx src/components/friends/DirectMessageDialog.test.tsx src/components/friends/FriendActionMenu.test.tsx src/components/friends/ConversationView.test.tsx src/lib/client/messages.test.ts` (26 tests)
- PASS — `npm run typecheck`
- PASS — target-file ESLint run; 0 errors, 4 existing warnings for image elements and hook dependency
- BLOCKED/OUT OF SCOPE — full requested focused command including `src/lib/client/friends.test.ts` has one pre-existing legacy fixture failure: `listFriendRequests` receives a non-page response and throws `incoming.items is not iterable`. No Plan 14-02 file was changed to alter that unrelated contract.
- BLOCKED/OUT OF SCOPE — repository-wide `npm run lint` retains pre-existing errors in `src/app/share/[token]/page.tsx` and `src/legacy/loading/PageTransitionProvider.tsx`, plus unrelated warnings.
- NOT RUN — runtime SQL proof; no approved `PHASE12_TEST_DATABASE_URL` exists.

## Decisions Made

- Keep `recently_active` inside Offline and suppress its status text and online affordances.
- Keep FriendsHub membership server-authoritative: refresh replaces the active first page instead of moving rows in browser state.
- Keep chat transport and durable history untouched; wrapping is CSS-only in the shared view.

## Deviations from Plan

None - implementation stayed within listed Plan 14-02 files, used no new package or protocol, and preserved existing social/chat architecture.

## Issues Encountered

- The full focused suite exposed an existing `src/lib/client/friends.test.ts` fixture mismatch for legacy friend-request aggregation. It is unrelated to Plan 14-02 and remains deferred rather than modifying an unlisted file.
- Repository lint already contains unrelated errors. Target-file lint has no errors.
- `STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md` were intentionally not changed because execution constraints restricted modifications to Plan 14-02 files and this summary.

## Threat Surface Scan

No new endpoint, auth path, storage path, schema, or realtime protocol was added. Existing authenticated friend page requests remain the membership authority; message bodies remain escaped React text interpolation.

## Known Stubs

None found in Plan 14-02 files.

## User Setup Required

None.

## Next Phase Readiness

Plan 14-02 implementation is ready for two-account manual verification: page more than 20 accepted friends per bucket, trigger focus/visibility and five-minute transitions, then send normal long and 2,000-character unbroken messages at mobile and desktop widths. Phase 15 can consume the preserved enum-only UI and bounded refresh boundary without a new client protocol.

## Self-Check: PASSED

- Summary file created at the required phase path.
- Task commits `8e42a94`, `f060517`, and `0ce868d` exist in repository history.
- All Plan 14-02 implementation/test files are committed.
- No unrelated existing files were staged by summary closeout.
- Focused Plan 14-02 tests and typecheck pass.

---
*Phase: 14-friend-presence-and-chat-layout-repair*
*Completed: 2026-08-02*
