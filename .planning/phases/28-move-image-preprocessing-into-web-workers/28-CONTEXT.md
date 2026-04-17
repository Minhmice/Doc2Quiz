# Phase 28: Move image preprocessing into Web Workers - Context

**Gathered:** 2026-04-17  
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the **CPU-heavy image preprocessing** used by the vision/OCR pipeline (PDF page raster → resize/cap → JPEG encode for `data:image/jpeg;base64,...`) off the main thread into **Web Workers**, so the create/parse UI remains responsive.

This phase does **not** change the user-facing create flow features (Phase 27), and does **not** add new parsing capabilities; it is a performance/architecture move with safe fallbacks.

</domain>

<decisions>
## Implementation Decisions

### Worker scope (what moves)
- **D-01:** Move **JPEG encode + resize/downscale** work into a Web Worker.
- **D-02:** Keep **PDF page rendering to a canvas** on the main thread for now (no OffscreenCanvas render-in-worker attempt in this phase).

### Compatibility & fallback
- **D-03:** Use **auto-detect** and **fallback** to the current main-thread path when worker/image APIs are not available; do not hard-block vision rasterization.

### API contract / types
- **D-04:** Keep the existing pipeline contract as **`dataUrl: string`** (`data:image/jpeg;base64,...`) to minimize refactors in downstream callers.
- **D-05:** Keep existing **AbortSignal** semantics; worker jobs must respect `signal.aborted` and cancel promptly.

### Performance model
- **D-06:** Use **a single worker** and process pages **sequentially** (no pooling) for predictable memory and throughput.

### UX surface
- **D-07:** No new UI controls; keep the existing progress surfaces. Any additional telemetry should remain developer/pipeline logs only.

### Claude's Discretion
- Exact internal message protocol (postMessage payload shape), worker bundling strategy (Next.js-friendly), and where to place new worker files, as long as it remains client-only and falls back safely.

</decisions>

<specifics>
## Specific Ideas

- Keep the app feeling “not laggy” during rasterization bursts (especially when generating many pages for vision).
- Avoid broad signature changes across the vision/ocr call graph in this phase.

</specifics>

<canonical_refs>
## Canonical References

### Phase context / constraints
- `.planning/STATE.md` — current milestone focus and phase ordering
- `.planning/ROADMAP.md` — Phase 28 boundary (depends on Phase 27)
- `.planning/phases/27-preview-first-parsing-while-full-upload-continues/27-CONTEXT.md` — create-flow constraints to avoid feature drift

### Key code integration points
- `src/lib/pdf/renderPagesToImages.ts` — current raster + `canvas.toDataURL("image/jpeg", ...)` hot path
- `src/components/ai/AiParseSection.tsx` — vision + OCR pipeline orchestration, calls into `renderPdfPagesToImages`
- `src/lib/pdf/getPdfjs.ts` and `src/lib/pdf/pdfWorker.ts` — existing pdf.js worker setup (do not conflate with Phase 28 image worker)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderPdfPagesToImages()` (`src/lib/pdf/renderPagesToImages.ts`): already has page-by-page loop + preview budget hooks (`onPageRendered`, `onPreviewPagesAvailable`) and is the natural seam to swap encode implementation.

### Established Patterns
- Abort via `AbortSignal` and explicit `AbortError` throwing is already used in the raster loop.
- Pipeline logging exists (`pipelineLog`) for performance tracing without adding UI.

### Integration Points
- Encode step: `canvas.toDataURL("image/jpeg", jpegQuality)` and the scale/maxWidth/maxHeight caps.

</code_context>

<deferred>
## Deferred Ideas

- Rendering PDF pages inside a worker via `OffscreenCanvas` (or `ImageBitmap` pipelines) — defer to a later phase if needed.
- Changing the primary transport to `Blob` / `ArrayBuffer` for memory efficiency — defer (would cascade refactors).

</deferred>

---

*Phase: 28-move-image-preprocessing-into-web-workers*  
*Context gathered: 2026-04-17*
