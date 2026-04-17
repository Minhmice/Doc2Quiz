---
phase: 29-route-by-page-type-text-page-vs-bitmap-page-vs-rich-layout-p
plan: 01
subsystem: pdf-routing
tags:
  - pdf
  - routing
  - observability
requires: []
provides:
  - ROUTE-29-01
  - ROUTE-29-02
  - ROUTE-29-03
  - ROUTE-29-04
affects:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - src/lib/pdf/pageRoutePlan.ts
  - src/lib/pdf/classifyPdfPages.ts
tech_stack:
  - Next.js App Router
  - TypeScript
  - pdfjs-dist (via getPdfjs)
completed_at: "2026-04-18"
---

# Phase 29 Plan 01: Route by page type — contracts + per-page classifier (no UI wiring) Summary

Establish Phase 29’s roadmap/requirements contract and add a deterministic, numeric-only per-page classifier plus a serializable routing-plan shape to enable page-aware routing **before rasterization** in later plans.

## What Changed

### Planning docs

- Updated `.planning/ROADMAP.md` to replace Phase 29 TBDs with a concrete goal, stable requirement IDs (`ROUTE-29-01..04`), and a 3-plan breakdown.
- Updated `.planning/REQUIREMENTS.md` to add `ROUTE-29-01..04` under v1+ requirements with testable wording.

### New engine-level seam (no UI integration yet)

- Added `src/lib/pdf/pageRoutePlan.ts` defining:
  - `PageKind = "text" | "bitmap"` (no “rich” detector in Phase 29 per context)
  - `PageRoutePlan` (serializable, page-complete, cap-aware)
  - Grep-stable reason codes (e.g. `PAGE_TEXT_STRONG`, `PAGE_DROPPED_VISION_CAP`)
- Added `src/lib/pdf/classifyPdfPages.ts` exporting `classifyPdfPages(file, options) → PageRoutePlan`:
  - Uses pdf.js `getTextContent()` to compute numeric-only per-page char counts
  - Never returns extracted strings; never throws
  - Enforces `visionMaxPages` only on bitmap→vision subset and records dropped bitmap pages (with reason codes)

## Verification

- `npm run lint` (no errors; existing warnings only)
- `npm run build`

## Deviations from Plan

None — executed as written.

## Threat Flags

None — no new network surface; routing plan stores indices + numeric counts only.

## Self-Check

PASSED

- FOUND: `.planning/phases/29-route-by-page-type-text-page-vs-bitmap-page-vs-rich-layout-p/29-01-SUMMARY.md`
- FOUND commits: `7dfdc14` (Task 1), `2695629` (Task 2)

