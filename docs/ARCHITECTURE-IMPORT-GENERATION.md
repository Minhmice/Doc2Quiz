# Import / generation architecture (canonical-only)

This document describes **what the repository actually implements** as of the canonical reconciliation work.

## Pipeline (all tiers)

Same steps for **free**, **pro**, and **admin**. The only tier difference is **which resolved model id** is used (`AI_MODEL_FREE` vs `AI_MODEL_PRO` via `getAiProcessingConfig(resolveUserAiTier(user))`).

1. Upload PDF → stored as `media_assets`; client sends `fileRef` matching `study_set_documents.source_pdf_asset_id`.
2. Resolve **`contentSha256`** (`resolveStudySetContentSha256`: prefers asset hash, else normalized text).
3. Read **`extracted_text`** from `study_set_documents` (must meet minimum length).
4. **Canonical extraction**: load **`canonical_document_extractions`** cache (`getCachedCanonicalUnits`) or LLM **`extractCanonicalSourceUnits`** → **`upsertCanonicalUnitsCache`**.
5. **Generation output cache** (`generation_output_cache`): key from  
   `computeGenerationOutputCacheKey(contentSha256, contentKind, generationSchemaVersion, modelFingerprint, targetItemCount)`.  
   Server-side queries always scope by **`user_id`** + **`cache_key`** (see `generationOutputCache.ts`).
6. **Generate** only via **`runGenerateItemsFromCanonicalUnits`** (quiz or flashcards from **`CanonicalSourceUnits`**). No raw-text-to-items path.
7. **Strict validation** (`validateStrictQuizQuestions` / `validateStrictFlashcards`): every item must have **`sourceUnitIds` with length ≥ 1**.
8. Persist draft rows (`persistQuizDraft` / `persistFlashcardDraft`), update **`study_set_documents`** (canonical units, **`generation_coverage`**, **`last_generation_seed`**, **`generation_schema_version`**, **`canonical_model_fingerprint`**), set **`study_sets.status = "draft"`**.

## Determinism & metadata

- Chat completion uses **temperature `0`** inside the generation runner.
- **`deriveGenerationSeed(contentSha256, contentKind, schemaVersion, targetItemCount)`**; stored as **`last_generation_seed`** on the document row.
- **`canonical_model_fingerprint`**: `sha256Utf8HexSync(resolved model id)` — not the raw env string in API responses.
- Schema constants: **`EXTRACTION_SCHEMA_VERSION`**, **`GENERATION_SCHEMA_VERSION`** (`canonicalConstants.ts`).
- **`generation_coverage`**: merges model coverage with **`extractionCacheHit`**, **`generationCacheHit`**, **`coverageRatio`**, **`itemsGenerated`**, **`lowConfidenceCount`**.

## Removed / absent paths

- **`runGenerateFromFileModel`** — file removed; **no imports** remain.
- **Pro “direct”** pipeline branch — removed from **`generate-from-file`**; there is no parallel “text → items” tier path.

## Developer debug endpoint

`GET /api/study-sets/[id]/generation-debug` is enabled only when **`NODE_ENV !== "production"`** and **`isDevEnginePanelEnabled()`**. It returns **`contentSha256`**, **`canonicalUnitCount`**, **`extractionCacheHit`**, **`generationCacheHit`**, **`generatedItemCount`**, **`coverageRatio`**, **`generationSeed`**, **`modelFingerprint`**, and schema versions. It does **not** return raw model names, URLs, or API keys.

## Supabase migrations (authoritative list)

| File | Purpose |
|------|---------|
| `supabase/migrations/20260418_000001_doc2quiz_cloud_first.sql` | Core cloud-first schema |
| `supabase/migrations/20260418_000002_add_study_set_parse_progress.sql` | Parse progress columns |
| `supabase/migrations/20260418_000003_create_storage_bucket_doc2quiz.sql` | Storage bucket |
| `supabase/migrations/20260430120000_canonical_document_extractions.sql` | Canonical extraction cache table |
| `supabase/migrations/20260430150000_generation_output_cache.sql` | **`generation_output_cache`** table + RLS |

## `generation_output_cache` usage

The table exists and is **read** in **`getCachedGenerationOutput`** and **written** in **`upsertGenerationOutputCache`** from **`generate-from-file/route.ts`** after a successful generation (cache miss path). Payload stores generated items, coverage, warnings, **`lowConfidenceCount`**, **`generationSeed`**, and schema version inside JSONB **`payload`**. Row **`created_at`** is automatic (`default now()`).
