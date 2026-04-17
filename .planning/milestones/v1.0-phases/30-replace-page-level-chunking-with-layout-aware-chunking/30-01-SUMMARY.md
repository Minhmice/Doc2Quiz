---
phase: 30
plan: 01
phase_name: replace-page-level-chunking-with-layout-aware-chunking
subsystem: pdf-layout-chunking
tags: ["pdfjs", "layout", "chunking", "deterministic", "offline-first"]
requires: ["29-03"]
provides:
  - "Phase 30 goal + requirement IDs + plan list in planning docs"
  - "Deterministic layout blocks from pdf.js text layer + geometry"
  - "PDF page-indexed block extraction + block→chunk adapter with provenance"
affects:
  - ".planning/ROADMAP.md"
  - ".planning/REQUIREMENTS.md"
  - "src/lib/pdf/layoutBlocksFromTextLayer.ts"
  - "src/lib/pdf/extractPdfLayoutBlocks.ts"
  - "src/lib/ai/layoutChunking.ts"
tech_stack:
  - "Next.js (App Router)"
  - "TypeScript"
  - "pdfjs-dist (browser-only dynamic import via getPdfjs)"
completed_at: "2026-04-18"
---

# Phase 30 Plan 01: Requirements + layout block builder utilities — Summary

Replaced the Phase 30 “TBD” planning placeholders and introduced deterministic, geometry-based layout block + chunk utilities built on **pdf.js text layer + transforms** (no OCR dependency), ready to wire into the Phase 29 `text`-page lane in Plan 30-02.

## What shipped

### Planning docs (Phase 30 is no longer TBD)

- Updated `.planning/ROADMAP.md` Phase 30 goal, requirement IDs, and the 3-plan breakdown.
- Added `LAYOUT-30-01..04` requirement definitions under v1+ requirements.

### Layout block builder (pure + deterministic)

- `src/lib/pdf/layoutBlocksFromTextLayer.ts`
  - `pdfjsTextContentItemsToPdfTextItems`: viewportTransform × item.transform → normalized geometry items (capped; deterministic).
  - `layoutBlocksFromTextLayer`: items → lines → paragraph-ish blocks with bbox + `truncated` signal (`maxItemsPerPage`).

### Browser-only extraction + AI chunk preparation

- `src/lib/pdf/extractPdfLayoutBlocks.ts`
  - `extractPdfLayoutBlocksForPageIndices(file, pageIndices, { signal, build })`
  - Abort-safe posture, page-indexed extraction, always `pdf.destroy()` in `finally`, returns block arrays + truncation metadata.
- `src/lib/ai/layoutChunking.ts`
  - `layoutBlocksToQuizChunks(pages, opts)` producing `{ chunkText, sourcePageIndices, blockCount }`
  - Default policy: one-block-per-chunk; merge adjacent short blocks (same page) until soft target; hard cap enforced.

## Verification

- `npm run lint` (passed; warnings were pre-existing in unrelated files)
- `npm run build` (passed)

## Commits

- `24e842a` — `chore(30-01): define Phase 30 goal and requirements`
- `5f8f09b` — `feat(30-01): add layout block builder from text layer`
- `b1e754e` — `feat(30-01): extract layout blocks and build layout chunks`

## Deviations from Plan

**1. Requirements completion checkboxes not advanced**

This plan adds requirement definitions and ships utilities, but does not yet wire layout chunking into the Phase 29 `text`-page lane (Plan 30-02). To avoid prematurely claiming phase-level requirements as “Complete”, the `LAYOUT-30-01..04` checkboxes were left unchanged.

## Known stubs

None observed in the files added/modified by this plan.

## Self-Check

PASSED

- FOUND: `.planning/phases/30-replace-page-level-chunking-with-layout-aware-chunking/30-01-SUMMARY.md`
- FOUND commits: `24e842a`, `5f8f09b`, `b1e754e`

