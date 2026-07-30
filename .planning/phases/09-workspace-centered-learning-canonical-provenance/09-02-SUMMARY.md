---
phase: 09-workspace-centered-learning-canonical-provenance
plan: 02
subsystem: api
tags: [workspace, ingest, document-versions, soft-delete, zod, next-route]

requires:
  - phase: 09-01
    provides: create_workspace_document_version RPC, workspace schema, checksum helpers
provides:
  - Workspace-native first ingest without early study-set creation
  - Immutable document version append + metadata/soft-delete services
  - Authenticated workspace write APIs with stable error contracts
  - Import client switch to POST /api/workspaces/ingest
affects:
  - 09-03 canonical version persistence and reader
  - 09-06 workspace summary GET and detail UI
  - 09-07/09-08 legacy study-set adapters

tech-stack:
  added: []
  patterns:
    - Workspace-native services separate from legacy runIngest
    - Validate before create_workspace_document_version RPC
    - Immutable storage path {workspaceId}/{documentId}/{versionId}/...
    - Soft delete via deleted_at; never cascade to learning_outputs

key-files:
  created:
    - src/lib/workspaces/schemas.ts
    - src/lib/workspaces/errors.ts
    - src/lib/workspaces/createWorkspaceIngest.ts
    - src/lib/workspaces/createWorkspaceIngest.test.ts
    - src/lib/workspaces/documentVersions.ts
    - src/lib/workspaces/documentVersions.test.ts
    - src/lib/client/ingestWorkspace.ts
    - src/lib/client/workspaceApi.ts
    - src/app/api/workspaces/ingest/route.ts
    - src/app/api/workspaces/ingest/route.test.ts
    - src/app/api/workspaces/[workspaceId]/route.ts
    - src/app/api/workspaces/[workspaceId]/route.test.ts
    - src/app/api/workspaces/[workspaceId]/documents/[documentId]/route.ts
    - src/app/api/workspaces/[workspaceId]/documents/[documentId]/route.test.ts
    - src/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/route.ts
    - src/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/route.test.ts
  modified:
    - src/components/edit/new/import/UnifiedInputZone.tsx
    - src/components/create/StudySetCreateWizard.tsx
    - src/lib/client/ingestStudySet.ts

key-decisions:
  - "Original bytes upload after RPC using returned IDs, then set original_storage_path once"
  - "Large-file client staging uses {userId}/ingest-staging/{uuid}/filename"
  - "Omit GET /api/workspaces/route.ts until 09-06 owns workspace summaries"
  - "Post-ingest redirect uses /workspace/{workspaceId} (detail UI in 09-06)"

patterns-established:
  - "requireApiUser + Zod + typed Workspace*Error → { error, message? }"
  - "runtime = nodejs on conversion/storage routes"
  - "document PATCH .strict() rejects source/raw fields"

requirements-completed: [WORK-01, WORK-03, WORK-08, WORK-09]

duration: 45min
completed: 2026-07-30
---

# Phase 09: Plan 02 Summary

**Workspace-native first ingest, append-only document versions, authenticated write APIs, and import client switch off early study-set creation**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-30T05:56:00+07:00
- **Completed:** 2026-07-30T06:06:00+07:00
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments
- Server-owned `runWorkspaceIngest` validates before RPC, derives title from source, persists failed conversions as explicit failed versions
- Document lifecycle services: metadata PATCH, replacement append, soft delete without touching output snapshots
- Write routes + Vitest coverage for 401/400/403/404/success; UnifiedInputZone posts to `/api/workspaces/ingest`

## Task Commits

Each task was committed atomically:

1. **Task 1: workspace ingest and document version services** - `557c12d` (feat)
2. **Task 2: authenticated workspace write API routes** - `f351431` (feat)
3. **Task 3: switch import client to workspace ingest** - `389ee0c` (feat)

**Plan metadata:** (this commit)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `src/lib/workspaces/schemas.ts` — Zod ingest/patch/delete contracts
- `src/lib/workspaces/createWorkspaceIngest.ts` — first ingest + replacement conversion/RPC
- `src/lib/workspaces/documentVersions.ts` — metadata, soft delete, legacy bridge lookup
- `src/app/api/workspaces/**` — ingest, workspace PATCH, document PATCH/DELETE, version POST/DELETE
- `src/lib/client/ingestWorkspace.ts` / `workspaceApi.ts` — browser clients
- `UnifiedInputZone.tsx` / `StudySetCreateWizard.tsx` — workspace identity redirect

## Decisions Made
- Upload originals to immutable path after RPC returns IDs (single `original_storage_path` fill-in)
- Client large files stage under `ingest-staging` then `file_ref`
- Keep `ingestStudySet.ts` as documented legacy adapter; no mass UI refactor beyond create wizard prop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule — Intent] Deferred GET /api/workspaces/route.ts**
- **Found during:** Task 2
- **Issue:** Plan listed `src/app/api/workspaces/route.ts`, but write-action scope is ingest/PATCH/DELETE only; GET list belongs to 09-06
- **Fix:** Omitted root list route; write handlers live under `ingest/` and `[workspaceId]/`
- **Files modified:** none (intentionally not created)
- **Verification:** route tests cover write endpoints only
- **Committed in:** `f351431`

**2. [Rule — Missing Critical] StudySetCreateWizard prop update**
- **Found during:** Task 3
- **Issue:** `getPostIngestHref` signature changed to workspace identity; wizard not in plan file list but required for typecheck
- **Fix:** Minimal wizard update redirecting to `/workspace/{workspaceId}`
- **Files modified:** `src/components/create/StudySetCreateWizard.tsx`
- **Verification:** `npm run typecheck` clean for 09-02 files (pre-existing `usage/route.ts` TS2589 remains)
- **Committed in:** `389ee0c`

**3. [Rule — Adaptation] Post-RPC storage path fill-in**
- **Found during:** Task 1
- **Issue:** Immutable path needs version UUID from RPC, but RPC needs storage path argument
- **Fix:** Call RPC with null path + raw markdown; upload to `{ws}/{doc}/{ver}/...`; update `original_storage_path` once
- **Files modified:** `createWorkspaceIngest.ts`
- **Verification:** unit test asserts immutable upload path after RPC
- **Committed in:** `557c12d`

---

**Total deviations:** 3 auto-fixed (1 intent, 1 missing critical, 1 adaptation)
**Impact on plan:** Required for applyability and typecheck; no scope creep into Phase 10.

## Self-Check

- [x] `src/lib/workspaces/createWorkspaceIngest.ts` exists
- [x] `src/lib/workspaces/documentVersions.ts` exists
- [x] `src/app/api/workspaces/ingest/route.ts` exists
- [x] Route/service tests pass (47/47)
- [x] Task commits present on branch

**Self-Check: PASSED**

## Issues Encountered
- Pre-existing `src/app/api/usage/route.ts` TS2589 typecheck failure unrelated to 09-02
- Workspace detail page `/workspace/[id]` not built until 09-06; redirect target is intentional forward link

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 09-03 canonical append + progressive reader
- Legacy study-set ingest routes remain for adapters in 09-07/09-08
- GET workspace summaries deferred to 09-06

---
*Phase: 09-workspace-centered-learning-canonical-provenance*
*Completed: 2026-07-30*
