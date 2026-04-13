# Phase 19 — Plan 02 summary (wave 2)

## Done

- **`pipelineStageRetry.ts`:** `STAGE_RETRY`, `withRetries`, `sleepMs`; stages `ocr_page`, `llm_chunk`, `llm_vision`, `json_validate`, `idb_put`; mapping documented as no auto-retry.
- **`runOcrSequential.ts`:** per-page `runOcrPage` wrapped in `withRetries("ocr_page", …)`.
- **`parseChunk.ts`:** OpenAI-compatible path only (`resolveOpenAiCompatEndpointAndModel`); removed Anthropic parse branch; `parseChunkOnce` / `parseChunkSingleMcqOnce` use `withRetries("llm_chunk", …)`.
- **`studySetDb.ts`:** `putDraftQuestions` body wrapped with `withRetries("idb_put", …)`.
- **`testConnection.ts`:** `testAiConnection` / `testAiVisionConnection` take `{ baseUrl, apiKey, modelId }`; `defaultForwardEndpointHint` / `defaultForwardModelPlaceholder`.
- **`AiProviderForm.tsx`:** three fields only (base URL, model id, key); no provider tabs; uses forward LS via storage helpers + migration on mount.
- **`aiSettings.ts`:** zod schema for `baseUrl` / `modelId` / `key`.
- **`aiReachability.ts`:** calls new `testAiConnection` shape; custom URL checks use `apiUrl.trim()`.
- **`generateStudySetTitle.ts`:** OpenAI-style path only.
- **`AiParseSection.tsx`:** `readForwardSettings` + `getSurfaceAvailability` / `surfaceBlockReason` + `parseCapabilityUserMessage`; `getForwardOpenAiCompatKind()` for forward provider; vision gating/error copy updated.
- **`parseCapabilityMessages.ts`:** user-facing strings for blocked surfaces.
- **`.planning/codebase/WORKFLOW-OCR-AI-QUIZ.md`:** BYOK 19, capabilities, retries, file table rows.

## Verification

- `npm run build` — pass
- `npm run lint` — pass (warnings only where noted in build output)
