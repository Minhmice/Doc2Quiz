# Phase 14: Page mapping & provenance quality — Context

**Gathered:** 2026-04-11  
**Status:** Ready for planning  

**Note:** `/gsd-discuss-phase 14` was run without interactive gray-area multi-select (no `AskUserQuestion` in this session). Gray areas below were **all treated as in-scope**; decisions follow the Phase 14 roadmap goal and a **code audit** of `AiParseSection` / `mapQuestionsToPages` (vision finalize currently swallows mapping errors in an empty `catch`).

<domain>
## Phase Boundary

Improve **honesty and visibility** of **page ↔ question provenance** after parse: do not rely on **silent** best-effort behavior when mapping fails or is uncertain; make **quality and confidence** obvious in UI and summaries while still allowing **draft persistence** (labeled, not indistinguishable from fully mapped sets).

**In scope:** Caller behavior around `applyQuestionPageMapping`, user-visible warnings/summary, review/parse surfaces for per-question mapping state, optional lightweight roll-up, doc alignment.

**Out of scope:** New cloud backends, reimplementing overlap algorithm from scratch, full crop pipeline (defer to existing backlog), rate limiting (Phase 14 README/defer).

</domain>

<decisions>
## Implementation Decisions

### Caller behavior (no silent swallow)

- **D-01:** Remove the **empty `catch`** around `applyQuestionPageMapping` in **`finalizeVisionParseResult`** (`AiParseSection.tsx`). If mapping throws, **log** to `pipelineLog` with domain `MAPPING` (or existing naming convention), **toast** a non-dismissed-immediately error (or `toast.error`), and **still persist** the vision questions — do not drop the parse. Rationale: operators must know mapping code failed vs. inconclusive overlap.

- **D-02:** **Layout-aware path** (`finalizeLayoutChunkParseResult` / merge path) already calls `applyQuestionPageMapping` **without** try/catch — **keep** throws propagating to existing outer error handling; do not add a new empty catch there.

- **D-03:** OCR snapshot fetch (`getOcrResult`) may remain best-effort with a **single** log or toast when load fails **and** mapping will lack OCR (`ocrSnapshot === null`) — but combine with **D-04** so the user sees “mapping used vision-only provenance” rather than silence.

### Surfacing uncertainty (thresholds & UX)

- **D-04:** Treat **`mappingMethod === "unresolved"`** OR **`mappingConfidence` defined and `< 0.45`** as **“uncertain page mapping”** for UI/summary (tunable constant in one module, e.g. `mappingQuality.ts`). **`mappingConfidence === 0` with unresolved** is **strong** warning tier.

- **D-05:** After every successful parse that persists a draft, if **any** question matches D-04, show **`toast.warning`** with a **count** (e.g. “3 questions have uncertain or missing page mapping — check review”) **in addition to** updating the parse **summary** string (not only toast).

- **D-06:** **Review** (and parse preview where questions are listed): per-question **chip** or badge: **Mapped** (high confidence / layout_chunk / vision attach provenance), **Uncertain** (low overlap margin, vision single-page blanket, etc.), **Unresolved** — driven from existing fields `mappingMethod`, `mappingConfidence`, `mappingReason` (truncate reason in tooltip).

- **D-07:** **Do not block** `persistQuestions` on uncertain mapping; blocking is out of scope for this phase (human-in-the-loop stays at review/approve). **Do** make uncertain state **visible before approve**.

### Data model

- **D-08:** Prefer **no new persisted schema version** in v1 of this phase: use existing **`Question.mappingMethod`**, **`mappingConfidence`**, **`mappingReason`**, **`sourcePageIndex`**. Optional: add **`parseRunMappingStats`** (or similar) on a **volatile** client-only summary object if needed for UI — **Claude's discretion** whether to add IndexedDB meta; default **derive counts from `questions[]` on read**.

- **D-09:** If a future task needs **study-set-level** persisted warning, add optional field on **`StudySetMeta`** in a follow-up plan only after derive-on-read proves insufficient (defer default).

