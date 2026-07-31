---
phase: 12-study-together
plan: 09
subsystem: social-ui
tags: [react, supabase-realtime, cursor-pagination, responsive-chat, vitest]
requires:
  - phase: 12-03
    provides: durable social count reconciliation
  - phase: 12-05
    provides: distinct message action and safe friend projection
  - phase: 12-07
    provides: participant-bound private message topics
provides:
  - Shared durable conversation controller and accessible message view
  - Full-screen safe-area mobile conversation route
  - Preserved desktop floating dialog shell
  - Cursor, reconnect, lifecycle, dedupe, and responsive contract tests
affects: [social-chat, friends-hub]
tech-stack:
  added: []
  patterns: [events-as-invalidation, durable-history-reconciliation, shared-responsive-controller]
key-files:
  created: [src/components/friends/ConversationView.tsx, src/components/friends/ConversationView.test.tsx, src/app/(app)/friends/messages/[conversationId]/page.tsx, src/app/(app)/friends/messages/[conversationId]/ConversationPageClient.tsx]
  modified: [src/components/friends/DirectMessageDialog.tsx, src/components/layout/FriendsMenu.tsx, src/lib/client/messages.test.ts]
key-decisions:
  - "Realtime message payloads only invalidate; authenticated cursor history remains display authority."
  - "Mobile friend actions deep-link to full-screen chat while desktop actions retain floating dialog presentation."
patterns-established:
  - "One conversation controller owns cursor paging, ID dedupe, read watermark, send reconciliation, subscription recovery, focus, and visibility recovery."
requirements-completed: [SOCIAL-10]
duration: 8min
completed: 2026-07-31
---

# Phase 12 Plan 09: Responsive Durable Chat Summary

**One cursor-backed conversation controller now powers mobile full-screen chat and preserved desktop dialogs with durable reconnect reconciliation**

## Performance
- **Duration:** 8 min
- **Started:** 2026-07-31T11:46:00Z
- **Completed:** 2026-07-31T11:54:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Extracted cursor history, stable ID dedupe/order, read state, send state, realtime invalidation, reconnect, focus, and visibility recovery into one shared controller/view.
- Preserved desktop floating placement, size, close control, friend avatar, and presence context.
- Added authenticated-layout mobile route with safe-area full viewport, fixed composer, scrollable history, and back navigation.
- Routed small-screen friend message actions to deep links while leaving desktop entry on dialog.

## Task Commits
1. **Task 1: Extract shared cursor and realtime conversation view** - `4bc43bf` (feat)
2. **Task 2: Add mobile full-screen conversation route** - `c59889c` (feat)

## Files Created/Modified
- `src/components/friends/ConversationView.tsx` - Shared durable conversation controller and accessible view.
- `src/components/friends/ConversationView.test.tsx` - Cursor, dedupe, reconnect, send/read, cleanup, and responsive tests.
- `src/components/friends/DirectMessageDialog.tsx` - Desktop presentation shell around shared view.
- `src/app/(app)/friends/messages/[conversationId]/page.tsx` - UUID-validating mobile/deep-link route.
- `src/app/(app)/friends/messages/[conversationId]/ConversationPageClient.tsx` - Safe-area full-screen route shell.
- `src/components/layout/FriendsMenu.tsx` - Responsive message action routing.
- `src/lib/client/messages.test.ts` - Existing `before` cursor URL contract proof.

## Decisions Made
- Events trigger authoritative refetch instead of merging payload data as truth.
- Route validates UUID before rendering; participant authorization remains existing generic 404 conversation API contract.
- Desktop shell remains `hidden md:flex`; only mobile route avoids hidden breakpoint classes.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Repository typecheck remains blocked by unrelated dirty Plan 12-08 work: missing `FriendsHub` and four route-test calls with stale signatures. Scoped conversation type filter reports no errors.
- Repository lint remains blocked by four pre-existing unrelated errors: two `@ts-nocheck` route tests, JSX inside `try/catch` in public share page, and render-time `Date.now()` in legacy loading provider.
- Scoped Plan 12-09 lint has zero errors and three existing `<img>` optimization warnings.

## Known Stubs
None.

## Threat Flags
| Flag | File | Description |
|---|---|---|
| threat_flag: private-realtime-client | `src/components/friends/ConversationView.tsx` | Participant-bound private topic reconnects only as invalidation and refetches authenticated durable history. |
| threat_flag: route-identifier | `src/app/(app)/friends/messages/[conversationId]/page.tsx` | User-controlled UUID reaches existing participant-only API; unavailable responses remain generic. |

## User Setup Required
None.

## Next Phase Readiness
- SOCIAL-10 responsive chat implementation complete.
- Full phase verification still carries existing disposable SQL target blocker and unrelated dirty Plan 12-08 compile work.

## Self-Check: PASSED
- All seven planned files exist.
- Task commits `4bc43bf` and `c59889c` exist.
- Focused Vitest: 5/5 passed.
- Scoped ESLint: 0 errors, 3 warnings.
- Scoped TypeScript filter: no Plan 12-09 errors.

---
*Phase: 12-study-together*
*Completed: 2026-07-31*
