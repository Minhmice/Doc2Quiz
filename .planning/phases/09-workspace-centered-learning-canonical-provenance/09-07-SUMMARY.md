---
phase: 09-workspace-centered-learning-canonical-provenance
plan: 07
subsystem: api
tags: [legacy-bridge, study-sets, workspace, adapters, quiz, canonical, ingest]

requires:
  - phase: 09-01
    provides: resolve_learning_output_bridge SQL contract and dual-mode backfill
  - phase: 09-02
    provides: workspace ingest / soft-delete document services
  - phase: 09-03
    provides: runCanonicalVersion append-only canonicalize
  - phase: 09-04
    provides: multi-source quiz generate + prior narrow quiz adapter
  - phase: 09-06
    provides: workspace dashboard aggregates (navigation context)
provides:
  - Kind-aware resolveLegacyStudySetBridge with bridge-first / parent-kind history rules
  - Retained non-flashcard set-ID adapters wired to workspace-native services
  - Focused adapter contract tests (401/404/DTO/bridge/parent/history/snapshot)
affects:
  - 09-08 flashcard legacy adapter
  - 09-09 static bridge audit / verify:phase9-workspace

tech-stack:
  added: []
  patterns:
    - Central legacyBridge resolver; adapters pass explicit routeKind
    - Bridge history stays on bridge ID; parent history stays on immutable parent ID
    - Soft-delete sources; snapshot study via output_source_snapshots

key-files:
  created:
    - src/lib/workspaces/legacyBridge.ts
    - src/lib/workspaces/legacyBridge.test.ts
    - src/app/api/study-sets/[id]/route.test.ts
    - src/app/api/study-sets/[id]/canonical/route.test.ts
  modified:
    - src/app/api/study-sets/[id]/route.ts
    - src/app/api/study-sets/[id]/canonical/route.ts
    - src/app/api/study-sets/[id]/ingest/route.ts
    - src/app/api/study-sets/[id]/canonicalize/route.ts
    - src/app/api/study-sets/[id]/quiz/generate/route.ts
    - src/app/api/study-sets/[id]/ingest/route.test.ts
    - src/app/api/study-sets/[id]/canonicalize/route.test.ts
    - src/app/api/study-sets/[id]/quiz/generate/route.test.ts

key-decisions:
  - "Lifecycle routeKinds (canonical/ingest/canonicalize/metadata) resolve parent via any child for workspace discovery; quiz/flashcards stay kind-strict"
  - "Legacy DELETE soft-deletes documents only — never hard-deletes study_sets or history"
  - "Canonical GET reads versioned tables / frozen snapshots; never canonical_documents or replace_canonical_content"

patterns-established:
  - "Adapters import resolveLegacyStudySetBridge from legacyBridge.ts with explicit routeKind"
  - "New quota reservations key to bridgeStudySetId; historic parent rows untouched"
  - "Preserve legacy response DTO fields while delegating to workspace-native services"

requirements-completed: [WORK-01, WORK-03, WORK-04, WORK-06, WORK-07, WORK-08, WORK-09]

duration: 25min
completed: 2026-07-30
---

# Phase 09: Plan 07 Summary

**Kind-aware legacy bridge resolver and non-flashcard set-ID adapters preserving immutable parent history**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-30T06:55:50+07:00
- **Completed:** 2026-07-30T07:00:30+07:00
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- `resolveLegacyStudySetBridge` implements bridge-first / no-parent-fallback and parent kind selection with explicit `historyStudySetId`
- Metadata, canonical, ingest, canonicalize, and quiz generate adapters pass explicit route kinds and call workspace-native services
- Adapter tests cover 401, inaccessible 404, legacy DTOs, bridge/parent resolution, unchanged historic fixtures, snapshot study, and no destructive RPCs

## Task Commits

Each task was committed atomically:

1. **Task 1: Define and test legacy bridge resolver** - `a9092d1` (feat)
2. **Task 2: Migrate retained non-flashcard adapters** - `ee79121` (feat)

**Plan metadata:** (this commit)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `src/lib/workspaces/legacyBridge.ts` — kind-aware resolver + document locator helper
- `src/lib/workspaces/legacyBridge.test.ts` — bridge/parent/cross-kind/membership contract tests
- `src/app/api/study-sets/[id]/route.ts` — metadata GET/PATCH + soft-delete DELETE
- `src/app/api/study-sets/[id]/canonical/route.ts` — versioned/snapshot canonical reader
- `src/app/api/study-sets/[id]/ingest/route.ts` — append via runWorkspaceIngest
- `src/app/api/study-sets/[id]/canonicalize/route.ts` — append via runCanonicalVersion
- `src/app/api/study-sets/[id]/quiz/generate/route.ts` — quiz routeKind into shared resolver
- Matching `*.test.ts` files for each retained adapter

## Decisions Made
- Include `supabase` on the resolver params (plan signature omitted it; required for membership-scoped queries)
- Lifecycle route kinds use any-child parent match for workspace discovery; quiz/flashcards remain kind-strict
- Flashcard adapter left on prior documentVersions stub for 09-08 ownership

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule — Missing Critical] Resolver needs Supabase client**
- **Found during:** Task 1
- **Issue:** Plan signature listed `{ studySetId, routeKind, userId }` without client
- **Fix:** Added `supabase` parameter consistent with other workspace services
- **Files modified:** `legacyBridge.ts`
- **Verification:** Unit tests pass with mocked client
- **Committed in:** `a9092d1`

---

**Total deviations:** 1 auto-fixed (missing critical)
**Impact on plan:** Required for implementability; no scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 09-08 can import `resolveLegacyStudySetBridge` with `routeKind: "flashcards"`
- 09-09 static audit can require `resolveLegacyStudySetBridge` on retained adapters

## Self-Check

- [x] `src/lib/workspaces/legacyBridge.ts` exists
- [x] `src/lib/workspaces/legacyBridge.test.ts` exists
- [x] Retained non-flashcard adapters import from `legacyBridge`
- [x] Verification suite: 49/49 passed
- [x] Task commits present on branch

**Self-Check: PASSED**

---
*Phase: 09-workspace-centered-learning-canonical-provenance*
*Completed: 2026-07-30*
