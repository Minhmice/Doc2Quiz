---
status: complete
quick_task: 260802-0nr-fix-friendshubclient-studywith-modal-lau
subsystem: social
tags: [friends, study-challenges, supabase, realtime, nextjs, vitest]
requires:
  - phase: 12
    provides: authenticated friend APIs, study challenges, notifications, and HTTP-authoritative social counts
provides:
  - authenticated metadata-only challenge quiz source
  - safe studyWith friend handoff into existing challenge dialog
  - shared HTTP-authoritative SocialCountsSnapshot refresh path
affects: [friends, study-together, notifications, topbar]
tech-stack:
  added: []
  patterns: [server-side ownership filtering, URL handoff resolved through accepted-friend data, realtime invalidation with HTTP reconciliation]
key-files:
  created:
    - src/app/api/friends/study-challenges/sources/route.ts
    - src/app/api/friends/study-challenges/sources/route.test.ts
  modified:
    - src/app/(app)/friends/FriendsHubClient.tsx
    - src/components/friends/FriendsHub.tsx
    - src/components/friends/FriendsHub.test.tsx
    - src/components/friends/StudyChallengeDialog.tsx
    - src/components/layout/FriendsMenu.tsx
    - src/lib/client/studyTogether.ts
    - src/lib/client/studyTogether.test.ts
    - src/lib/client/socialCounts.ts
    - src/lib/client/socialCounts.test.ts
key-decisions:
  - "Resolve studyWith only through the authenticated accepted-friend list; query parameters never authorize challenge recipients."
  - "Keep realtime payloads as invalidation signals; authenticated HTTP remains source of displayed counts and notifications."
requirements-completed: []
duration: 35min
completed: 2026-08-02
---

# Quick Task 260802-0nr: Study challenge handoff and social count consolidation

**Authenticated owned-quiz challenge sources, safe friend handoff modal launch, and one HTTP-authoritative social unread snapshot.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-02T00:37:00+07:00
- **Completed:** 2026-08-02T01:14:00+07:00
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added authenticated `GET /api/friends/study-challenges/sources`, returning only current-user-owned, ready, non-deleted quiz metadata with positive approved-question counts.
- Connected `/friends?studyWith={acceptedFriendId}` through `FriendsHubClient` and `FriendsHub`; accepted-friend resolution gates dialog rendering, and closing removes handoff query while preserving destination.
- Consolidated unread counts and notifications into `SocialCountsSnapshot`; realtime only schedules authenticated HTTP reconciliation. Updated FriendsMenu and notification actions to consume the aggregate path.

## Task Commits

1. **Task 1: Authenticated challenge quiz source and dialog states** — `1e83c23` (feat)
2. **Task 2: StudyWith handoff into existing dialog** — `50d1708` (feat)
3. **Task 3: Shared social unread snapshot** — `02d1b8b` (feat)

## Verification

- `npm test -- --run src/lib/client/studyTogether.test.ts src/app/api/friends/study-challenges/sources/route.test.ts src/components/friends/FriendsHub.test.tsx src/lib/client/socialCounts.test.ts src/components/friends/NotificationsMenu.test.tsx` — 5 files, 13 tests passed.
- `npm run typecheck` — passed.
- Scoped ESLint — 0 errors; one existing `@next/next/no-img-element` warning remains in `FriendsMenu.tsx`.
- `git diff --check` — passed for task files.

## Decisions Made

- Server filters challenge source ownership and readiness; client validates response shape but never substitutes unauthorized or guessed content.
- `FriendsHub` verifies the URL ID against `listAcceptedFriends()` before rendering `StudyChallengeDialog`.
- `SocialCountsSnapshot` is refreshed from authenticated HTTP after realtime events, focus, and visibility changes; event payloads never become display truth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted select change handlers to nullable Base UI values**
- **Found during:** Verification after Tasks 1–2
- **Issue:** `Select` callbacks accept `string | null`, while direct state setters required `string`.
- **Fix:** Coalesced nullable values before updating controlled state.
- **Files modified:** `src/components/friends/StudyChallengeDialog.tsx`
- **Verification:** `npm run typecheck` passed.
- **Committed in:** `1e83c23`

**2. [Rule 3 - Blocking] Stabilized FriendsHub effect dependency**
- **Found during:** Scoped lint
- **Issue:** `load` function identity triggered exhaustive-deps warning.
- **Fix:** Wrapped loader in `useCallback` and depended on stable callback.
- **Files modified:** `src/components/friends/FriendsHub.tsx`
- **Verification:** Focused lint warning removed; tests and typecheck passed.
- **Committed in:** `50d1708`

### Plan adaptation

- Existing repository already had `NotificationsMenu` consuming a caller-provided reconciliation callback. Kept that API and typed it with `SocialCountsSnapshot` rather than adding a second controller or changing unrelated shell composition.
- Existing staged Phase 14 planning files and unrelated user edits remained untouched. Quick plan file was unavailable in current checkout despite prompt reference; implementation followed task requirements and prior transcript context.

**Total deviations:** 2 auto-fixed issues plus 1 minimal integration adaptation.
**Impact on plan:** All changes stayed within requested social/challenge scope; no dependency or schema changes added.

## Issues Encountered

- Full repository typecheck initially exposed unrelated pre-existing `src/lib/server/friends/socialLists.test.ts` argument-count errors. Task-related errors were fixed; second typecheck passed.
- Full lint invocation with `--file` is incompatible with repository ESLint flat config. Direct scoped ESLint invocation used instead.
- Working tree contained staged Phase 14 planning work, broad unrelated modifications, generated output, and an untracked Phase 14 migration. None were staged by this quick task.

## Known Stubs

None in task-created or task-modified flow. Empty quiz/source states are intentional authenticated empty/error states.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new authenticated endpoint | `src/app/api/friends/study-challenges/sources/route.ts` | Adds metadata-only source listing; requires authenticated API user, filters by `created_by`, `kind`, `status`, and `deleted_at`, and returns no question content. |

## Self-Check: PASSED

- Summary path exists.
- Commits `1e83c23`, `50d1708`, and `02d1b8b` exist.
- Focused tests and typecheck pass.
- No task commit deleted tracked files.

## User Setup Required

None.

---
*Quick task: 260802-0nr*
*Completed: 2026-08-02*
