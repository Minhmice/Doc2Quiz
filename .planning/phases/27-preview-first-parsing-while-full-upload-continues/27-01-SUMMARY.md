---
phase: 27-preview-first-parsing-while-full-upload-continues
plan: "01"
subsystem: ui
tags: [nextjs, pdfjs, indexeddb, vision-parse, preview-first]

requires:
  - phase: 25-skip-rasterization-for-born-digital-pdfs-extract-text-layer-
    provides: Text-first sampling / page-window thinking for born-digital PDFs
  - phase: 26-direct-multipart-resumable-upload-to-object-storage
    provides: Background upload seam (not required for this plan’s parse input)

provides:
  - Early IndexedDB meta + document row so inline parse is not blocked by full extract or PDF buffer persistence (D-09)
  - Auto-start parse on file select with local File only (D-01, D-03, D-12)
  - Preview-first page budget (3–5) for text chunking and vision raster scheduling (D-02, D-04)
  - Incremental persistence during vision batches for live import previews

affects:
  - 27-preview-first-parsing-while-full-upload-continues
  - 27-02
  - 27-03

tech-stack:
  added: []
  patterns:
    - "Early meta transaction (createStudySetEarlyMeta) + background enrichStudySetDocumentFromLocalPdf"
    - "Preview raster callback → parallel vision on first N pages while remaining pages render"
    - "Two-pass text extract (page range) + sequential chunk parse with mid-persist"

key-files:
  created:
    - src/lib/pdf/extractText.ts
  modified:
    - src/lib/db/studySetDb.ts
    - src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx
    - src/lib/pdf/extractPdfText.ts
    - src/lib/pdf/renderPagesToImages.ts
    - src/components/ai/AiParseSection.tsx

key-decisions:
  - "Dev/no-inline-parse path awaits full enrichStudySetDocumentFromLocalPdf before navigate so IDB is populated"
  - "Product vision batch: clamp preview page budget to 3–5; developer surface uses full single vision run (no dual merge)"
  - "Quiz text-first: if IDB already has full extractedText, keep single-pass chunking to avoid redundant page-range work"

patterns-established:
  - "PREVIEW_FIRST_PAGE_BUDGET (4) exported from src/lib/pdf/extractText.ts for import + parse"

requirements-completed:
  - PREVIEW-01
  - PREVIEW-02
  - PREVIEW-03
  - PREVIEW-04
  - PREVIEW-09
  - PREVIEW-10

duration: ~45 min
completed: 2026-04-17
---

# Phase 27 Plan 01: Preview-first kickoff + scheduling Summary

**Early study-set meta in IndexedDB, background full-document enrichment, auto-started parse from the local PDF, and preview-first scheduling (3–5 pages) for text chunking and vision rasterization—with incremental bank persistence during vision batches.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-17 (executor session)
- **Completed:** 2026-04-17
- **Tasks:** 2
- **Files touched:** 6 (1 created)

## Accomplishments

- `createStudySetEarlyMeta` + `enrichStudySetDocumentFromLocalPdf` decouple “persist identity” from long extract/buffer work; inline parse starts from the local `File` without any upload URL.
- `NewStudySetPdfImportFlow` auto-starts `AiParseSection` and uses `onEmbeddedParseFinished` for post-parse navigation; manual Parse control removed from the product path.
- Preview-first: page-range text extraction for quiz text-first lane; vision path fires batch parse on the first rasterized pages while the rest of the document renders; `PREVIEW_FIRST_PAGE_BUDGET` is explicit in the import flow.

## Task Commits

Each task was committed atomically:

1. **Task 1: Persist studySet meta first, then start parse immediately on file select** — `ae67d15` (feat)
2. **Task 2: Implement preview budget + scheduling for first 3–5 pages** — `e7d8413` (feat)

**Plan artifact:** docs commit `docs(27-01): add plan 27-01 execution summary` (this file)

## Files Created/Modified

- `src/lib/db/studySetDb.ts` — `createStudySetEarlyMeta`, `enrichStudySetDocumentFromLocalPdf`
- `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx` — early create, background enrich, auto-parse, `previewFirstPageBudget` wiring
- `src/lib/pdf/extractPdfText.ts` — `extractPdfTextForPageRange`
- `src/lib/pdf/extractText.ts` — barrel + `PREVIEW_FIRST_PAGE_BUDGET`
- `src/lib/pdf/renderPagesToImages.ts` — preview raster hook
- `src/components/ai/AiParseSection.tsx` — preview text passes, dual vision merge, incremental IDB persist on batch extraction

## Decisions Made

- Followed 27-CONTEXT D-01, D-02, D-03, D-04, D-09, D-12; dev path without inline parse waits for enrichment before `router.push` so downstream routes still see a complete document record.

## Deviations from Plan

None - plan executed as written. The plan listed `src/lib/pdf/extractText.ts` as modified; it did not exist in-repo and was added as the barrel described in the plan’s `must_haves.artifacts` for extract helpers.

## Issues Encountered

None — `npm run lint` and `npm run build` pass after changes.

## User Setup Required

None.

## Next Phase Readiness

- Ready for 27-02 / 27-03 (upload strip, cancel-all, navigation gating per roadmap) without redoing parse kickoff mechanics.

## Self-Check: PASSED

- `27-01-SUMMARY.md` present at `.planning/phases/27-preview-first-parsing-while-full-upload-continues/27-01-SUMMARY.md`
- `git log --oneline -5` includes two `feat(27-01)` commits plus one `docs(27-01)` commit adding this SUMMARY

---
*Phase: 27-preview-first-parsing-while-full-upload-continues*  
*Completed: 2026-04-17*
