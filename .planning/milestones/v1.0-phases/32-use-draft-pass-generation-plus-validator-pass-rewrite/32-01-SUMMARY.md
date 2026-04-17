# Phase 32 — Plan 32-01 Summary

**Completed:** 2026-04-18

## Shipped

- **`mcq-extraction.prompts.json`** — Bundle `version` **2**; **`mcqValidator.system`** for Phase 32 validator pass.
- **`mcqExtractionPrompts.ts`** — `MCQ_VALIDATOR_SYSTEM_PROMPT`.
- **`parseCacheTypes.ts`** — Lanes `text_multi_mcq_validator`, `text_single_mcq_validator`; `ParseCacheTextValue.kind` extended.
- **`jsonFromModelText.ts`** — Shared `parseJsonFromModelText` (avoids circular imports).
- **`mcqDraftValidate.ts`** — `ValidatorReasonCode`, `deterministicRepairDraftQuestions`, `needsValidatorLlm` (non-empty → run LLM), `buildValidatorContentFingerprint`, `runValidatorLlmPass` / `runValidatorLlmPassWithRetries`, `validatorPromptIdentity`.
- **`pipelineLogger.ts`** — `PipelineDomain` includes **`PARSE`** for validator logs.
- **`pipelineStageRetry.ts`** — Stage **`llm_validator`** (same policy as `llm_chunk`).

## Verification

- `npm run lint` and `npm run build` (final gate with 32-02/32-03).
