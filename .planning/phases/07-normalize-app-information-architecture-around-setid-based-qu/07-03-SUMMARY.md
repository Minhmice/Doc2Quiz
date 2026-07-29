---
phase: 07-normalize-app-information-architecture-around-setid-based-qu
plan: 03
subsystem: creation
 tags: [nextjs, wizard, pipeline, workspace-safety]
requires:
  - phase: 07-01
    provides: canonical create and review route builders
  - phase: 07-02
    provides: preserved pipeline/session client contracts
provides:
  - Canonical format chooser at /create
  - Quiz and flashcard create route entry points
  - Shared StudySetCreateWizard composition around the existing unified input pipeline
affects: [07-04, 07-06, 07-07]
tech-stack:
  added: []
  patterns: [shared create wizard shell, canonical route helpers, surgical no-commit preservation]
key-files:
  created:
    - src/app/(app)/create/page.tsx
    - src/app/(app)/quiz/create/page.tsx
    - src/app/(app)/flashcard/create/page.tsx
    - src/components/create/StudySetCreateWizard.tsx
  modified: []
key-decisions:
  - "Keep /create format-only and route choices through the canonical singular create helpers."
  - "Compose UnifiedInputZone rather than duplicate source validation or ingest behavior."
metrics:
  duration: "~15 min"
  completed: 2026-07-26
requirements-completed: [IA-02, IA-07, IA-10]
---

# Phase 7 Plan 3: Canonical Creation Entry Points Summary

**Canonical format selection and shared create-route wizard entry points using the existing validated ingest client**

## Accomplishments

- Added `/create` as the format-only chooser with links to `/quiz/create` and `/flashcard/create`.
- Added canonical quiz and flashcard create route pages using one shared `StudySetCreateWizard` component.
- Reused `UnifiedInputZone` and existing ingest validation/client behavior; no MarkItDown or canonicalization logic was copied.
- Kept generated/source content handling delegated to existing pipeline components and canonical route helpers.

## Verification

- `npm test -- src/lib/client/quizGenerateStudySet.test.ts src/lib/client/flashcardGenerateStudySet.test.ts --run` — passed, 2 files / 6 tests.
- Scoped `git diff --check` for all five owned paths — passed.
- `npm run typecheck` — blocked by pre-existing Phase 7 route-helper migration errors in legacy callers and dashboard files, including removed aliases from Plan 07-01; no diagnostics originated in the four new files.
- No files were staged or committed. No destructive git operations were used.

## Deviations from Plan

### User-Authorized Safety Mode

**1. No commits or staging**
- **Reason:** Explicit user instruction and the Phase 7 dirty-workspace preservation contract.
- **Impact:** Changes remain in the working tree for the parent executor to review and integrate.

### Existing Pipeline Boundary

**2. Shared wizard delegates to existing UnifiedInputZone**
- **Found during:** Task 1 implementation
- **Issue:** The existing source component owns validated ingest and currently transitions to the legacy post-ingest route; canonicalization/generation orchestration lives in the existing source page and has not yet been extracted into a shared component.
- **Action:** Added a thin shared wizard contract and canonical create entry pages without duplicating conversion logic or modifying the dirty `UnifiedInputZone` file.
- **Impact:** The new entry points are safe and canonical, while full in-wizard Convert → Generate → Review orchestration remains dependent on the later extraction/migration work in this phase.

## Known Stubs

- `src/components/create/StudySetCreateWizard.tsx` currently provides the shared source-entry shell and canonical post-ingest target; canonicalization/generation UI remains in the existing legacy source workbench until it is extracted without overwriting dirty hunks.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: upload trust boundary | `src/components/create/StudySetCreateWizard.tsx` | The new routes reuse `UnifiedInputZone` and its existing upload validation and authenticated ingest client rather than introducing a bypass. |

## Preservation Check

- Owned paths were inspected before editing; all were clean or absent at the pre-task baseline.
- `UnifiedInputZone.tsx` was left byte-for-byte untouched because it is the shared existing pipeline boundary and was not safe to rewrite under the dirty-workspace contract.
- Existing unrelated hunks and generated files were not staged, reset, checked out, restored, cleaned, or committed.

## Self-Check: PASSED

- All four new implementation files and this summary exist.
- Focused pipeline tests pass.
- Scoped diff check passes.
- No staging or commits occurred, matching authorized safety mode.
