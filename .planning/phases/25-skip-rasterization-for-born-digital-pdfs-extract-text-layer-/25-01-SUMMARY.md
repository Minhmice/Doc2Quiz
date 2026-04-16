---
phase: 25-skip-rasterization-for-born-digital-pdfs-extract-text-layer-
plan: 01
subsystem: pdf-routing
tags:
  - pdf
  - pdfjs
  - routing
requires:
  - PDFOPT-01
  - PDFOPT-04
provides:
  - Deterministic sampled text-layer signal (numeric-only)
  - Stable reason codes + one-line rationale for routing decisions
affects:
  - src/lib/pdf/sampleTextLayerSignal.ts
  - src/lib/ai/parseRoutePolicy.ts
commits:
  - a51aa7e
  - ebc67c5
verified:
  - "npm run lint"
  - "npm run build"
---

# Phase 25 Plan 01: Skip rasterization for born-digital PDFs — sampled text-layer signal + policy reason codes

Add a deterministic, sampling-based text-layer signal (numeric-only) and extend the parse-route policy contract to consume it and emit stable reason codes + short rationales, enabling downstream work to skip rasterization when text is strong.

## What shipped

- **Sampled text-layer signal helper**
  - New `sampleTextLayerSignal(file, { signal, samplePages })` computes document-level metrics by sampling the first 3–5 pages via pdf.js `getTextContent()` without extracting/concatenating the full document text.
  - Returns numeric-only metrics: `sampledPages`, `nonEmptyPageRatio`, `charsPerPage`, `totalChars`, `nonEmptyPages`.
  - Abort-safe and non-throwing; logs structured numeric metrics only (no PDF text) via `pipelineLog`.

- **Routing policy contract update**
  - `decideParseRoute` now accepts optional `textLayerSignal` (numeric-only) and classifies **strong / weak / uncertain** using both `charsPerPage` and `nonEmptyPageRatio`.
  - Adds stable reason codes (grep-stable constants) including:
    - `text_layer_strong`
    - `text_layer_weak_or_unknown`
    - `text_layer_uncertain_default_vision`
    - `text_layer_sampled_first_pages`
  - `rationale` strings are short one-liners suitable for overlay/progress logs and include numeric hints only.

## Task-by-task

| Task | Name | Result | Commit |
| ---- | ---- | ------ | ------ |
| 1 | Define Phase 25 requirement IDs + roadmap entry | No changes needed (already present in `.planning/REQUIREMENTS.md` + `.planning/ROADMAP.md`) | n/a |
| 2 | Implement PDF text-layer sampling metrics (no full extraction) | Implemented `sampleTextLayerSignal` | a51aa7e |
| 3 | Update parse-route policy contract to incorporate ratio + uncertainty | Extended policy contract + reason codes | ebc67c5 |

## Notes on threat model mitigations

- **T-25-01 (DoS)**: Sampling is hard-capped to the first 3–5 pages (or fewer if the PDF has <3 pages) and respects `AbortSignal`.
- **T-25-02 (Info disclosure)**: Logs and rationales are numeric-only and never include raw extracted PDF text.

## Deviations from Plan

- None. (Task 1 was already satisfied before execution; Tasks 2–3 executed as written.)

## Self-Check: PASSED

- Confirmed commits exist: `a51aa7e`, `ebc67c5`
- Verified: `npm run lint`, `npm run build`

