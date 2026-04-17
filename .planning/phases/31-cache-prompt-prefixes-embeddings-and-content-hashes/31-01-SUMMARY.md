# Phase 31 — Plan 31-01 Summary

**Completed:** 2026-04-18

## Shipped

- **`src/lib/ai/parseCacheTypes.ts`** — `ParseCacheLane`, `ParseCacheKeyParts`, `ParseCacheRecordMeta`, stored payload unions for vision vs text lanes.
- **`src/lib/db/parseCacheDb.ts`** — IndexedDB `doc2quiz-parse-cache` v1, stores `vision_batch` and `text_chunk`; canonical key SHA-256 over ordered `ParseCacheKeyParts` JSON; get/set with touch on read; LRU eviction (400 entries, ~15 MiB estimated payload per store); warn-only error handling.
- **`src/lib/ai/prompts/mcqExtractionPrompts.ts`** — `PROMPTS_BUNDLE_VERSION`, `hashPromptIdentity`, `formatPromptKeyComponent`.

## Verification

- `npm run lint` and `npm run build` (with full phase 31 integration in same session).

## Notes

- `mcq-extraction.prompts.json` **version** unchanged (no prompt text edits in this change set).
