# Phase 7: Layout-aware chunk-based parsing — Research

**Researched:** 2026-04-11  
**Domain:** Browser AI orchestration (OCR → layout chunks → text MCQ per chunk → optional vision fallback), wall-clock instrumentation, debug UX  
**Confidence:** HIGH for codebase wiring; MEDIUM for cross-browser `performance.now()` edge cases (documented)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked decisions (07-CONTEXT — pipeline, chunking, AI, merge, timing)

- **D-01–D-15:** Layout-aware chunk path from existing OCR; default text-first chunks; vision remains fallback / Accurate; reading order, boundaries, chunk shape, single-MCQ JSON, merge/dedupe/retry/confidence/debug inspector mapping — as in `07-CONTEXT.md`.
- **D-16–D-24:** OCR prerequisite behavior, provider stack (`forwardAiPost` / `parseChunk` pattern), geometry/hints, hybrid threshold, fallback and per-chunk retry — as in `07-CONTEXT.md`.
- **D-25:** Optional fields on `Question` (e.g. `layoutChunkId`, `parseConfidence`, `parseStructureValid`); raw model text **not** on `Question` — debug UI / session / overlay only.
- **D-26:** Chunk → AI output in **expanded OcrInspector** or adjacent debug panel; must not block happy path when closed.
- **D-27:** Measure and show **wall-clock per chunk** for **each text-MCQ AI call on a layout chunk** (monotonic `performance.now()` wrapping `parseChunkSingleMcqOnce` or equivalent). Primary granularity for comparing slow chunks, retries, models.
- **D-28:** Also show **one aggregate** wall-clock for **the whole parse run** from user start until **terminal** state (draft + UI settled / error stop). **Not** required to split OCR / raster / IDB in this lock; can add later.
- **D-29:** Per-chunk duration table lives with debug channel **D-26**; run total **may** sit in main parse summary if kept compact; `pipelineLog` `info` gated per **06-CONTEXT D-05** (`NODE_ENV === "development"` or `NEXT_PUBLIC_D2Q_PIPELINE_DEBUG === "1"`); **no** new IDB schema required unless a later plan opts in.

### the agent's Discretion

- Exact regex lists for Vietnamese/English numbering; tokenizer for dedupe; UI placement of mode toggle (Settings vs parse panel).

### Deferred ideas (OUT OF SCOPE)

- Fine-grained per-step pipeline timing (per-page OCR, rasterize, merge/dedupe alone, IDB) — not locked 2026-04-11; add later if D-27–D-28 insufficient.
- Per-question image crop from bbox; adaptive learning; multi-user cloud — as in `07-CONTEXT.md` **Deferred Ideas**.
</user_constraints>

## Executive summary

- **Chunk path is already wired:** `buildLayoutChunksFromRun` → `runLayoutChunkParse` → `parseChunkSingleMcqOnce` inside `AiParseSection` (`runLayoutChunkPipelineFromPrepared`); vision fallback and hybrid gating match D-16–D-24 in code structure `[VERIFIED: src/components/ai/AiParseSection.tsx, src/lib/ai/runLayoutChunkParse.ts]`.
- **Per-chunk AI time should be measured in `runLayoutChunkParse`** around each `await parse(...)`, not only inside `parseChunkSingleMcqOnce`, so empty chunks (no AI call) and **first + expanded retry** are attributed to the same `layoutChunkId` without mis-attributing orchestration work `[VERIFIED: runLayoutChunkParse loop]`.
- **Extend `ChunkParseResult`** with numeric timing fields (and optionally `rawModelText` only for debug objects, not on `Question`, per D-25); keep types next to `runLayoutChunkParse.ts` unless shared across many files.
- **Run total (D-28):** start `performance.now()` as early as practical after `onBeforeParse` in `runUnifiedParseInternal`, stop in a `finally` (or shared helper) after the chosen handler returns, so Fast / Hybrid / Accurate share one definition of “parse run” `[VERIFIED: AiParseSection runUnifiedParseInternal]`.
- **`pipelineLog` for chunk timings:** use `info` + `isPipelineVerbose()` contract from `pipelineLogger.ts` (same gate as 06-CONTEXT D-05) `[VERIFIED: src/lib/logging/pipelineLogger.ts]`.
- **Debug UI:** keep timings + chunk → model text in **React state** on `StudySetSourcePage` (or a small context), pass into `OcrInspector` via new optional props — satisfies D-25/D-26/D-29 without IDB `[VERIFIED: src/app/(app)/sets/[id]/source/page.tsx]`.
- **Risks:** double-counting if both inner and outer wrap; aborted runs mid-chunk; vision fallback time not part of “chunk” table but **should** be visible in run total or a separate line (product clarity).
- **07-01 vs 07-02:** **07-01** owns chunk engine + `ChunkParseResult` / per-chunk ms + optional `pipelineLog` lines; **07-02** owns orchestration run wall clock, lifting debug payload to parent + OcrInspector / summary row.

