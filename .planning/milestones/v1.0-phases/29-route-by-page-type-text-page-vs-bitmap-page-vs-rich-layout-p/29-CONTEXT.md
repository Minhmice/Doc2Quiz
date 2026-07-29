# Phase 29: Route by page type (text vs bitmap vs rich layout) - Context

**Gathered:** 2026-04-17  
**Status:** Ready for planning  
**Mode:** assumptions (`/gsd-discuss-phase 29 --analyze`)

<domain>
## Phase Boundary

Introduce **per-page routing** so mixed PDFs (some pages have a strong native text layer, some are scanned/bitmap, some are layout-heavy) can be processed by the most appropriate lane **without paying raster/vision costs for text pages**.

This phase builds on:
- Phase 25: doc-level sampled text-layer signal + text-first vs vision fallback policy
- Phase 27: preview-first (3–5 pages) scheduling constraints
- Phase 28: worker-based JPEG encode (do not revisit)

</domain>

<decisions>
## Implementation Decisions

### Routing authority & integration seam
- **D-01:** Routing becomes **page-aware**: classify pages first, then route subsets to the right pipeline lane. `AiParseSection` remains the primary routing authority (do not create a second conflicting router elsewhere).
- **D-02:** The router must integrate **before** we materialize page images (`renderPdfPagesToImages`) so text pages do not get rasterized unnecessarily.

### Page taxonomy (minimal, measurable)
- **D-03:** Phase 29 page taxonomy:
  - **text page**: strong native text layer usable for text-first parsing
  - **bitmap page**: no/weak native text layer; requires vision (and/or OCR in developer flows)
  - **rich layout page**: *not a new detector in Phase 29*; instead rely on downstream `includePageImage` behavior (see D-06)

### Mixed-document policy
- **D-04:** Mixed PDFs use **per-page routing**:
  - text pages → text-first extract/parse
  - bitmap pages → vision raster + parse
  - preserve a single unified output bank per study set (no “sub runs” that break provenance)

### OCR policy (product create flow)
- **D-05:** Keep current behavior: **product create flow still does not auto-enable OCR**. Routing must not require OCR signals to function in learner flows. (OCR can remain developer/advanced-only where it already exists.)

### “Rich layout” semantics (no new detector)
- **D-06:** Do not ship a new per-page “rich layout detector” in Phase 29. Continue to treat “rich layout” as a downstream question-level consequence:
  - If the model output indicates `includePageImage: true`, attach page images for those questions.

### Budget & preview constraints
- **D-07:** Preserve existing caps and preview scheduling constraints:
  - preview-first budget remains **3–5 pages**
  - vision max pages default remains **20** (or existing cap)
  - routing must not increase total vision workload beyond current caps

### Observability contract
- **D-08:** Extend existing “reason code” observability patterns so routing outcomes (and any fallbacks) are debuggable without adding new UI controls.

### Claude's Discretion
- Exact per-page signals to classify text vs bitmap (as long as it’s derived from pdf.js text layer evidence and respects budgets).
- Exact data structure for “page plan” passed into the existing lanes (as long as it plugs into `AiParseSection` cleanly).

</decisions>

<specifics>
## Specific Ideas

- Reduce unnecessary rasterization for born-digital PDFs even when they contain a few scanned pages.
- Keep Phase 25’s doc-level safety net available (e.g., still allow a full-vision fallback if routed text output is unusable), but prefer per-page routing as the primary mixed-doc behavior.

</specifics>

<canonical_refs>
## Canonical References

### Roadmap & constraints
- `.planning/ROADMAP.md` — Phase 29 boundary (depends on Phase 28)
- `.planning/STATE.md` — phase ordering + prior decisions
- `.planning/phases/25-skip-rasterization-for-born-digital-pdfs-extract-text-layer-/25-CONTEXT.md` — sampled text-layer signal + doc-level policy
- `.planning/phases/27-preview-first-parsing-while-full-upload-continues/27-CONTEXT.md` — preview-first (3–5 pages) constraints
- `.planning/phases/28-move-image-preprocessing-into-web-workers/28-CONTEXT.md` — worker encode exists; Phase 29 should just use it

### Code integration points
- `src/components/ai/AiParseSection.tsx` — current routing + lane orchestration (must remain authority)
- `src/lib/ai/parseRoutePolicy.ts` — existing reason-code driven route policy
- `src/lib/pdf/sampleTextLayerSignal.ts` — current sampled signal (doc-level today)
- `src/lib/pdf/extractPdfText.ts` — text-first extraction
- `src/lib/pdf/renderPagesToImages.ts` — raster seam (must be routed before this)
- `src/lib/ai/runVisionBatchSequential.ts` — vision batch lane
- `src/lib/ai/runOcrSequential.ts` — OCR lane (dev/advanced)
- `src/lib/ai/runLayoutChunkParse.ts` — chunk lane + `needsVisionFallback` signals

</canonical_refs>

<code_context>
## Existing Code Insights

### Established patterns to reuse
- Doc-level route currently: `sampleTextLayerSignal` → `decideParseRoute` → lanes inside `AiParseSection`.
- Text-first lane already avoids rasterization by using `extractPdfTextForPageRange`.
- Vision lane already has caps and preview hooks (`previewPageBudget`, `onPreviewPagesAvailable`).
- Question-level “attach page image” is already controlled by `includePageImage` (`attachPageImagesForQuestions`).

### Main risk to avoid
- Two competing routing sources (e.g., adding route logic in `pdf/*` while `AiParseSection` still decides elsewhere).

</code_context>

<deferred>
## Deferred Ideas

- Add a true per-page “rich layout” heuristic detector (density/objects) — later phase if needed.
- Change primary image transport from `dataUrl` to `Blob`/`ArrayBuffer` — not Phase 29.

</deferred>

---

*Phase: 29-route-by-page-type-text-page-vs-bitmap-page-vs-rich-layout-p*  
*Context gathered: 2026-04-17*
