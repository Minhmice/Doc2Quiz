# Phase 27: Preview-first parsing while full upload continues - Context

**Gathered:** 2026-04-16  
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable a **preview-first** creation experience where **AI parsing starts immediately** after a user selects a PDF, while a **background upload** (Phase 26, env-gated direct-to-object-storage) can continue in parallel.

The goal is to reduce **time-to-first-result** (questions/cards appear ASAP) without breaking the **local-first** contract: local IndexedDB persistence remains the primary source of truth.

</domain>

<decisions>
## Implementation Decisions

### Preview-first start + preview definition
- **D-01:** Start parse **immediately after file selection**, in parallel with (a) local ingest and (b) background upload when enabled.
- **D-02:** “Preview” is **incremental streaming**: show quiz questions / flashcards as soon as they exist (no milestone gate).
- **D-03:** Preview-first applies to **both Quiz and Flashcards**.
- **D-04:** Preview budget is **first 3–5 pages** (align with Phase 25 sampling); parsing should prioritize producing usable items from those pages first.

### UX: progress surface + controls
- **D-05:** Show combined progress in a **top sticky strip** (upload bytes + parse progress), with the content panel below (previews/logs).
- **D-06:** Primary cancel control is **Cancel-all** (cancels upload + parse and starts over). A secondary “Cancel upload only” may exist, but Cancel-all is the default.
- **D-07:** Navigation into study/play is **blocked until background upload completes** (even if parse already has usable output).
- **D-08:** When background upload completes, show a **light toast** (“Upload complete”).

### Persistence and ordering (to avoid blocking preview)
- **D-09:** Generate/persist `studySetId` + meta **first** (and optionally document text), while full PDF bytes persistence can happen later/background so preview-first is not blocked.
- **D-10:** When direct-upload is enabled, **local persistence is always prioritized** and must not be delayed; upload is best-effort and runs in parallel.
- **D-11:** If the user refreshes/closes the tab mid-flow: **no resume** (return to upload step). (Matches Phase 26 “same-session only” constraint.)
- **D-12:** Preview pages (3–5) are always rendered/parsed from the **local File** via pdf.js; parsing must **not** depend on network upload URLs.

### Failure policy (upload fail vs parse fail)
- **D-13:** If upload capability is **local-only** (not configured or provider not ready), hide upload UI entirely and behave exactly like the current local-only flow (no “cloud” messaging).
- **D-14:** If upload fails at finalize / non-retryable error: **Cancel everything** (start over), rather than continuing into study mode.
- **D-15:** If parse fails / produces no usable output while upload is OK: default to **Retry parse** / adjust settings, consistent with current parse issue UX.
- **D-16:** Cancel-all keeps the current cleanup semantics: reset UI and `deleteStudySet` (avoid leaving trash sets).

### Claude's Discretion
- Exact copywriting for the top strip and toast, as long as it is short and consistent with the existing Mint/Stitch tone.
- Whether “Cancel upload only” is exposed (and where), as long as Cancel-all remains the primary action.
- Exact preview scheduler mechanics (how aggressively to prioritize first 3–5 pages) as long as streaming is preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + product constraints
- `.planning/ROADMAP.md` — Phase 27 entry + dependency on Phase 26
- `.planning/PROJECT.md` — local-first + BYOK + no-accounts constraints
- `.planning/REQUIREMENTS.md` — current requirement conventions + v1 constraints
- `.planning/STATE.md` — current progress context

### Prior phase decisions this phase depends on
- `.planning/phases/26-direct-multipart-resumable-upload-to-object-storage/26-CONTEXT.md` — env-gated background upload, bytes progress, cancel, same-session resume only
- `.planning/phases/25-skip-rasterization-for-born-digital-pdfs-extract-text-layer-/25-CONTEXT.md` — first 3–5 pages sampling + text-first vs vision fallback policy

### Pipeline maps (for integration seams)
- `.planning/codebase/generate-UX.md` — current create flow UX contract + cancel cleanup semantics
- `.planning/codebase/generate-UI.md` — current import layout composition
- `.planning/codebase/generate-backend.md` — ingest → parse → persist boundaries
- `.planning/codebase/WORKFLOW-OCR-AI-QUIZ.md` — parse pipeline map (raster/OCR/vision/mapping/persist)
- `.planning/codebase/INTEGRATIONS.md` — env-gated storage patterns (vision staging)

### Code integration points (must stay consistent)
- `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx` — upload→ingest→inline parse orchestration (primary seam)
- `src/components/upload/UploadBox.tsx` — primary upload surface (must remain local-first)
- `src/components/ai/AiParseSection.tsx` — parse orchestration + persistence + progress reporting
- `src/components/layout/ParseProgressStrip.tsx` — existing strip pattern to extend/align with
- `src/components/ai/ParseProgressContext.tsx` — live progress source of truth

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useParseProgress` + `ParseProgressContext` — already models “live parse running” states.
- `ImportQuizLivePanel` (quiz) and flashcards skeleton — existing “streaming vs skeleton” patterns to reuse for preview-first.
- Mint/Stitch shell patterns — existing top bars/strips that can host a sticky progress strip.

### Established Patterns
- Local-first is default; env-gated optional remote storage exists (see vision staging patterns).
- Cancel in create flow currently resets and deletes the created set to avoid junk.

### Integration Points
- Phase 27 primarily modifies the **timing + UI surfaces** in `NewStudySetPdfImportFlow` / `UploadBox` so parse preview begins immediately while upload continues.

</code_context>

<specifics>
## Specific Ideas

- Preview-first should feel like “AI is working right away” (streaming results), while upload is treated as a background reliability layer.

</specifics>

<deferred>
## Deferred Ideas

- Resume across refresh/reopen (explicitly out per Phase 26 constraint).
- Per-page routing (text page vs bitmap page) belongs to Phase 29.

</deferred>

---

*Phase: 27-preview-first-parsing-while-full-upload-continues*  
*Context gathered: 2026-04-16*