## Current architecture (OCR → chunk → AI vs vision)

| Stage | Primary code | Notes |
|--------|----------------|-------|
| PDF → page images | `renderPdfPagesToImages` via `runRenderPagesAndOptionalOcr` | Shared by vision, hybrid, fast paths `[VERIFIED: AiParseSection.tsx]`. |
| OCR | `runOcrSequential` → `putOcrResult` | Optional; failures toast; layout path needs `OcrRunResult` `[VERIFIED: AiParseSection.tsx]`. |
| Layout chunks | `buildLayoutChunksFromRun` | Block sort `(cy,cx)`, question-start regexes, fallback 2–3 blocks `[VERIFIED: layoutChunksFromOcr.ts]`. |
| Text MCQ / chunk | `runLayoutChunkParse` → injected `parse` → `parseChunkSingleMcqOnce` | `MCQ_SINGLE_CHUNK_SYSTEM_PROMPT`; expand + second `parse` on empty output `[VERIFIED: parseChunk.ts, runLayoutChunkParse.ts]`. |
| Vision default / fallback | `runVisionSequential` / `handleVisionParse` | Accurate mode; chunk path calls `runVisionSequentialWithUi` when `needsVisionFallback` `[VERIFIED: AiParseSection.tsx]`. |

`WORKFLOW-OCR-AI-QUIZ.md` still describes **vision-first** history; the repo now includes the layout-chunk branch — treat the markdown as partially stale for UI defaults `[VERIFIED: WORKFLOW-OCR-AI-QUIZ.md vs AiParseSection.tsx]`.

## Instrumentation (D-27, D-28)

### Where to wrap `performance.now()`

| Location | Wrap? | Rationale |
|----------|-------|-----------|
| **`runLayoutChunkParse`** — each `await parse(userContent, signal)` | **Yes (primary)** | One logical “chunk” may invoke `parse` **twice** (initial + expanded retry). D-27 wants visibility into retry vs model slowness: record **each** call duration, expose **sum** per `layoutChunkId` and optionally `attemptsMs: number[]` for the debug table `[VERIFIED: runLayoutChunkParse.ts lines 95–104]`. |
| **`parseChunkSingleMcqOnce`** | Optional / secondary | Measures pure HTTP+JSON path but **loses** association with empty-skip and does not distinguish orchestration-level “chunk row” without extra parameters `[ASSUMED: API ergonomics]`. |
| **Orchestrator (`runLayoutChunkPipelineFromPrepared`)** | **Run-level only** | Chunk loop already centralized in `runLayoutChunkParse`; duplicating per-chunk timers here risks double counting `[VERIFIED: AiParseSection.tsx]`. |

**Monotonic clock:** In browser clients, `performance.now()` is the standard choice for durations (high resolution, monotonic for same-frame timing) `[CITED: https://developer.mozilla.org/en-US/docs/Web/API/Performance/now]`.

### What to add to `ChunkParseResult`

Existing shape `[VERIFIED: src/lib/ai/runLayoutChunkParse.ts]`:

```ts
export type ChunkParseResult = {
  layoutChunkId: string;
  pageIndex: number;
  outcome: ChunkParseOutcome;
  usedExpandedText: boolean;
};
```

**Recommended additions (planner-facing):**

