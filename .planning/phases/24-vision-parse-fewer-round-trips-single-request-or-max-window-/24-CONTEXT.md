# Phase 24 — Context

**Gathered:** 2026-04-13  
**Status:** Ready for execute  
**Source:** User intent + `.planning/codebase/ARCHITECTURE.md` (vision deep dive)

## Phase boundary

Deliver **fewer OpenAI-compatible chat completions** for the vision-first path when the user is **not** in “attach page images” mode: prefer **one request containing all page images** up to `VISION_MAX_PAGES_DEFAULT` (20) and JPEG caps, with **automatic downgrade** to multiple batches if the provider rejects payload size, image count, or timeouts.

**Out of scope:** Replacing rasterization (still per-page canvas in `renderPdfPagesToImages`); changing Anthropic-native paths; server-side parse queue (Phase 15 stubs only).

## Locked decisions

1. **Default when safe:** `batchSize = pages.length`, `overlap = 0` for the vision-batch runner when `pages.length <= VISION_MAX_PAGES_DEFAULT` (and optional future `maxImagesPerRequest` constant aligned to provider docs).
2. **Fallback:** If a single batch fails with retryable HTTP/size errors, **split** using deterministic windows (e.g. restore current 10 + overlap 2, or binary split) — no silent data loss; surface `failedBatches` as today.
3. **Provenance:** Prompt + schema must require **explicit page indices** on each quiz/flashcard item when overlap is 0 (no reliance on overlapping windows for disambiguation).
4. **Cache:** `hashVisionBatch` already fingerprints ordered pages + mode; document that **prompt version** bumps may need a cache namespace if prompts change materially (optional small `VISION_PROMPT_VERSION` string in hash — discretion in 24-01 if needed).
5. **Attach mode:** Unchanged — still per-page `runVisionSequential` + `parseVisionPage` when user enables attach (IDB media).

## Canonical references

- `src/lib/ai/runVisionBatchSequential.ts`
- `src/lib/ai/visionBatching.ts`
- `src/lib/ai/visionPrompts.ts`
- `src/lib/pdf/renderPagesToImages.ts` (`VISION_MAX_PAGES_DEFAULT`, etc.)
- `src/components/ai/AiParseSection.tsx` (`handleVisionParse`)
- `src/lib/ai/visionParseCache.ts`

## Claude's discretion

- Exact provider error codes to classify “retry” vs “split batch”.
- Whether to expose a **settings toggle** “Minimize vision API calls (experimental)” vs always-on heuristic.
