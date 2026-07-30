---
phase: 10-safe-collaboration-sharing-friends
plan: 09
subsystem: api
tags: [supabase, workspace, collaboration, permissions, rls]

requires:
  - phase: 10-safe-collaboration-sharing-friends
    plan: 02
    provides: requireWorkspacePermission intent guard and membership-backed RLS
provides:
  - Shared edit guard on six Phase 9 workspace-native mutation routes
  - Focused permission matrix route tests for owner/editor/viewer/outsider
affects:
  - 10-10 settings and collaboration UI verification

tech-stack:
  added: []
  patterns:
    - "Route-level requireWorkspacePermission(edit) before mutations and generation side effects"
    - "WorkspacePermissionError maps to 403 forbidden or 404 not_found at route boundary"

key-files:
  created:
    - src/app/api/workspaces/workspaceContentPermissions.route.test.ts
  modified:
    - src/app/api/workspaces/[workspaceId]/route.ts
    - src/app/api/workspaces/[workspaceId]/documents/[documentId]/route.ts
    - src/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/route.ts
    - src/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/[documentVersionId]/canonicalize/route.ts
    - src/app/api/workspaces/[workspaceId]/outputs/quiz/route.ts
    - src/app/api/workspaces/[workspaceId]/outputs/flashcards/route.ts

key-decisions:
  - "Route-level edit guard added alongside existing lib-layer parent relation checks"
  - "Output routes check permission after body validation but before quota/pipeline work"
  - "GET workspace detail semantics unchanged; RLS-backed read access preserved"

patterns-established:
  - "Workspace content mutations use same mapPermissionError pattern as collaboration routes"

requirements-completed: [COLLAB-01, COLLAB-02]

duration: 12min
completed: 2026-07-30
---

# Phase 10 Plan 09: Workspace Content Route Authorization Summary

**Shared `requireWorkspacePermission(edit)` on six Phase 9 workspace mutation routes with a 26-case permission matrix**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-30T08:50:00Z
- **Completed:** 2026-07-30T09:02:00Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Workspace PATCH, document PATCH/DELETE, version POST/DELETE, and canonicalize POST guarded at route boundary
- Quiz and flashcard output generation deny viewers/outsiders before quota reservation or pipeline calls
- 26 focused route tests covering owner/editor allow, viewer/outsider deny, and cross-workspace rejection
- Typecheck clean for changed files; permission test suite passes

## Task Commits

1. **Task 1: Guard workspace document and canonical mutations** - `598736e` (test), `11f2606` (feat)
2. **Task 2: Guard workspace quiz and flashcard output generation** - `162412d` (feat)

**Plan metadata:** `f1dd90e` (docs)

## Files Created/Modified

- `src/app/api/workspaces/workspaceContentPermissions.route.test.ts` - Permission matrix for six mutation routes
- `src/app/api/workspaces/[workspaceId]/route.ts` - PATCH edit guard
- `src/app/api/workspaces/[workspaceId]/documents/[documentId]/route.ts` - PATCH/DELETE edit guard
- `src/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/route.ts` - POST/DELETE edit guard
- `src/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/[documentVersionId]/canonicalize/route.ts` - POST edit guard
- `src/app/api/workspaces/[workspaceId]/outputs/quiz/route.ts` - POST edit guard before quota/pipeline
- `src/app/api/workspaces/[workspaceId]/outputs/flashcards/route.ts` - POST edit guard before quota/pipeline

## Decisions Made

- Route-level guard complements (does not replace) lib-layer `requireWorkspaceEditor` and parent/workspace relation validation
- Output routes validate request body first, then permission, then quota — matching collaboration route ordering
- Permission errors return `{ error: "forbidden" | "not_found" }` without message field for consistency with collaboration APIs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing `friends.route.test.ts` typecheck errors unrelated to this plan; scoped verification used focused test run only

## User Setup Required

None - user confirmed remote SQL already applied.

## Next Phase Readiness

- Content routes align with RLS editor policy; ready for Plan 10-10 settings/collaboration UI verification
- Lib-layer duplicate `requireWorkspaceEditor` helpers remain for defense-in-depth (future consolidation optional)

## Self-Check: PASSED

- FOUND: src/app/api/workspaces/workspaceContentPermissions.route.test.ts
- FOUND: 598736e
- FOUND: 11f2606
- FOUND: 162412d

---
*Phase: 10-safe-collaboration-sharing-friends*
*Completed: 2026-07-30*
