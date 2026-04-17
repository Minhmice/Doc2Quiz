# Phase 35: Tune OCR preprocessing — Context

**Gathered:** 2026-04-18  
**Status:** Ready for planning  
**Mode:** Smart discuss — auto-accepted (recommended defaults; no interactive grey-area session)

<domain>
## Phase boundary

Improve **OCR input quality and cost** by tuning **client-side image preprocessing** before OCR/vision raster paths: **adaptive or fixed thresholding** where it helps scanned pages, **downsample / cap megapixels** for huge pages so encode + OCR stay bounded, and align a **~300 DPI effective** target for typical exam PDFs — **without** new user-facing knobs unless a developer toggle already exists.

**In scope**

- Hooks in the existing **Phase 28 worker** (or adjacent) pipeline that produces JPEG/data URLs for OCR/vision.
- **Deterministic** transforms first (resize, grayscale, optional threshold); keep **AbortSignal** and existing caps.
- **pipelineLog** reason codes for “downsampled”, “threshold applied”, not noisy per-page spam.

**Out of scope**

- Replacing the OCR **engine** (still BYOK / same-origin forward).
- Server-side image processing (Phase 15 scale mode) as the **primary** path for this phase.

</domain>

<decisions>
## Implementation decisions

### Preprocessing placement
- **D-35-01:** Apply heavy preprocessing in the **same Web Worker path** used for vision JPEG prep (Phase 28), keeping the **main thread** for PDF render; fall back to main-thread only if Worker unavailable (parity with existing fallback).

### Resolution and downsampling
- **D-35-02:** Target **~300 DPI equivalent** for a “page image” sent to OCR by deriving scale from **page points size × zoom**; if resulting pixel count exceeds a **fixed megapixel cap**, **downsample** proportionally before JPEG encode (constants in one module; planner picks numbers from current `renderPagesToImages` / vision caps).

### Thresholding
- **D-35-03:** Use a **simple, fast** global or **Otsu-style** threshold only when **heuristic** suggests scanned/low-contrast bitmap (reuse or extend signals from Phase 29 page classification where cheap); default **off** for clean digital renders to avoid destroying text.

### Observability and safety
- **D-35-04:** One **summary** pipeline log per run or per batch (not per page by default); preserve **byte/size caps** and **abort** semantics.

### Claude’s discretion
- Exact megapixel cap, threshold algorithm library vs inline, and per-route enablement — optimize for latency and OCR accuracy on representative PDFs without contradicting D-35-01–D-35-04.

</decisions>

<code_context>
## Existing code insights

### Reusable assets
- `src/lib/pdf/renderPagesToImages.ts` and Phase **28** worker helper for resize/JPEG.
- Phase **29** page classification signals (text vs bitmap) for gating thresholding.

### Established patterns
- **AbortSignal** through raster pipeline; **vision caps** and preview-first budgets elsewhere.

### Integration points
- Call sites that pass images into **OCR sequential** / **vision** batch — ensure single preprocessing entrypoint so behavior stays consistent.

</code_context>

<specifics>
## Specific ideas

- Auto-discuss chose **worker-first**, **300 DPI target**, **downsample over cap**, **optional threshold** gated by page type heuristics.

</specifics>

<deferred>
## Deferred ideas

- GPU/WebGL preprocessing; per-user “scan quality” slider — defer unless product asks.

</deferred>
