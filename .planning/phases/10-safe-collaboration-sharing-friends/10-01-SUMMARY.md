---
phase: 10-safe-collaboration-sharing-friends
plan: 01
subsystem: database
tags: [postgres, rls, supabase, workspace, authorization]

requires:
  - phase: 09-workspace-centered-learning-canonical-provenance
    provides: workspaces, documents, learning_outputs schema and Phase 9 RLS baseline
provides:
  - Phase 9 schema contract with inventory drift detection
  - Hardened private workspace role helpers
  - Migrated workspace-derived RLS and output item policies
  - Executable owner/editor/viewer/outsider authorization SQL matrix
affects:
  - 10-02 through 10-10 collaboration routes and sharing APIs

tech-stack:
  added: []
  patterns:
    - "private.workspace_role + can_view/can_edit/is_owner helpers with search_path=''"
    - "Workspace item access via learning_outputs.output_id join"
    - "Personal history tables remain caller-owned (user_id = auth.uid())"

key-files:
  created:
    - src/lib/server/workspaces/schemaContract.ts
    - src/lib/server/workspaces/schemaContract.test.ts
    - src/lib/server/workspaces/schemaInventory.test.ts
    - supabase/migrations/20260730150200_phase10_workspace_authorization.sql
    - supabase/tests/fixtures/phase10_workspace_roles.sql
    - supabase/tests/phase10_workspace_authorization.sql
  modified: []

key-decisions:
  - "Migration timestamp 150200 used instead of plan 140000 (quota collision; must run after Phase 9 150100)"
  - "Retained private.can_workspace delegating to workspace_role for backward compatibility"
  - "approved_questions/flashcards allow workspace access via output_id; legacy rows without output_id stay owner-only"
  - "Storage workspace policies supplement legacy owner policies; path prefix extracts workspace UUID"

patterns-established:
  - "Schema contract blocks Phase 10 SQL when Phase 9 ownership mappings are incomplete"
  - "RLS predicates use (select private.can_view_workspace(...)) / can_edit_workspace at Data API boundary"

requirements-completed: [COLLAB-01, COLLAB-02]

duration: 45min
completed: 2026-07-30
---

# Phase 10 Plan 01: Workspace Authorization Foundation Summary

**Phase 9 schema contract plus hardened private role helpers and migrated workspace RLS with executable authorization matrix**

## Performance

- **Duration:** 45 min
- **Started:** 2026-07-30T08:29:00Z
- **Completed:** 2026-07-30T08:37:00Z
- **Tasks:** 2 auto complete, 1 checkpoint pending human approval
- **Files modified:** 6

## Accomplishments

- Immutable `workspaceSchemaContract` maps every Phase 10 authorization surface to confirmed Phase 9 table names (workspaces, learning_outputs, output_source_snapshots, etc.)
- Inventory test fails on drift between contract and landed migrations plus workspace-native source
- Migration adds `workspace_role`, `can_view_workspace`, `can_edit_workspace`, `is_workspace_owner` with strict grants and empty search_path
- Workspace-derived RLS, output items, and storage policies migrated; personal history remains user-owned
- SQL fixture and matrix test cover owner/editor/viewer/outsider/anon outcomes

## Task Commits

1. **Task 1: Confirm Phase 9 compatibility contract** - `90e093c` (feat)
2. **Task 2: Install hardened role helpers and migrate RLS** - `fdaea6c` (feat)

**Plan metadata:** pending (docs commit after checkpoint)

## Files Created/Modified

- `src/lib/server/workspaces/schemaContract.ts` - Confirmed Phase 9 identifiers and ownership paths
- `src/lib/server/workspaces/schemaContract.test.ts` - Contract validation and completeness tests
- `src/lib/server/workspaces/schemaInventory.test.ts` - Migration/source inventory drift detection
- `supabase/migrations/20260730150200_phase10_workspace_authorization.sql` - Role helpers and migrated RLS
- `supabase/tests/fixtures/phase10_workspace_roles.sql` - Reusable role/workspace seed fixture
- `supabase/tests/phase10_workspace_authorization.sql` - Data API-equivalent authorization matrix

## Decisions Made

- Used migration timestamp `20260730150200` because plan timestamp `140000` collides with quota reservations and would run before Phase 9 foundation
- Kept `private.can_workspace` as a delegating wrapper so existing callers remain valid while policies use the new helpers
- Collaborator access to quiz/flashcard items requires `output_id` linkage to `learning_outputs`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration timestamp collision**
- **Found during:** Task 2
- **Issue:** Plan specified `20260730140000_phase10_workspace_authorization.sql` but `20260730140000_atomic_generation_quota_reservations.sql` already exists and Phase 10 must run after `150100`
- **Fix:** Created `20260730150200_phase10_workspace_authorization.sql` following Phase 9 collision precedent
- **Files modified:** `supabase/migrations/20260730150200_phase10_workspace_authorization.sql`
- **Committed in:** fdaea6c

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for correct migration ordering; no behavioral change.

## Issues Encountered

- Local `supabase start` / `supabase db reset` failed: baseline migration errors on `alter table storage.objects enable row level security` (`must be owner of table objects`). SQL matrix not executed locally; user confirmed remote migrations applied.
- Task 3 human checkpoint remains open (`autonomous: false`)

## User Setup Required

None for code artifacts. To verify locally once Supabase starts:

```bash
supabase db reset && supabase test db --file supabase/tests/phase10_workspace_authorization.sql
```

## Next Phase Readiness

- Schema contract and RLS migration ready for plan 10-02 membership/invitation APIs once checkpoint approved
- Apply `20260730150200_phase10_workspace_authorization.sql` to remote Supabase after human review

## Self-Check: PASSED

- FOUND: src/lib/server/workspaces/schemaContract.ts
- FOUND: supabase/migrations/20260730150200_phase10_workspace_authorization.sql
- FOUND: supabase/tests/phase10_workspace_authorization.sql
- FOUND: commit 90e093c
- FOUND: commit fdaea6c

---
*Phase: 10-safe-collaboration-sharing-friends*
*Completed: 2026-07-30*
