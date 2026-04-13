# Phase 14 — Plan 01 summary (wave 1)

## Done

- Added `src/lib/ai/mappingQuality.ts`: threshold `0.45`, unresolved / vision-single-page / uncertain predicates, `countUncertainMappings`, tier + tooltip helpers, `appendUncertainMappingSummaryClause` for parse summary.
- Extended `PipelineDomain` with `"MAPPING"` in `pipelineLogger.ts`.
- **`finalizeVisionParseResult`:** `getOcrResult` failures log (`VISION` / `ocr-snapshot`) + `toast.warning`; `applyQuestionPageMapping` failures log (`MAPPING` / `apply`) + `toast.error`, no rethrow; summary + uncertain aggregate (`toast.warning` + clause) after successful `persistQuestions`.
- **`runLayoutChunkPipelineFromPrepared`:** same OCR warning pattern; mapping stays **uncaught** per plan; post-persist uncertain toast + summary append; `setSummary` moved to after persist when not aborted.

## Verification

- `npm run lint` — pass
- `npm run build` — pass
