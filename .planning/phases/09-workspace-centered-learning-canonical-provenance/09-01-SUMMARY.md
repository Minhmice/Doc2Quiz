---
phase: 09-workspace-centered-learning-canonical-provenance
plan: 01
subsystem: database
tags: [postgres, supabase, rls, sha256, provenance, workspace, backfill]

requires:
  - phase: 08-freemium-coupons
    provides: quota_consumptions and study_sets bridge surface for history preservation
provides:
  - Deterministic checksumCanonicalMarkdown / checksumSections contract
  - Workspace/document/version/output schema with RLS membership boundary
  - Dual-mode legacy backfill with output-specific study_sets bridges
  - Atomic append-only RPCs for document versions, canonical versions, and learning outputs
affects:
  - 09-02 workspace ingest APIs
  - 09-03 canonical reader
  - 09-04/09-05 multi-source generation
  - 09-07/09-08 legacy adapters

tech-stack:
  added: []
  patterns:
    - private.can_workspace security definer helper with empty search_path
    - Output-specific bridge study_sets + immutable legacy_parent_study_set_id
    - Append-only document/canonical versions with frozen output_source_snapshots

key-files:
  created:
    - src/lib/provenance/checksum.ts
    - src/lib/provenance/checksum.test.ts
    - supabase/migrations/20260730150000_workspace_foundation.sql
    - supabase/migrations/20260730150100_workspace_rpcs.sql
    - supabase/tests/workspace_rls.sql
  modified: []

key-decisions:
  - "Migration timestamps 150000/150100 because 140000 collided with quota reservations"
  - "New sections table named canonical_version_sections; legacy canonical_sections untouched"
  - "Native learning_outputs use null legacy_parent_study_set_id; backfill always sets parent"
  - "Historic quiz_sessions, study_wrong_history, quota_consumptions, study_sessions, study_mistakes stay parent-keyed"

patterns-established:
  - "Checksum: CRLF/CR→LF only, no trim, lowercase hex SHA-256"
  - "sections_checksum: JSON.stringify tuples with fixed ordinal/section_key/heading/section_type/body_markdown key order"
  - "Invoker RPCs with explicit search_path; revoke public/anon; grant authenticated"

requirements-completed: [WORK-03, WORK-04, WORK-07, WORK-08, WORK-09]

duration: 55min
completed: 2026-07-30
---

# Phase 09: Plan 01 Summary

**Workspace foundation with SHA-256 provenance checksums, membership RLS, dual-mode study-set bridge backfill, and atomic append-only RPCs**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-30T05:41:00+07:00
- **Completed:** 2026-07-30T06:35:00+07:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Deterministic provenance checksum helpers with Vitest coverage for LF/CRLF/CR parity and ordered section digests
- Workspace schema + hardened `private.can_workspace` RLS + dual-mode backfill that allocates per-kind bridge study sets without rewriting parent history
- Atomic invoker RPCs: `create_workspace_document_version`, `persist_canonical_version`, `create_learning_output`

## Task Commits

Each task was committed atomically:

1. **Task 1: checksum contract (test)** - `7871cb0` (test)
2. **Task 1: checksum implementation** - `a0a2e7d` (feat)
3. **Task 2: workspace foundation schema RLS and backfill** - `45bfd83` (feat)
4. **Task 3: atomic workspace append-only RPCs** - `fca66bf` (feat)

**Plan metadata:** `531655d` (docs: complete plan); tracking `a31dbb7`

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `src/lib/provenance/checksum.ts` — SHA-256 canonical markdown and sections checksums
- `src/lib/provenance/checksum.test.ts` — line-ending and field-order contract tests
- `supabase/migrations/20260730150000_workspace_foundation.sql` — tables, RLS, backfill, resolver
- `supabase/migrations/20260730150100_workspace_rpcs.sql` — append-only persistence RPCs
- `supabase/tests/workspace_rls.sql` — role matrix, dual-mode bridge, resolver, RPC assertions

## Decisions Made
- Use `canonical_version_sections` for versioned sections so legacy `canonical_sections` remain intact
- Keep historic history parent-keyed (`quiz_sessions`, `study_wrong_history`, `quota_consumptions`, plus existing `study_sessions`/`study_mistakes`)
- Native outputs set `legacy_parent_study_set_id` null; migrated outputs always retain immutable parent id
- Narrow `workspace_members_insert_own_owner` policy enables first-ingest owner bootstrap without general membership mutation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule — Blocking] Migration timestamp collision**
- **Found during:** Task 2
- **Issue:** Plan requested `20260730140000_workspace_foundation.sql` / `20260730140100_workspace_rpcs.sql`, but `20260730140000_atomic_generation_quota_reservations.sql` already occupied that timestamp
- **Fix:** Used `20260730150000_workspace_foundation.sql` and `20260730150100_workspace_rpcs.sql`
- **Files modified:** migration paths above
- **Verification:** `ls supabase/migrations/` shows unique timestamps
- **Committed in:** `45bfd83`, `fca66bf`

**2. [Rule — Blocking] Legacy table name collision**
- **Found during:** Task 2
- **Issue:** Plan named new sections table `canonical_sections`, which already exists keyed to `canonical_document_id`
- **Fix:** Created `public.canonical_version_sections`; did not drop/alter legacy `canonical_sections`
- **Files modified:** foundation migration, RPC `persist_canonical_version`, SQL tests
- **Verification:** SQL test asserts both relations exist
- **Committed in:** `45bfd83`

**3. [Rule — Missing Critical] Native parent nullability**
- **Found during:** Task 3
- **Issue:** `legacy_parent_study_set_id NOT NULL` plus bridge≠parent forced inventing synthetic parent study sets for workspace-native outputs
- **Fix:** RPC migration makes parent nullable; native outputs store null; backfill still sets immutable parent
- **Files modified:** `20260730150100_workspace_rpcs.sql`
- **Verification:** SQL test asserts native output parent is null
- **Committed in:** `fca66bf`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** Required for applyability and correct bridge semantics; no scope creep.

## Self-Check

- [x] `src/lib/provenance/checksum.ts` exists
- [x] `src/lib/provenance/checksum.test.ts` exists
- [x] `supabase/migrations/20260730150000_workspace_foundation.sql` exists
- [x] `supabase/migrations/20260730150100_workspace_rpcs.sql` exists
- [x] `supabase/tests/workspace_rls.sql` exists
- [x] Task commits present on branch

**Self-Check: PASSED**

## Issues Encountered
- `supabase db reset && supabase test db` blocked: Docker daemon not running (`dockerDesktopLinuxEngine` pipe missing); also no `supabase/config.toml` in repo. SQL tests written and syntactically aligned with existing `quota_reservation_concurrency.sql` pattern; Vitest checksum suite passed (4/4).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema and RPC foundation ready for 09-02 workspace ingest/write routes
- Resolver contract `resolve_learning_output_bridge` available for later legacy adapters
- Re-run `supabase db reset && supabase test db` once Docker + local Supabase config are available

---
*Phase: 09-workspace-centered-learning-canonical-provenance*
*Completed: 2026-07-30*