- `chunkAiWallMs: number` — **sum** of all `parse()` wall times for this chunk iteration (initial + expansion retry).
- `parseAttempts: number` — count of `parse()` invocations (0 for empty chunk).
- `attemptWallMs?: number[]` — optional; powers detailed debug rows (D-26/D-29).
- `lastUserContentPreview?: string` — optional truncated string for debug UI only (not persisted to IDB / not on `Question`, D-25).

Do **not** add raw model output to `Question`; pass parallel **session-only** structure keyed by `layoutChunkId` if the UI needs assistant text.

### Run total (D-28)

- **Start:** Immediately after successful `onBeforeParse` inside `runUnifiedParseInternal`, before strategy branch — captures user intent for “this parse click” across Fast / Hybrid / Accurate `[VERIFIED: AiParseSection.tsx ~1465–1570]`.
- **End:** In `finally` of the same outer flow, or immediately before each return path, using `performance.now() - t0`. Include raster + OCR + chunk loop + vision fallback + `attachPageImagesForQuestions` + `persistQuestions` if those run in the same user-triggered parse (matches “terminal UI state” unless product narrows to “AI only” later — **confirm with product** if numbers feel misleading) `[ASSUMED: inclusion boundary for D-28]`.

Expose to UI as e.g. `lastParseRunWallMs` + `lastParseRunAborted` on parent state.

## UI / debug (D-25, D-26, D-29, 06 D-05)

- **No IDB:** Hold `lastChunkDebug: { byChunk: ChunkParseResult[]; rawByChunkId?: Record<string, string> }` and `lastParseRunWallMs` in `StudySetSourcePage` state; update via **`onEmbeddedParseFinished` extended** or a new callback prop from `AiParseSection` when parse completes (success/abort/error) `[VERIFIED: page.tsx uses onEmbeddedParseFinished]`.
- **OcrInspector:** Add optional props e.g. `chunkParseDebug?: …` rendering a **collapsible** section: table `chunk id | attempts | sum ms | ok/error | expanded?`; raw output in `<details>` — default collapsed so happy path unchanged (D-26) `[VERIFIED: OcrInspector.tsx Card-based layout]`.
- **Run total line:** Show under existing `summary` in full `AiParseSection` **or** next to `OcrInspector` title — D-29 allows either; prefer **one line** in parse summary for visibility and **duplicate** in inspector for correlation `[from D-29 text, VERIFIED: 07-CONTEXT.md]`.
- **Logging:** `pipelineLog("VISION", "chunk-timing", "info", …)` or reuse domain already used for layout (`"VISION"`, `"layout-chunk"`) with `{ layoutChunkId, chunkAiWallMs, parseAttempts }` — only emits when `isPipelineVerbose()` per D-05 `[VERIFIED: pipelineLogger.ts]`.

**Extending `PipelineDomain`:** Today only `PDF | OCR | VISION | IDB | STUDY_SET` `[VERIFIED: pipelineLogger.ts]`. Either keep chunk timing under **`VISION`** with a distinct `stage` string, or add e.g. **`PARSE`** in a dedicated task (touches all `pipelineLog` call sites typing) — planner should pick one to avoid ad-hoc `console.log` (06-CONTEXT).

## Risks

| Risk | Mitigation |
|------|------------|
| **Double-counting** | Single measurement layer: **`runLayoutChunkParse` only** for per-chunk; **one** run timer in `runUnifiedParseInternal` (or single helper) for D-28. |
| **Retry semantics** | Document UI: `chunkAiWallMs` = sum of attempts; optional per-attempt column to match D-27 “retry” comparisons. |
| **Abort mid-run** | `AbortSignal` already throws / breaks loops `[VERIFIED: runLayoutChunkParse.ts]`; record `runFinishedReason: "aborted" | "error" | "complete"` and still show partial per-chunk rows + partial run ms. |
| **Vision fallback** | Chunk table excludes vision wall times; run total **includes** fallback vision + merge — add UI note “includes vision fallback” when `needsVisionFallback` `[VERIFIED: runLayoutChunkPipelineFromPrepared]`. |
| **Accurate-only runs** | No chunks — per-chunk table empty; run total still valid (D-28 applies to whole parse). |

## Recommendations: **07-01** vs **07-02** plan split

