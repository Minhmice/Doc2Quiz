# Phase 32 — Plan 32-03 Summary

**Completed:** 2026-04-18

## Shipped

- **`AiParseSection.tsx`** — `onValidatorStage` with **12s throttle**; **`toast.message("Refining questions…")`** when `usedLlm`; `pipelineLog("PARSE", …)` for debug; wired into **`runSequentialParse`** (all call sites) and **`parseChunkSingleMcqOnce`** (layout chunk parse); file header comment for **DRAFT-32-04** (text/layout vs vision batch).
- **Vision batch** — No code change: parity documented (quiz/flashcard use vision validators, not text MCQ validator LLM).

## Verification

- `npm run lint` and `npm run build`.
