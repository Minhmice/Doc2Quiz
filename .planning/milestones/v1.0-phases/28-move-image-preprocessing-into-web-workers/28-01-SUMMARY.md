---
phase: 28-move-image-preprocessing-into-web-workers
plan: 01
subsystem: pdf-image-preprocess
tags: [performance, web-worker, pdf, vision]
requires: []
provides:
  - PERF-28-01
  - PERF-28-02
affects:
  - src/lib/pdf/imagePreprocess/encodeJpegInWorker.ts
  - src/lib/pdf/imagePreprocess/imagePreprocess.worker.ts
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
key_files:
  created:
    - src/lib/pdf/imagePreprocess/encodeJpegInWorker.ts
    - src/lib/pdf/imagePreprocess/imagePreprocess.worker.ts
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
commits:
  - 3d70549
  - 0401704
completed_at: "2026-04-17"
---

# Phase 28 Plan 01: Single sequential image preprocess worker — Summary

Move CPU-heavy **resize + JPEG encode** off the main thread via a **single sequential Web Worker**, while preserving the existing `dataUrl: string` contract and AbortSignal semantics with safe auto-fallback (integration is planned for `28-02`).

## What Changed

- **Planning artifacts**: Phase 28 goal + requirements are now defined and mapped to new IDs **PERF-28-01** and **PERF-28-02**.
- **Worker implementation**: Added a dedicated worker module that performs aspect-preserving downscale and JPEG encoding, returning `data:image/jpeg;base64,...`.
- **Client helper**: Added a client-side helper that:
  - Detects capability (Worker + OffscreenCanvas + `convertToBlob` + `createImageBitmap`)
  - Maintains a **single worker instance** and processes requests **sequentially**
  - Respects **AbortSignal** by rejecting promptly with `AbortError`
  - Fails safe (throws) so callers can fall back to the existing main-thread encode path

## Key Files

- `src/lib/pdf/imagePreprocess/imagePreprocess.worker.ts`
- `src/lib/pdf/imagePreprocess/encodeJpegInWorker.ts`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`

## Verification

- `npm run lint` (warnings only; no errors)
- `npm run build`

## Deviations from Plan

None — executed as written.

## Known Stubs

None.

## Self-Check

- PASSED

