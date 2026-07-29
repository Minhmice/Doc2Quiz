---
phase: 30
plan: 03
phase_name: replace-page-level-chunking-with-layout-aware-chunking
subsystem: quiz-layout-chunking
tags: ["observability", "layout", "chunking", "caps", "abort"]
requires: ["30-02"]
provides:
  - "Exactly one summary pipelineLog per layout-aware chunking run with numeric counts/caps/fallback + wallMs totals"
  - "Abort-safe layout block extraction returns partial pages (no throw) and preserves truncation metadata"
affects:
  - "src/components/ai/AiParseSection.tsx"
  - "src/lib/pdf/extractPdfLayoutBlocks.ts"
completed_at: "2026-04-18"
---

# Phase 30 Plan 03: Layout chunking observability + guardrails — Summary

Layout-aware chunking runs in the quiz lane emit **exactly one** structured summary log per run (D-07), with **numeric counts, caps, fallback usage, and wall-time totals**, while keeping work **bounded, deterministic, and abort-safe**. No new UI controls.

## What shipped

### Single summary `pipelineLog` per layout-chunking run (D-07)

- `src/components/ai/AiParseSection.tsx`
  - One `pipelineLog("VISION", "layout-chunk-route", "info", "quiz layout-aware chunking summary", …)` per layout-aware chunking attempt (`layoutChunkingMetrics.attempted`).
  - Payload is **counts / caps / wallMs / stableReasonCodes only** (no chunk or PDF text).
  - **counts**: `textPageCountPlanned`, `textPageCountExtracted`, `textPageTruncatedCount`, `layoutBlockCountTotal` (non-empty blocks), `layoutChunkCountTotal`, `layoutChunkParseQuestionCount`, `fallbackCandidatesPageCount`, `fallbackToVisionPageCount`, `fallbackDroppedByCapCount`.
  - **caps**: `previewFirstPageBudgetApplied`, `visionMaxPages`.
  - **wallMs**: `extractBlocksMs`, `buildChunksMs`, `sequentialParseMs`, `layoutChunkingTotalMs`.
  - **stableReasonCodes** (examples): `truncated`, `zero_blocks`, `zero_chunks`, `zero_questions`, `weak_valid_ratio`, `vision_cap_dropped`.
  - Emission is **once per run**, including on abort or throw, via `emitLayoutChunkingSummaryOnce()` in `handleVisionParse`’s `finally` (metrics hoisted to function scope).

### Caps, fallback union, and preview / truncation priority

- Bitmap vision indices from Phase 29 and text-route fallback pages are **deduped**; fallback slots are **clamped** so `base + acceptedFallback` never exceeds `VISION_MAX_PAGES_DEFAULT`, dropping **lowest-priority fallbacks first** (sorted tail of the ordered fallback list).
- Fallback ordering: **truncated text pages first**, then **preview-window text pages**, then ascending page index — so preview truncations are favored within the cap.
- **Phase 25–style quality gate** on layout chunk parse output (`isMcqComplete`, `validRatio`): weak segments add `weak_valid_ratio` and union segment pages into the fallback list (conservative per-page vision escalation).

### Hardened abort behavior for layout block extraction

- `src/lib/pdf/extractPdfLayoutBlocks.ts`
  - On abort mid-extraction, returns **`{ pageCount, pages }` with partial `pages`** (already-processed indices) instead of discarding work; still never throws to callers.

## Verification

- `npm run lint` (passed)
- `npm run build` (passed)

## Commits

- `f30740a` — `feat(30-03): add single layout-chunking summary log`
- `17ec59c` — `fix(30-03): ensure layout-chunk summary logs safely`
- `a5016d8` — `fix(30-03): return partial layout blocks on abort`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Build/typecheck failed due to summary emitter scope**
- **Found during:** Task 1 verification (`npm run build`)
- **Issue:** `emitLayoutChunkingSummaryOnce` was scoped inside `try`, but referenced in the surrounding `finally`.
- **Fix:** Hoisted the emitter + metrics to `handleVisionParse` scope so `finally` can safely emit exactly once.
- **Commit:** `17ec59c`

## Known stubs

None for this plan.

## Threat flags

None beyond plan register: summary stays count-only; vision list growth is capped with explicit drop policy and logged.

## Self-Check

PASSED

- FOUND: `.planning/phases/30-replace-page-level-chunking-with-layout-aware-chunking/30-03-SUMMARY.md`
- FOUND commits: `f30740a`, `17ec59c`, `a5016d8`
