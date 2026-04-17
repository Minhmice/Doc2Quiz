# Phase 30: Replace page-level chunking with layout-aware chunking - Context

**Gathered:** 2026-04-17  
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current **page-level / linear text chunking** used in the quiz text lane with **layout-aware chunking**, so quiz parsing on born-digital PDFs is more accurate and less sensitive to formatting (columns, headings, lists) while staying consistent with:

- Phase 29 per-page routing (text pages vs bitmap pages)
- Phase 27 preview-first budget (3–5 pages)
- “No OCR dependency in product flow” constraint from Phase 29 decisions

</domain>

<decisions>
## Implementation Decisions

### Chunk source (product-first)
- **D-01:** Layout-aware chunking for born-digital PDFs should use **pdf.js text layer + geometry** (not OCR) as the primary source in the product create flow.
- **D-02:** Do **not** auto-enable OCR to power layout chunks in the product flow for this phase (keep Phase 29’s product/OCR posture intact).

### Granularity
- **D-03:** Chunk granularity is **block/paragraph-level** (layout blocks), targeting “just enough text” for ~1–2 MCQs per chunk.

### Fallback policy
- **D-04:** Use **per-page** (and/or per-chunk) fallback to vision: only pages/chunks that fail or produce low-quality output should be routed to the vision lane, rather than falling back the entire document.

### Integration with Phase 29 routing
- **D-05:** Apply layout-aware chunking only to **`text` pages** in Phase 29’s routing plan. Bitmap pages remain vision-rasterized and parsed as-is.
- **D-06:** Preserve preview-first behavior: prioritize chunk/parse for the first **3–5 pages** to reduce time-to-first-results.

### UX / observability (no new UI controls)
- **D-07:** Add exactly **one summary `pipelineLog`** for layout-aware chunking runs (numeric/count-based only), similar to Phase 29’s routing summary: counts, caps, fallback counts/reasons, and wall-time totals. No new UI controls.

### Claude's Discretion
- The exact block-building algorithm over pdf.js text items (as long as it uses geometry and stays deterministic).
- Exact “low-quality” thresholds that trigger per-page fallback (as long as they are conservative and observable via summary logs).

</decisions>

<specifics>
## Specific Ideas

- Make the born-digital text lane robust to multi-column pages and headings without requiring rasterization.
- Keep any additional debug detail (per-block) behind existing verbose/dev logging controls; product UX stays unchanged.

</specifics>

<canonical_refs>
## Canonical References

### Phase dependencies & constraints
- `.planning/ROADMAP.md` — Phase 30 entry (depends on Phase 29)
- `.planning/phases/29-route-by-page-type-text-page-vs-bitmap-page-vs-rich-layout-p/29-CONTEXT.md` — per-page routing authority + no OCR dependency + budgets
- `.planning/phases/27-preview-first-parsing-while-full-upload-continues/27-CONTEXT.md` — preview-first budget (3–5 pages)

### Existing pipeline seams to reuse
- `src/components/ai/AiParseSection.tsx` — current quiz text lane and per-page routing integration point
- `src/lib/ai/chunkText.ts` — current linear chunking to replace
- `src/lib/pdf/extractPdfText.ts` — text extraction utilities (and any per-page-range extraction)
- `src/lib/pdf/sampleTextLayerSignal.ts` — existing text-layer signals/patterns
- `src/lib/ai/runSequentialParse.ts` — sequential chunk parse lane (quiz text-first)

</canonical_refs>

<code_context>
## Existing Code Insights

### Established patterns
- Phase 29 routing already enforces caps and emits one summary `pipelineLog("VISION","page-route",...)`.
- `runLayoutChunkParse` exists today but is OCR-run based; Phase 30 should not require OCR in product flow.

### Integration points
- Implement a pdf.js-based “layout block builder” that outputs chunk strings + provenance (page indices) for the existing sequential parse lane.
- Ensure per-page fallback can reuse Phase 29’s bitmap/vision path without reintroducing full-document rasterization.

</code_context>

<deferred>
## Deferred Ideas

- Using OCR to generate layout chunks in the product flow (keep dev/advanced only).
- Any new UI controls (strategy toggles, pause/resume, etc.).

</deferred>

---

*Phase: 30-replace-page-level-chunking-with-layout-aware-chunking*  
*Context gathered: 2026-04-17*