### Documentation

- **D-10:** Update **`.planning/codebase/WORKFLOW-OCR-AI-QUIZ.md`** (and any comment next to the removed `catch`) to state: mapping is still **heuristic**, but **failures and uncertainty are user-visible**; draft save does not imply full provenance.

### Claude's Discretion

- Exact **toast** copy, **chip** colors, and **threshold** `0.45` may be tuned during implementation for a11y and visual consistency with existing `sonner` / design system.
- Whether to add a small **`mappingQuality.ts`** helper vs. inline predicates — implementer choice.
- Pipeline log **severity** string for mapping exceptions (`error` vs `warn`) — default **`error`** for thrown exceptions, **`warn`** for aggregate uncertain count after successful mapping.

</decisions>

<specifics>
## Specific Ideas

- **Evidence:** `finalizeVisionParseResult` lines ~641–653 wrap `applyQuestionPageMapping` in `try/catch` with comment *"mapping is best-effort; vision + draft persist still proceed" — this is the primary anti-pattern for Phase 14.*
- **Existing types:** `Question` already includes `mappingMethod`, `mappingConfidence`, `mappingReason`, `parseConfidence`, `parseStructureValid` — leverage before adding fields.
- User phrasing (VN): không nuốt lỗi; draft vẫn lưu nhưng phải có **cảnh báo / cờ chất lượng** rõ — reflected in D-01, D-05, D-06.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mapping & types

- `src/lib/ai/mapQuestionsToPages.ts` — `applyQuestionPageMapping`, overlap thresholds, `unresolved` / provenance paths.
- `src/types/question.ts` — `QuestionPageMappingMethod`, mapping fields on `Question`.

### Call sites & persistence

- `src/components/ai/AiParseSection.tsx` — `finalizeVisionParseResult`, layout merge + `applyQuestionPageMapping`, `persistQuestions`.
- `src/lib/db/studySetDb.ts` — draft persistence (`getDraftQuestions` / `putDraftQuestions` or equivalents used by parse flow).

### Pipeline logging

- `src/lib/logging/pipelineLogger.ts` — extend or reuse stage tags for mapping warnings/errors (align with Phase 13 later if needed).

### Workflow doc

- `.planning/codebase/WORKFLOW-OCR-AI-QUIZ.md` — section on question ↔ page mapping; update per D-10.

### Prior phase context (consistency)

- `.planning/phases/07-layout-aware-chunk-based-parsing-token-optimized/07-CONTEXT.md` — chunk provenance / `layoutChunkId` expectations where relevant.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets

- **`applyQuestionPageMapping`** already sets `mappingMethod`, `mappingConfidence`, `mappingReason` for OCR overlap, vision, layout chunk, and unresolved cases.
- **`toast`** from `sonner` already used for attach failures in vision flow — reuse pattern for mapping aggregate warnings.

### Established patterns

- **`pipelineLog(domain, …)`** for structured diagnostics; use for mapping exceptions and optionally aggregate stats.
- **Draft persistence** happens after `setQuestions` in finalize paths — warnings should fire **before or after** persist consistently (prefer **after** persist succeeds so user sees data saved + warning).

### Integration points

- **Parse summary** (`setSummary`) and **parse overlay log** — natural place for “N uncertain mappings” without new screens.
- **Review section** components under `src/components/review/` — wire chips when listing questions.

</code_context>

<deferred>
## Deferred Ideas

- **Persisted study-set-level** `lastParseMappingQuality` / JSON blob — only if derive-on-read is insufficient (D-09).
- **Server-side** mapping validation or **rate limits** — outside Phase 14.
- **Changing OCR overlap constants** (`OCR_OVERLAP_MIN_SCORE` / margin) — separate tuning phase unless planner bundles a small measurable tweak with user-visible reporting.

</deferred>

---

*Phase: 14-page-mapping-and-provenance-quality-surface-mapping-failures*  
*Context gathered: 2026-04-11 — discuss-phase (defaults locked, no interactive gray-area pick)*
