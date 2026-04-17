# Phase 19 — Context (locked decisions)

**Gathered:** 2026-04-11  
**Status:** Ready for planning  
**Roadmap:** Phase 19 — Stage-specific retries, capability matrix, minimal BYOK (3 fields)

## Phase boundary

- **In scope:** (1) Retry / recovery **policy per pipeline stage** — OCR, LLM parse (chunk + vision forward), structural validation of model JSON, page mapping, IndexedDB persistence — each with an explicit policy table (not one shared “retry N times”). (2) **Capability matrix** — which user-visible parse surfaces are allowed vs blocked vs degraded, documented in code + short doc, surfaced in UI **before** run where today errors appear late (e.g. vision + wrong stack). (3) **BYOK simplification** — remove multi-vendor tabs (OpenAI / Anthropic / Custom); persist exactly **three** user inputs for the forward path (OpenAI-compatible chat + vision forward already used by `sameOriginForward`).

- **Out of scope (v1 this phase):** Changing upstream model quality; new providers; automatic capability **probing** beyond optional “Test connection” (matrix may stay **declarative** v1). Phase 18 **parseScore** schema implementation — only **hooks** or comments if needed so retry metadata can align later.

## Decisions

| ID | Decision |
|----|----------|
| D-01 | **Forward-only BYOK:** One logical client configuration: `baseUrl` + `apiKey` + `modelId`. All parse/OCR/vision calls use the existing same-origin forward and OpenAI-shaped payloads where applicable. |
| D-02 | **Migration:** One-time read of legacy `localStorage` keys (`LS_OPENAI_*`, `LS_CUSTOM_*`, `LS_ANTHROPIC_*`, `LS_PROVIDER`) → populate the three forward fields; priority order documented in plan (e.g. custom if base URL set, else openai). Do not silently drop keys until migration runs once; idempotent migration flag. |
| D-03 | **Remove UI vendor split:** Settings and parse UI must not show GPT / Anthropic / Custom as **selectable providers**. Labels may say “API endpoint” / “API key” / “Model id” (exact copy in UI-SPEC / plan). |
| D-04 | **Capability matrix v1:** Rows = discrete **surfaces** (e.g. `text_mcq_parse`, `ocr_page_forward`, `layout_chunk_llm`, `vision_page_multimodal`, `vision_attach`, `idb_draft_write`). Columns = `status: allowed \| blocked` + optional `reasonKey` for i18n-ready strings. v1 matrix is **code-defined** (single forward stack ⇒ most surfaces `allowed` when key+url+model valid; `blocked` only for impossible combos). |
| D-05 | **Stage retry table (normative):** Each stage owns: `maxAttempts`, `backoffMs` (or none), `retryableErrorPredicate`, `onExhausted` (`fail_page` \| `fail_run` \| `toast_and_continue` \| `user_retry`). OCR **per-page** transient network/429 may retry; LLM parse may retry **empty/invalid JSON** once if idempotent; validation **no** automatic network retry (re-prompt is higher layer); mapping **no** throw retry loop (align Phase 14 — log + user message); IDB **quota/transient** bounded retries. |
| D-06 | **Observability:** Each retry branch logs with existing `pipelineLog` + `stage` string; use `PipelineDomain` already present (`OCR`, `VISION`, `MAPPING`, `IDB`, …). No secrets in logs. |
| D-07 | **Types:** Narrow or replace `AiProvider` in `types/question.ts` and downstream imports so the codebase reflects forward-only (alias `type ForwardClient = { baseUrl; apiKey; modelId }` acceptable). |
| D-08 | **Tests:** Prefer unit tests for matrix + retry predicates; smoke `npm run build` each wave. |

## Canonical refs (read before implement)

- `src/lib/ai/storage.ts`, `src/types/question.ts` (LS_* keys, `AiProvider`)
- `src/components/settings/AiProviderForm.tsx`, `src/lib/validations/aiSettings.ts`
- `src/components/ai/AiParseSection.tsx` (vision gating, `forwardProvider`)
- `src/lib/ai/parseChunk.ts` (`resolveChatApiUrl`, Anthropic branch)
- `src/lib/ai/sameOriginForward.ts`, `src/app/api/ai/forward/route.ts` (if present)
- `src/lib/ai/runOcrSequential.ts`, `src/lib/ai/runLayoutChunkParse.ts`, `src/lib/ai/runVisionSequential.ts`
- `src/lib/db/studySetDb.ts` (draft persistence)
- `.planning/codebase/WORKFLOW-OCR-AI-QUIZ.md`
- Phase 14 mapping surfacing: `src/lib/ai/mappingQuality.ts`, `AiParseSection` finalize paths

## Deferred

- Live capability probe (model lists, modality detection).
- Server-side rate limit coordination beyond client backoff.
