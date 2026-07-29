---
phase: 02-input-markitdown
plan: 03
subsystem: ui
tags: [react, supabase-storage, import-flow, shadcn]

requires:
  - phase: 02-input-markitdown
    provides: ingest API and validation helpers
provides:
  - Unified File/Paste/YouTube input zone on /edit/new routes
  - Client-direct Storage upload + ingest orchestration
  - /sets/[id]/source raw markdown placeholder
affects: [phase-3-canonical-builder]

tech-stack:
  added: []
  patterns: [client storage upload then file_ref ingest, real ingest progress labels]

key-files:
  created: [src/components/edit/new/import/UnifiedInputZone.tsx, src/components/edit/new/import/IngestProgressCard.tsx, src/lib/client/ingestStudySet.ts, src/components/upload/UploadBox.tsx]
  modified: [src/app/(app)/edit/new/quiz/page.tsx, src/app/(app)/edit/new/flashcards/page.tsx, src/app/(app)/sets/[id]/source/page.tsx, src/components/edit/new/import/StudySetNewImportStepContext.tsx]

key-decisions:
  - "Files >10MB use Storage upload + file_ref JSON; smaller files use multipart"
  - "Post-ingest navigation targets /sets/{id}/source placeholder"
  - "NewStudySetTextImportFlow deprecated; UnifiedInputZone is sole product import UI"

patterns-established:
  - "Pattern: shared validation.ts helpers on client before ingest API call"
  - "Pattern: IngestProgressCard shows validating → uploading → converting without fake %"

requirements-completed: [INPUT-01, INPUT-02, INPUT-03, INPUT-04, INPUT-05, INPUT-06, INPUT-07, INPUT-08, INPUT-09, INPUT-10, INPUT-11, INPUT-12, INPUT-VAL-01, CONV-02]

duration: 22min
completed: 2026-07-25
---

# Phase 2 Plan 03: Unified Input UI Summary

**File/Paste/YouTube import zone wired to Storage upload and ingest API with source placeholder page**

## Performance

- **Duration:** 22 min
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- `UnifiedInputZone` with shadcn line tabs on quiz and flashcards `/edit/new` routes
- `ingestStudySetSource` handles Storage upload (>10MB) and JSON/multipart ingest
- `/sets/[id]/source` shows raw markdown preview and pipeline banner (no editor redirect)
- Updated format chooser copy; deprecated text-only import flow

## Task Commits

1. **Tasks 1–3: UI + client ingest + cleanup** - `0572109` (feat)

## Known Stubs

| File | Reason | Resolved by |
|------|--------|-------------|
| `/sets/[id]/source` | Canonical builder placeholder only | Phase 3 |
| `NewStudySetPdfImportFlow.tsx` | Legacy dev/OCR path still references generate-from-file | Out of product routes; remove in cleanup milestone |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] generate-from-file route already absent on disk**
- **Found during:** Task 3 legacy cleanup
- **Issue:** Planned deletion target not present in working tree
- **Fix:** Verified no product route imports; skipped delete

## Self-Check: PASSED

- FOUND: src/components/edit/new/import/UnifiedInputZone.tsx
- FOUND: src/lib/client/ingestStudySet.ts
- FOUND: 0572109

---
*Phase: 02-input-markitdown*
*Completed: 2026-07-25*
