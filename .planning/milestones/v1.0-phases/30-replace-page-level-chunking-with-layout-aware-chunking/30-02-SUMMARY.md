---
phase: 30
plan: 02
phase_name: replace-page-level-chunking-with-layout-aware-chunking
subsystem: quiz-layout-chunking
tags: ["pdfjs", "layout", "chunking", "preview-first", "per-page-fallback"]
requires: ["30-01"]
provides:
  - "Quiz lane routes Phase 29 text pages through pdf.js layout-aware chunking (no rasterization)"
  - "Preview-first layout chunk parsing for early pages (3–5)"
  - "Conservative per-page fallback candidates unioned into the existing vision page list within caps"
affects:
  - "src/components/ai/AiParseSection.tsx"
  - "src/lib/ai/layoutChunking.ts"
  - "src/lib/pdf/extractPdfLayoutBlocks.ts"
completed_at: "2026-04-18"
---

# Phase 30 Plan 02: Wire layout-aware chunking into quiz text lane — Summary

Quiz mode now uses **layout-aware chunks** (pdf.js text-layer geometry → blocks → chunks) for Phase 29-routed **`text` pages**, preserving **preview-first** behavior (first 3–5 pages) and escalating only **specific weak/truncated pages** into the existing vision page list (bounded by existing caps).

## What shipped

### Quiz routed text pages: layout-aware chunking (no rasterization)

- `src/components/ai/AiParseSection.tsx`
  - Replaced the Phase 29 routed text-page lane (`extractTextForPageIndices` → `chunkText`) with:
    - `extractPdfLayoutBlocksForPageIndices(...)`
    - `layoutBlocksToQuizChunks(...)`
  - Added overlay logging for: text page count, block count, chunk count.

### Preview-first layout chunks + per-page vision fallback within caps

- `src/components/ai/AiParseSection.tsx`
  - Splits routed text pages into **preview** vs **rest** segments using the existing preview budget (3–5 on product surfaces).
  - Runs sequential parse on preview layout chunks first so early quiz questions appear sooner.
  - Computes a conservative, deterministic per-page fallback list based on layout extraction signals and unions it into `bitmapPageIndicesForVision` without exceeding `VISION_MAX_PAGES_DEFAULT` (drops fallback first; prioritizes preview-window fallback pages).
- `src/lib/ai/layoutChunking.ts`
  - Added `layoutPagesNeedingVisionFallback(...)` helper to flag pages with `truncated` extraction or zero usable blocks.

## Verification

- `npm run lint` (passed; warnings were pre-existing in unrelated files)
- `npm run build` (passed)

## Commits

- `a6a6d0a` — `fix(build): await cookies() in supabase server client`
- `d7c4fdd` — `feat(30-02): layout-aware chunks for routed text pages`
- `e1e24cb` — `feat(30-02): preview-first layout chunks with page fallback`
- `7f5a02e` — `chore(build): add supabase cloud adapters`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Build failures unrelated to Phase 30 wiring**
- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** Next.js build was blocked by missing/incomplete Supabase/cloud adapter modules and env handling during prerender.
- **Fix:** Added/normalized the missing Supabase helper modules and cloud data adapters so `next build` typecheck + prerender complete.
- **Commits:** `a6a6d0a`, `7f5a02e`

## Known stubs

- `src/lib/supabase/env.ts`: during `next build` only, missing Supabase public env values are replaced with placeholders to allow prerender to complete.

## Self-Check

PASSED

- FOUND: `.planning/phases/30-replace-page-level-chunking-with-layout-aware-chunking/30-02-SUMMARY.md`
- FOUND commits: `a6a6d0a`, `d7c4fdd`, `e1e24cb`, `7f5a02e`

