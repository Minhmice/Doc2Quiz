---
phase: 29-route-by-page-type-text-page-vs-bitmap-page-vs-rich-layout-p
plan: 03
subsystem: pdf-routing
tags:
  - pdf
  - routing
  - vision
  - budgets
requires:
  - ROUTE-29-01
  - ROUTE-29-02
provides:
  - ROUTE-29-03
  - ROUTE-29-04
affects:
  - src/lib/pdf/pageRoutePlan.ts
  - src/lib/pdf/classifyPdfPages.ts
  - src/components/ai/AiParseSection.tsx
tech_stack:
  - Next.js App Router
  - TypeScript
completed_at: "2026-04-18"
---

# Phase 29 Plan 03: Harden caps/budgets + routing summary log Summary

Harden per-page routing so **vision workload cannot exceed caps** (even on mixed PDFs), and emit **one structured routing summary log line** (counts/caps/reason codes only) without adding UI controls.

## What Changed

### Explicit cap enforcement by construction

- Updated `src/lib/pdf/pageRoutePlan.ts`:
  - Added `finalizePageRoutePlan(...)` to normalize/dedupe indices and apply the `visionMaxPages` cap.
  - When bitmap pages are dropped due to caps, annotates dropped pages with the stable reason code `page_dropped_vision_cap` and records `droppedBitmapPagesCount`.

- Updated `src/lib/pdf/classifyPdfPages.ts`:
  - Refactored conservative fallbacks and normal classification outputs to go through `finalizePageRoutePlan(...)`.
  - Ensures `bitmapPageIndicesForVision.length <= visionMaxPages` is guaranteed by construction, while still tracking total bitmap pages via `bitmapPageIndicesAll`.

### Single routing summary log line (no UI changes)

- Updated `src/components/ai/AiParseSection.tsx` (quiz lane only):
  - Emits exactly one `pipelineLog("VISION", "page-route", ...)` entry for runs with a computed routing plan, containing:
    - counts: `pageCount`, `pages`, `textPageIndices`, `bitmapPageIndicesAll`, `bitmapPageIndicesForVision`, `droppedBitmapPagesCount`
    - caps: `previewFirstPageBudget`, `visionMaxPages`
    - `stableReasonCodes`: sorted unique list across the plan
  - Log content is numeric/count-based only (no extracted text).

## Verification

- `npm run lint` (warnings only; no new errors)
- `npm run build`

## Commits

- `3814c4d`: `feat(29-03): finalize page route plan caps`
- `6fec796`: `feat(29-03): log routing summary to pipeline`

## Deviations from Plan

None — executed as written.

## Threat Flags

None — routing logs remain numeric/count-based and caps are enforced centrally.

## Self-Check

PASSED

- FOUND: `.planning/phases/29-route-by-page-type-text-page-vs-bitmap-page-vs-rich-layout-p/29-03-SUMMARY.md`
- FOUND commits: `3814c4d` (Task 1), `6fec796` (Task 2)

