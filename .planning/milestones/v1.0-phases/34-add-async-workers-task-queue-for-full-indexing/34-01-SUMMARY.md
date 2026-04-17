# Phase 34 — Plan 01 summary

**Wave 1 — embedding index job core**

- **`runEmbeddingIndexJob`** (`src/lib/ai/embeddingIndexJob.ts`): bounded worker pool, retries on transient embed errors, `onProgress`, `pipelineLog` events, incompatible model/schema clears IDB before rebuild, skip when build metadata + row count match current text fingerprint.
- **`openAiEmbedding.ts`**: shared `embedText` / `DEFAULT_EMBEDDING_MODEL` to avoid cycles with `buildEmbeddingIndex`.
- **`buildEmbeddingIndexFromPlainText`** delegates to `runEmbeddingIndexJob`; **`searchSimilarChunks`** uses `embedText` from `openAiEmbedding`.
- **IDB** (`embeddingIndexDb.ts` v2): `buildMeta` store + helpers for idempotency.

**Verify:** `npm run lint`, `npm run build`.
