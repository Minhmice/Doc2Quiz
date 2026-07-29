# Phase 34 — Plan 02 summary

**Wave 2 — scheduler + persistence hooks**

- **`embeddingIndexScheduler.ts`**: `EMBEDDING_INDEX_SCHEDULE_DEBOUNCE_MS` (500ms), `scheduleEmbeddingIndexAfterExtract`, `triggerEmbeddingIndexManual`, `cancelEmbeddingIndexForStudySet`, `registerEmbeddingIndexRunner`, `subscribeEmbeddingIndexStatus`, `emitEmbeddingIndexStatus`. Debounced schedule; single-flight via per–`studySetId` `AbortController`; no API keys in module.
- **`studySetDb.ts`**: after successful `putDocument` with non-empty trimmed text, calls `scheduleEmbeddingIndexAfterExtract`. Same after `createStudySet` text-only update path and `createStudySetEarlyMeta` when initial extracted text is non-empty.
- **`AiParseSection.tsx`**: registers runner that loads `getDocument`, calls `runEmbeddingIndexJob` with refs for current forward settings; cleanup cancels schedule + clears registration.

**Verify:** `npm run lint`.
