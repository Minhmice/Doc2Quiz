---
phase: 09-workspace-centered-learning-canonical-provenance
plan: 06
subsystem: api
tags: [workspace, dashboard, summary, aggregate, navigation, RLS]

requires:
  - phase: 09-05
    provides: workspace quiz/flashcard generate clients and bridge setId routes
  - phase: 09-02
    provides: workspace write APIs; deferred GET list/detail to 09-06
  - phase: 09-03
    provides: progressive CanonicalSourceReview for detail reader
provides:
  - listWorkspaceSummaries / getWorkspaceDetail aggregate read models
  - GET /api/workspaces and GET /api/workspaces/[workspaceId]
  - /workspace/[workspaceId] detail page with document/version/output navigation
  - Dashboard home migrated off study-set N+1 to one workspace summary fetch
affects:
  - 09-07/09-08 legacy dashboard/study-set adapters
  - Phase 10 collaboration UI (out of scope here)

tech-stack:
  added: []
  patterns:
    - Membership-authorized aggregate queries; no per-workspace browser count loops
    - Soft-deleted sources excluded from active document/canonical counts; outputs preserved
    - Summary/detail selects never include canonical_markdown / raw_markdown / body_markdown

key-files:
  created:
    - src/lib/workspaces/workspaceSummary.ts
    - src/lib/workspaces/workspaceSummary.test.ts
    - src/app/api/workspaces/route.ts
    - src/app/api/workspaces/route.test.ts
    - src/app/(app)/workspace/[workspaceId]/page.tsx
    - src/components/workspaces/WorkspaceDetailClient.tsx
  modified:
    - src/app/api/workspaces/[workspaceId]/route.ts
    - src/app/api/workspaces/[workspaceId]/route.test.ts
    - src/hooks/useDashboardHome.ts
    - src/components/dashboard/DashboardHomeClient.tsx
    - src/lib/client/workspaceApi.ts
    - src/lib/client/appDataCache.ts
    - src/lib/client/appDataCache.test.ts

key-decisions:
  - "Dashboard cache bumped to v2 workspaces payload; legacy study-set cache key invalidated"
  - "Mistakes URL filter returns empty without reintroducing per-set N+1 reads"
  - "Workspace detail embeds progressive CanonicalSourceReview; outputs link via bridgeStudySetId"

patterns-established:
  - "assertNoMarkdownSelection on every summary/detail select clause"
  - "One GET /api/workspaces replaces listStudySetMetas + per-set bank/mistake loops"
  - "Dashboard cards navigate to /workspace/{id}; practice/overview use bridge set routes"

requirements-completed: [WORK-02, WORK-08, WORK-09]

duration: 25min
completed: 2026-07-30
---

# Phase 09: Plan 06 Summary

**Workspace-native dashboard aggregate reads and detail navigation without browser N+1 or canonical body markdown**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-30T06:44:00+07:00
- **Completed:** 2026-07-30T06:53:00+07:00
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- `listWorkspaceSummaries` / `getWorkspaceDetail` return membership-scoped roles, active document/canonical counts, and output metadata without selecting body markdown
- Soft-deleted sources drop from active document/canonical inventories while learning outputs remain listed and practice-reachable
- Dashboard fetches `/api/workspaces` once; workspace cards open `/workspace/{id}` for reader, generate-from-selection, overview, and practice bridges

## Task Commits

Each task was committed atomically:

1. **Task 1: Create aggregate workspace summary API** - `eaea096` (feat)
2. **Task 2: Add workspace detail route and navigation** - `bfbf0b8` (feat)

**Plan metadata:** (this commit)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `src/lib/workspaces/workspaceSummary.ts` — aggregate list/detail services + markdown select guard
- `src/app/api/workspaces/route.ts` — GET workspace summaries
- `src/app/api/workspaces/[workspaceId]/route.ts` — GET detail beside existing PATCH
- `src/app/(app)/workspace/[workspaceId]/page.tsx` — reachable post-ingest detail route
- `src/components/workspaces/WorkspaceDetailClient.tsx` — documents/versions/outputs navigation
- `src/hooks/useDashboardHome.ts` — single summary fetch; preserve refresh/cache/URL filters
- `src/components/dashboard/DashboardHomeClient.tsx` — workspace cards → `/workspace/{id}`
- `src/lib/client/workspaceApi.ts` / `appDataCache.ts` — client fetch helpers + v2 cache

## Decisions Made
- Aggregate in a few membership-scoped queries (not one round-trip per workspace)
- Keep mistakes filter plumbing but do not reintroduce N+1 mistake reads from summary
- Flashcard generate from detail uses memorize / entire_document / recommended defaults

## Deviations from Plan

### Auto-fixed Issues

None.

### Deferred Issues

**1. [Rule 3 - Speed] Mistakes practice filter empty without aggregate mistake field**
- **Found during:** Task 2 dashboard migration
- **Issue:** Summary DTO has no per-workspace mistake flags; prior hook used N+1 `hasMistakesForStudySet`
- **Instead:** `practice=mistakes` filters to empty rather than restoring browser N+1
- **Reason:** Plan requires one aggregate request; mistake aggregation belongs with later activity/output APIs
- **Impact:** Mistakes chip shows no workspaces until a future aggregate field exists
- **Logged for:** Phase 09 follow-up / activity aggregate if needed

---
*Affects future plans that assume dashboard mistakes filtering still lists sets*

## Verification
- `npm run test -- src/lib/workspaces/workspaceSummary.test.ts src/app/api/workspaces/route.test.ts src/app/api/workspaces/[workspaceId]/route.test.ts --run` — 21 tests passed
- `npm run typecheck` — passed against HEAD app layout (dirty WIP layout has unrelated TS2589)
- `src/hooks/useDashboardHome.test.ts` — URL param contract still passes

## Self-Check: PASSED

- [x] `src/lib/workspaces/workspaceSummary.ts` exists
- [x] `src/app/api/workspaces/route.ts` exists
- [x] `src/app/(app)/workspace/[workspaceId]/page.tsx` exists
- [x] `src/components/workspaces/WorkspaceDetailClient.tsx` exists
- [x] Commits `eaea096` and `bfbf0b8` present on branch
