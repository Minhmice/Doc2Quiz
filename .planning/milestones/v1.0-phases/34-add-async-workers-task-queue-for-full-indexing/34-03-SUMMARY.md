# Phase 34 — Plan 03 summary

**Wave 3 — RAG panel UX**

- **`subscribeEmbeddingIndexStatus`** drives `embeddingIndexStatus` state in **`AiParseSection`**; passed to **`RagChunkSearchPanel`** with `onCancelIndexing` and `onManualBuildIndex` (`triggerEmbeddingIndexManual`).
- **`RagChunkSearchPanel`**: shows indexing progress (`Indexing: i/n`), **Cancel** while running, **Last error** on failure, manual **Build embedding index** uses the same scheduler path as auto-index (no duplicate local embed loop).

**Verify:** `npm run lint`, `npm run build` (both exit 0).
