---
phase: 29-route-by-page-type-text-page-vs-bitmap-page-vs-rich-layout-p
plan: 02
subsystem: pdf-routing
tags:
  - pdf
  - routing
  - vision
  - performance
requires:
  - ROUTE-29-01
provides:
  - ROUTE-29-03
  - ROUTE-29-04
affects:
  - src/lib/pdf/renderPagesToImages.ts
  - src/components/ai/AiParseSection.tsx
tech_stack:
  - Next.js App Router
  - TypeScript
  - pdfjs-dist (via getPdfjs)
completed_at: "2026-04-18"
---

# Phase 29 Plan 02: Route quiz parse by page type (bitmap-only rasterization) Summary

Wire Phase 29’s per-page routing into the **quiz** lane so we classify pages first and only rasterize bitmap pages (within existing preview-first and vision caps), while parsing text pages via the existing text-chunk lane and persisting one unified bank.

## What Changed

### Selected-page rasterization (avoid work on text pages)

- Updated `src/lib/pdf/renderPagesToImages.ts`:
  - Added optional `pageIndices?: number[]` (1-based) so callers can rasterize only selected pages.
  - Enforced the existing `maxPages` cap by truncating selected indices to `maxPages`.
  - Preserved preview-first semantics (`onPreviewPagesAvailable`) and abort behavior, while keeping `PageImageResult.pageIndex` as the original page index.

### Quiz lane: page-aware routing before rasterization

- Updated `src/components/ai/AiParseSection.tsx` (quiz only; flashcards unchanged):
  - Computes a `PageRoutePlan` via `classifyPdfPages()` **before** any call to `renderPdfPagesToImages()`.
  - Routes:
    - **Text pages** → `extractPdfTextForPageRange()` (contiguous runs) → `chunkText()` → existing sequential text parse lane (no rasterization).
    - **Bitmap pages** → `renderPdfPagesToImages({ pageIndices })` → existing vision **batch** lane, capped to `VISION_MAX_PAGES_DEFAULT`.
  - Merges + dedupes (`dedupeQuestionsByStem`) routed text questions and vision questions into a **single unified `Question[]`** and persists once.
  - Adds routing summary logs (`pipelineLog`) with stable counts (pageCount/pages length, text vs bitmap counts, bitmap-for-vision count, dropped bitmap count).

## Verification

- `npm run lint` (warnings only; no new errors)
- `npm run build`

## Commits

- `995c67e`: `feat(29-02): support selected-page rasterization`
- `4f49600`: `feat(29-02): route quiz parse by page type`

## Deviations from Plan

None — executed as written.

## Threat Flags

None — no new network surface; routing decisions remain numeric/count-based and avoid logging extracted text.

## Self-Check

PASSED

- FOUND: `.planning/phases/29-route-by-page-type-text-page-vs-bitmap-page-vs-rich-layout-p/29-02-SUMMARY.md`
- FOUND commits: `995c67e` (Task 1), `4f49600` (Task 2)