| Plan | Owns | Types / files |
|------|------|----------------|
| **07-01** | Chunk engine refinements (if any remain), **`ChunkParseResult` extensions**, timing inside **`runLayoutChunkParse`**, optional **`pipelineLog`** lines for chunk timings, unit-level tests for pure functions (`layoutChunksFromOcr`, `computeNeedsVisionFallback`) if added. | `src/lib/ai/runLayoutChunkParse.ts`, `src/lib/ai/layoutChunksFromOcr.ts`, `src/types/ocr.ts` if `LayoutChunk` changes. |
| **07-02** | **`ParseRunResult` or callback extension** to surface timing + debug payload to **`StudySetSourcePage`**, **OcrInspector** props + UI table, run-total line in summary, wire-up `onChunkResult` if live streaming of rows is desired. | `AiParseSection.tsx`, `src/app/(app)/sets/[id]/source/page.tsx`, `OcrInspector.tsx`; optional `src/types/parseDebug.ts` if types are shared. |

**Rule of thumb:** Anything that must stay **pure / testable without React** → **07-01**. Anything **React state / props** → **07-02**.

## Traceability to requirements

| ID | Support |
|----|---------|
| **AI-05** (progress feedback) | Existing progress + proposed run ms line reinforce “what’s happening” `[CITED: .planning/REQUIREMENTS.md]`. |

## Validation architecture

| Property | Value |
|----------|-------|
| Framework | **None in repo** — `package.json` has no `test` script `[VERIFIED: package.json]`. |
| Quick run | `npm run lint` |
| Full suite | Same until Wave 0 adds Vitest/Jest. |

### Wave 0 gaps

- [ ] Add **Vitest** (or project-chosen runner) + `npm run test` for `layoutChunksFromOcr` / `computeNeedsVisionFallback` / timing aggregation pure helpers.
- [ ] Optional Playwright smoke for “parse completes” — out of scope unless Phase 7 verification demands it `[ASSUMED]`.

## Security domain (brief)

| ASVS | Applies | Note |
|------|---------|------|
| V5 Input Validation | yes | MCQ JSON validation already centralized `[VERIFIED: validateQuestions.ts]`; timing fields are numeric bounds-checked in UI display only. |
| V2–V4, V6 | no / minimal | Local-first app; API keys in localStorage per existing design `[CITED: REQUIREMENTS.md AI-01]`. |

## Sources

### Primary (HIGH — codebase)

- `07-CONTEXT.md` — D-16–D-29, deferred, discretion.
- `06-CONTEXT.md` — D-05 `pipelineLog` gating.
- `src/lib/ai/runLayoutChunkParse.ts`, `layoutChunksFromOcr.ts`, `parseChunk.ts`, `AiParseSection.tsx`, `pipelineLogger.ts`, `src/app/(app)/sets/[id]/source/page.tsx`, `OcrInspector.tsx`.

### Secondary (MEDIUM)

- [MDN `performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) — monotonic high-resolution time.

## Assumptions log

| # | Claim | Risk if wrong |
|---|--------|----------------|
| A1 | D-28 run total **includes** raster/OCR/attach/persist in Fast/Hybrid | User expects “AI-only seconds” — copy may need adjustment. |
| A2 | Optional second layer timing inside `parseChunkSingleMcqOnce` is redundant if `runLayoutChunkParse` wraps `parse` | Low — only affects code duplication preference. |

## Open questions

1. **Should `chunkAiWallMs` be sum of attempts or only first attempt?** — D-27 text suggests per AI call awareness; **recommend sum + attempt breakdown** for clarity.
2. **`PipelineDomain` new value vs reusing `VISION`?** — trade typing churn vs log filter clarity; decide in **07-01** plan header.

## Environment availability

**Step 2.6:** SKIPPED for mandatory external CLIs — phase is browser/Next.js; `performance.now()` available in client bundles `[ASSUMED: modern browsers]`.

## Metadata

- **Standard stack:** unchanged Next 15 / React 19 / existing AI forward path `[VERIFIED: package.json]`.
- **Research valid until:** ~2026-05-11 or after major orchestration refactor.

## RESEARCH COMPLETE
