# Phase 7: Layout-aware chunk-based parsing — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `07-CONTEXT.md`.

**Date:** 2026-04-11  
**Phase:** 07-layout-aware-chunk-based-parsing-token-optimized  
**Areas discussed:** Parse timing — granularity; full-run total (follow-up)

---

## Parse timing — granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Chunk AI only | Wall-clock per chunk text-MCQ API call | ✓ |
| Orchestration steps | Chunk + build/merge/retry/fallback breakdown (no deep PDF timing) | |
| Full + drill-down | End-to-end total + orchestration detail | |

**User's choice:** Per-chunk AI timing as the primary breakdown.

**Notes:** Aligns with tuning slow chunks / model latency without expanding scope to OCR/pdf substeps in this pass.

---

## Full-run total elapsed

| Option | Description | Selected |
|--------|-------------|----------|
| Yes | One aggregate line for the whole parse run + per-chunk table | ✓ |
| No | Per-chunk only, no end-to-end total | |

**User's choice:** Include one-line (or single aggregate) total for the parse run in addition to per-chunk durations.

**Notes:** End-to-end does not require subdividing OCR/raster/IDB unless added later (see `<deferred>` in CONTEXT).

---

## Gray areas not selected this session

- **Surface** (debug-only vs always visible vs dev flag) — left to **D-29** + planner/UI discretion tied to D-26.
- **Persistence** (memory vs IDB vs export) — default in-memory + optional `pipelineLog` per 06-CONTEXT; no IDB schema lock.
- **Format** (table vs timeline vs console) — planner discretion within D-26/D-29.

## Deferred ideas (from session)

- Rich **per-substep** pipeline timing (OCR per page, rasterize, etc.) — deferred; user may revisit if D-27–D-28 insufficient.

## Claude's Discretion

- Exact placement of total vs per-chunk rows; log verbosity gates (Phase 6 D-05).

---

*Phase: 07-layout-aware-chunk-based-parsing-token-optimized*
