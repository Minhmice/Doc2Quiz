---
phase: 28-move-image-preprocessing-into-web-workers
plan: 02
subsystem: pdf-vision-raster
tags: [performance, web-worker, pdf, vision]
requires: [PERF-28-01]
provides: [PERF-28-02]
affects:
  - src/lib/pdf/renderPagesToImages.ts
key_files:
  modified:
    - src/lib/pdf/renderPagesToImages.ts
commits:
  - f235db9
completed_at: "2026-04-17"
---

# Phase 28 Plan 02: Wire worker-backed JPEG preprocessing — Summary

Integrate the **worker-backed resize + JPEG encode** into `renderPdfPagesToImages()` while keeping **pdf.js rendering on the main thread**, preserving the `dataUrl` contract, and falling back safely to the existing `canvas.toDataURL("image/jpeg")` path when worker encoding is unavailable or fails.

## What Changed

- `renderPdfPagesToImages()` now prefers `encodeJpegDataUrlInWorker()` when supported.
- Worker failures (non-abort) automatically fall back to main-thread `canvas.toDataURL` and disable worker usage for the remainder of the batch to avoid repeated failures/noise.
- Abort semantics are preserved: `AbortError` is propagated immediately.

## Verification

- `npm run lint` (warnings only; no errors)
- `npm run build`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Tooling] `gsd-tools state record-metric` could not detect metrics section**
- **Issue:** `state record-metric` reported “Performance Metrics section not found in STATE.md” despite the section existing.
- **Fix:** Recorded the metric entry manually in `.planning/STATE.md` so phase metrics remain accurate.

## Known Stubs

None.

## Self-Check

- PASSED

