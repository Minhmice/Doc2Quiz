# Phase 25: Skip rasterization for born-digital PDFs; extract text layer first - Context

**Gathered:** 2026-04-16  
**Status:** Ready for planning

<domain>
## Phase Boundary

When parsing **Quiz** from a PDF, if the document has a **strong native text layer**, the app should **avoid rasterizing pages to images** and run a **text-first** parse path (chunk/layout). Vision page rasterization remains the fallback for scanned/weak-text PDFs, and can also be used as an automatic fallback when the text-first output quality is too low.

</domain>

<decisions>
## Implementation Decisions

### Text-layer signal (born-digital detection)
- **D-01:** Strong-text detection uses **both**:
  - chars/page, and
  - non-empty page ratio
- **D-02:** Default chars/page threshold (when used): **40 chars/page**.
- **D-03:** If the signal is **uncertain**, default is **vision** (safe fallback).
- **D-04:** Compute signal using **sampling**: **always sample the first 3–5 pages**, even if `doc.extractedText` already exists.

### Default policy & overrides
- **D-05:** When strong text is detected, **auto-route to text-first** (chunk/layout) for quiz parse and **skip rasterization**.
- **D-06:** User override lives in the existing **Parse Strategy** UI (`AiParseParseStrategyPanel`), with a clear hint/label when strong text is detected (e.g. “text-first auto”).
- **D-07:** If the user chooses **Accurate**, it remains **vision-first** (Accurate keeps its meaning).
- **D-08:** If text-first is low quality, the app uses a **quality gate** and can **automatically fallback to vision** (no extra confirmation prompt).

### Mixed PDFs (some pages text, some scanned)
- **D-09:** Document-level rule: if strong text signal wins, still run **text-first**; rely on **quality gate** to fallback to vision when needed.
- **D-10:** Phase 25 is OK if text-first **misses some scanned pages**; user can rerun Vision. (True per-page routing is deferred.)
- **D-11:** Quality gate uses **both** minimum question count **and** confidence/validity summary.
- **D-12:** Default minimum question threshold: if **< 5 questions**, fallback to vision.

### UX + logs
- **D-13:** User-facing messaging should be **short** (one-liners).
- **D-14:** When falling back to vision, show a **light toast** (avoid silent behavior).
- **D-15:** Primary place to show routing/fallback messages is the existing **overlay log/progress** in `AiParseSection`.
- **D-16:** Log/debug output should include **reason codes** (e.g. `text_layer_strong`) plus a short rationale.

### Claude's Discretion
- Exact sampling size (3 vs 5 pages) within the 3–5 range.
- Exact confidence aggregation method for the quality gate, as long as it’s deterministic and explained in logs.
- Copywriting tone as long as it stays short and student-friendly (consistent with Phase 01).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product + constraints
- `.planning/PROJECT.md` — local-first + BYOK constraints
- `.planning/REQUIREMENTS.md` — v1 constraints (no local OCR, etc.)
- `.planning/ROADMAP.md` — Phase 25 entry + dependency chain

### Current pipeline map
- `.planning/codebase/WORKFLOW-OCR-AI-QUIZ.md` — end-to-end flow and where rasterization happens today

### Key codepaths to change / integrate with
- `src/lib/pdf/extractPdfText.ts` — text layer extraction
- `src/lib/ai/parseRoutePolicy.ts` — strong-text signal + reason codes (already exists)
- `src/components/ai/AiParseSection.tsx` — current parse orchestration (currently vision-batch-only for quiz)
- `src/lib/pdf/renderPagesToImages.ts` — rasterization cost center to avoid when strong text

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/pdf/extractPdfText.ts` — already extracts native PDF text layer.
- `src/lib/ai/parseRoutePolicy.ts` — already computes a strong-text signal (chars/page) and emits reason codes.
- `AiParseParseStrategyPanel` + stored preferences — existing UX seam for routing/override.

### Established Patterns
- Local-first persistence via IndexedDB (`studySetDb`), BYOK forwarding via same-origin routes.
- Structured logging via `pipelineLog(...)` and reason-code style decisions (e.g. `TEXT_LAYER_STRONG`).

### Integration Points
- Quiz parse orchestration in `src/components/ai/AiParseSection.tsx` must regain/introduce a text-first execution lane that does **not** call `renderPdfPagesToImages` when strong text is detected.

</code_context>

<specifics>
## Specific Ideas

- The “text-first” decision should be visible and debuggable: log one line like “Using text layer (fast) — skipping page images.” plus stable reason codes.
- Automatic fallback to vision is allowed when text-first results are too weak (min < 5 questions + confidence summary).

</specifics>

<deferred>
## Deferred Ideas

- Per-page routing (avoid rasterizing only the text-bearing pages, render only bitmap pages) — belongs to Phase 29.

</deferred>

---

*Phase: 25-skip-rasterization-for-born-digital-pdfs-extract-text-layer-*
*Context gathered: 2026-04-16*

