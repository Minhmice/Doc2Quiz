# Codebase Concerns

**Analysis Date:** 2026-07-24

## Tech Debt

**Monolithic parse orchestrator (`AiParseSection`):**
- Issue: A single client component (~3,364 lines) owns vision batching, OCR, layout-chunk parsing, embedding-index scheduling, uncertain-parse fallback registration, cache invalidation, and UI state. Changes to any parse lane risk regressions across quiz and flashcard flows.
- Files: `src/components/ai/AiParseSection.tsx`, `src/lib/ai/runVisionBatchSequential.ts`, `src/lib/ai/runOcrSequential.ts`, `src/lib/ai/runLayoutChunkParse.ts`
- Impact: High cognitive load, difficult testing, merge conflicts, and slow onboarding for parse-related work.
- Fix approach: Extract lane-specific hooks/services (vision, OCR, chunk, embedding) behind a thin orchestrator; keep UI state separate from pipeline runners.

**Oversized data-access module (`studySetDb`):**
- Issue: `studySetDb.ts` (~1,116 lines) mixes Supabase CRUD, PDF text extraction, embedding scheduling, schema-compat fallbacks, and parse-progress persistence.
- Files: `src/lib/db/studySetDb.ts`
- Impact: Hard to reason about transaction boundaries and error handling; schema drift workarounds are scattered.
- Fix approach: Split into focused modules (`studySetMetaDb`, `studySetDocumentDb`, `studySetParseProgressDb`) and keep compat shims in one migration helper.

**Legacy routing and URL taxonomy:**
- Issue: Multiple permanent redirects and legacy route pages remain for `/sets/*` and `/new/*` paths; product-surface redirects still branch on `contentKind` undefined (legacy rows).
- Files: `next.config.ts`, `src/app/(app)/sets/**`, `src/lib/routes/studySetPaths.ts`, `src/lib/routing/studySetContentKindRedirects.ts`, `src/hooks/useStudySetProductSurfaceRedirect.ts`
- Impact: Extra maintenance surface; easy to add a link that bypasses canonical URLs.
- Fix approach: Keep redirects until analytics show zero traffic; document canonical paths in `STRUCTURE.md` and grep for `/sets/` in new code.

**Vision batching dual presets:**
- Issue: `min_requests` monolith with automatic fallback to legacy `10+overlap2` windows adds retry complexity and duplicate upstream calls on failure.
- Files: `src/lib/ai/runVisionBatchSequential.ts`, `src/lib/ai/visionBatching.ts`
- Impact: Unpredictable latency and cost when monolith batches fail mid-run.
- Fix approach: Instrument failure reasons; tune batch sizing or make preset selection explicit per document size.

**Deprecated cache/prompt constants still present:**
- Issue: `VISION_BATCH_PROMPT_V` and legacy `provider` fields on parse params are marked deprecated but remain in code paths.
- Files: `src/lib/ai/visionParseCache.ts`, `src/lib/ai/parseChunk.ts`
- Impact: Confusion about which cache-key material is authoritative; stale cache hits after prompt changes if keys are wrong.
- Fix approach: Remove deprecated exports after confirming no external consumers; centralize cache key construction in `parseCacheTypes.ts`.

**BYOK / localStorage migration incomplete:**
- Issue: Forward settings migrated to server env proxy (`/api/ai/forward`), but legacy localStorage keys are copied—not deleted—and OCR key/url/model storage module still exists. `purgeForwardSecretsFromStorageOnce()` runs from `AiParseSection` but OCR keys are not purged.
- Files: `src/lib/ai/forwardSettings.ts`, `src/lib/ai/storage.ts`, `src/lib/ai/ocrStorage.ts`, `src/components/ai/AiParseSection.tsx`
- Impact: Stale secrets may remain in browser storage on shared devices; inconsistent security posture vs server-side AI config.
- Fix approach: Extend purge to OCR keys; delete legacy keys after migration; remove unused `ocrStorage.ts` if OCR always routes through forward proxy.

**Dead / orphaned local-first artifacts:**
- Issue: `loadApprovedBank()` in `approvedBank.ts` has no callers; README still describes “local-first JSON” question banks while runtime persistence is Supabase-first.
- Files: `src/lib/review/approvedBank.ts`, `README.md`, `src/lib/db/studySetDb.ts`
- Impact: Documentation misleads contributors; dead code may be revived accidentally.
- Fix approach: Remove unused localStorage bank helpers or wire explicit offline export; update `README.md` to match cloud-first architecture.

**Archived legacy components still in tree:**
- Issue: `src/components-legacy/` holds unused components committed alongside active code.
- Files: `src/components-legacy/LEGACY_COMPONENTS.md`, `src/components-legacy/**`
- Impact: Repo noise; risk of accidental imports.
- Fix approach: Delete archived files or move to a separate examples package; enforce via lint import restrictions.

**Parse job queue stub:**
- Issue: Server parse queue API returns `501 not_implemented`; worker not wired despite phase planning for async indexing.
- Files: `src/app/api/parse-jobs/route.ts`, `src/app/api/parse-jobs/[id]/route.ts`, `src/lib/serverParse/env.ts`
- Impact: Long-running parses remain client-bound; tab close aborts work.
- Fix approach: Implement queue worker before enabling `D2Q_SERVER_PARSE_ENABLED`; add auth and rate limits first (see Security).

**Uncertain-parse fallback v1 stub:**
- Issue: Registry and logging exist; full second-pass runner described as “wired later.”
- Files: `src/lib/ai/uncertainParseFallback.ts`, `src/components/ai/AiParseSection.tsx`
- Impact: Low-quality parses may not auto-refine despite signals firing.
- Fix approach: Implement runner or gate UI messaging so users know refinement is manual.

**Committed tooling cache (`graphify-out/`):**
- Issue: Large JSON cache artifacts and benchmark output are tracked in git.
- Files: `graphify-out/cache/*.json`, `graphify-out/GRAPH_REPORT.md`, `graphify-out/benchmark.txt`
- Impact: Bloated clones, noisy diffs, potential stale analysis misleading planners.
- Fix approach: Add `graphify-out/` to `.gitignore`; store reports in CI artifacts or `.planning/` summaries only.

**Duplicate animation dependency:**
- Issue: Both `framer-motion` and `motion` are declared; only `framer-motion` is imported in `src/`.
- Files: `package.json`, `src/components/ui/vertical-cut-reveal.tsx`, `src/components/dashboard/DashboardHero.tsx`
- Impact: Unnecessary install size and version drift risk.
- Fix approach: Remove unused `motion` package.

**Schema-compat fallbacks in DB layer:**
- Issue: `isMissingParseProgressColumnError()` branches around optional `parse_progress` column for pre-migration databases.
- Files: `src/lib/db/studySetDb.ts`, `supabase/migrations/20260418_000002_add_study_set_parse_progress.sql`
- Impact: Masks deployment ordering bugs; dual code paths to test.
- Fix approach: Require migration applied in all environments; remove fallback after migration window.

## Known Bugs

**No tracked in-code TODO/FIXME markers:**
- Symptoms: Grep across `src/` finds no `TODO`, `FIXME`, or `HACK` comments; issues are implicit in stubs and comments instead.
- Files: `src/app/api/parse-jobs/route.ts` (explicit “add auth + rate limiting” note)
- Trigger: Enabling `D2Q_SERVER_PARSE_ENABLED=true` exposes unauthenticated queue endpoints.
- Workaround: Keep `D2Q_SERVER_PARSE_ENABLED` unset in production.

**Vision staging in-memory store on serverless:**
- Symptoms: When `BLOB_READ_WRITE_TOKEN` is unset, staged images live in a process-local `Map` (`MAX_ENTRIES=80`, `TTL_MS=10min`). On multi-instance or cold-start serverless, POST and GET may hit different instances → 404 on fetch.
- Files: `src/lib/ai/visionStagingStore.ts`, `src/app/api/ai/vision-staging/route.ts`, `src/app/api/ai/vision-staging/[id]/route.ts`
- Trigger: Dev/staging without Vercel Blob configured.
- Workaround: Set `BLOB_READ_WRITE_TOKEN` or prefer inline data URLs in dev (see `parseVisionPage.ts` comment).

## Security Considerations

**Unauthenticated vision-staging upload/read:**
- Risk: `POST /api/ai/vision-staging` accepts base64 images up to 12 MiB per image (batch up to 20) with no auth. Blob uploads use `access: "public"`. Enables storage/bandwidth abuse and public exposure of user document page images.
- Files: `src/app/api/ai/vision-staging/route.ts`, `src/app/api/ai/vision-staging/[id]/route.ts`, `src/lib/ai/visionStagingStore.ts`
- Current mitigation: UUID validation, size caps, TTL, `Cache-Control: private, no-store` on API responses.
- Recommendations: Require Supabase session; use private blobs with signed URLs; tie staging IDs to user/session; add rate limiting.

**PDF upload API lacks user binding:**
- Risk: `init`, `part`, `complete`, and `abort` routes do not call `supabase.auth.getUser()`. Anyone who obtains a finalize token can complete an upload for a pre-issued `uploadId`.
- Files: `src/app/api/uploads/pdf/init/route.ts`, `src/app/api/uploads/pdf/part/route.ts`, `src/app/api/uploads/pdf/complete/route.ts`, `src/lib/uploads/pdfUploadFinalizeToken.ts`
- Current mitigation: HMAC finalize token, key prefix allowlist, content-type and size validation, session TTL.
- Recommendations: Bind `uploadId` to authenticated `user_id` at init; reject cross-user finalize.

**AI forward proxy — authenticated but unquota’d:**
- Risk: Any logged-in user can POST arbitrary chat completion bodies through `/api/ai/forward`, consuming server `AI_PROVIDER_KEY` credits. Default `max_tokens` injection is 16,384 (`DEFAULT_OPENAI_CHAT_MAX_TOKENS`).
- Files: `src/app/api/ai/forward/route.ts`, `src/lib/server/ai-processing-config.ts`, `src/lib/server/resolveUserAiTier.ts`
- Current mitigation: Auth required; upstream URL restricted to HTTPS (or localhost HTTP); tier-based model selection via env allowlist `AI_PRO_USER_IDS`.
- Recommendations: Per-user rate limits, request size caps, token budgets, audit logging; billing-backed tier resolution.

**Parse-jobs endpoints (when enabled):**
- Risk: Explicit comment: no auth or rate limiting. Returns stub responses but still parses JSON bodies.
- Files: `src/app/api/parse-jobs/route.ts`, `src/app/api/parse-jobs/[id]/route.ts`
- Current mitigation: Disabled unless `D2Q_SERVER_PARSE_ENABLED` is set; returns 404 when off.
- Recommendations: Add `getUser()` guard and rate limiting before any production enablement.

**Public vision test image endpoint:**
- Risk: `GET /api/ai/vision-test-image` serves a PNG with `Cache-Control: public, max-age=86400` and no auth.
- Files: `src/app/api/ai/vision-test-image/route.ts`
- Current mitigation: Static test asset only.
- Recommendations: Restrict to development or gate behind auth if used in production diagnostics.

**Develop mock route env bypass:**
- Risk: `ALLOW_DEVELOP_MOCKS=1` enables `/api/develop/mock/[slug]` outside `NODE_ENV=development`.
- Files: `src/app/api/develop/mock/[slug]/route.ts`, `src/lib/develop/mockAllowlist.ts`
- Current mitigation: Slug allowlist and path traversal checks.
- Recommendations: Never set `ALLOW_DEVELOP_MOCKS` in production deployments.

**Dev OCR lab production flag:**
- Risk: `NEXT_PUBLIC_ENABLE_DEV_OCR_LAB=true` exposes `/dev/ocr` routes in production builds.
- Files: `src/app/(app)/dev/ocr/layout.tsx`
- Current mitigation: Defaults to hidden in production.
- Recommendations: Treat flag as break-glass only; remove from production env templates.

**Sentry PII scrubbing not implemented:**
- Risk: `beforeSend` is a pass-through; comment says “Strip PII / secrets in 13-02+”.
- Files: `sentry.client.config.ts`, `sentry.server.config.ts`
- Current mitigation: Sentry disabled when `NEXT_PUBLIC_SENTRY_DSN` unset; `tracesSampleRate: 0`.
- Recommendations: Implement `beforeSend` scrubbing for Authorization headers, document text, and API error bodies before enabling in production.

**OCR API keys in localStorage (latent):**
- Risk: `ocrStorage.ts` still defines `getOcrKey` / `setOcrKey` for per-device secrets.
- Files: `src/lib/ai/ocrStorage.ts`
- Current mitigation: No active imports of `getOcrKey` in `src/` (OCR uses `forwardAiPost` via `ocrAdapter.ts`).
- Recommendations: Delete module or migrate to server proxy pattern matching forward route.

**Middleware does not enforce auth on API routes:**
- Risk: `middleware.ts` only refreshes Supabase session; API routes must self-guard. Several do not.
- Files: `src/middleware.ts`, `src/lib/supabase/middlewareClient.ts`
- Current mitigation: `(app)` layout uses `requireUser()` for UI routes.
- Recommendations: Audit all `src/app/api/**/route.ts` for consistent `getUser()` checks.

## Performance Bottlenecks

**Client-side PDF parse pipeline:**
- Problem: Full vision/OCR/layout parsing runs in the browser tab; large PDFs render page images on main thread paths with worker offload only for JPEG encode.
- Files: `src/components/ai/AiParseSection.tsx`, `src/lib/pdf/renderPagesToImages.ts`, `src/lib/pdf/imagePreprocess/encodeJpegInWorker.ts`
- Cause: No server worker queue (stub); sequential vision batches can run 100–125s per upstream call for multi-page JPEG payloads (`visionBatching.ts` comment).
- Improvement path: Enable server parse queue; stream progress; cap concurrent upstream calls; move heavy rasterization off main thread.

**10 MiB PDF cap:**
- Problem: `MAX_PDF_BYTES = 10 * 1024 * 1024` rejects larger documents client-side.
- Files: `src/lib/pdf/validatePdfFile.ts`, `src/lib/uploads/pdfUploadContracts.ts`
- Cause: Deliberate v1 limit for client memory and upload time.
- Improvement path: Server-side chunked ingestion with higher limits for direct-upload mode.

**IndexedDB parse cache growth:**
- Problem: Up to 400 entries × ~15 MiB per store (vision + text) per browser profile.
- Files: `src/lib/db/parseCacheDb.ts`, `src/lib/ai/visionParseCache.ts`
- Cause: LRU eviction is per-store but still substantial on low-memory devices.
- Improvement path: Lower caps on mobile; surface cache clear in settings; sync cache invalidation on prompt version bump.

**Client-side embedding index builds:**
- Problem: `embeddingIndexScheduler.ts` runs full-document embedding jobs from the UI thread context (registered by `AiParseSection`).
- Files: `src/lib/ai/embeddingIndexScheduler.ts`, `src/lib/ai/embeddingIndexJob.ts`, `src/lib/db/embeddingIndexDb.ts`
- Cause: Phase 34 design defers server worker.
- Improvement path: Move to background worker or server queue; debounce already exists (`EMBEDDING_INDEX_SCHEDULE_DEBOUNCE_MS = 500`).

**Forward route upstream proxy latency:**
- Problem: Server forwards full upstream response body as text buffer; no streaming to client.
- Files: `src/app/api/ai/forward/route.ts`
- Cause: Simplicity of proxy implementation.
- Improvement path: Stream SSE/chunked responses for long completions.

## Fragile Areas

**`runVisionBatchSequential` fallback chain:**
- Files: `src/lib/ai/runVisionBatchSequential.ts`
- Why fragile: Combines cache read/write, batch planning, legacy fallback, rate-limit error handling, and progress callbacks in one ~688-line module.
- Safe modification: Add integration tests around batch failure → legacy fallback; avoid changing cache key parts without bumping `PROMPTS_BUNDLE_VERSION`.
- Test coverage: None (see Test Coverage Gaps).

**`studySetDb` migration-compat branches:**
- Files: `src/lib/db/studySetDb.ts`
- Why fragile: Insert/select paths differ when `parse_progress` column missing; errors detected by string matching on Postgres messages.
- Safe modification: Run migrations in all envs first; add DB integration test for insert + parse progress round-trip.
- Test coverage: None.

**`QuizSession` (~939 lines):**
- Files: `src/components/quiz/QuizSession.tsx`
- Why fragile: Session state, keyboard handling, image blobs from IndexedDB, and scoring in one component.
- Safe modification: Extract keyboard hook and session reducer; test scoring edge cases.
- Test coverage: None.

**PDF upload finalize token flow:**
- Files: `src/lib/uploads/pdfUploadFinalizeToken.ts`, `src/app/api/uploads/pdf/complete/route.ts`, `src/lib/uploads/runPdfUploadSession.ts`
- Why fragile: Clock skew, expired sessions, and part etag validation must align across client and three API routes.
- Safe modification: Extend `scripts/verify-*` with upload session contract tests.
- Test coverage: Manual only via upload UI.

**Animate UI icon primitives:**
- Files: `src/components/animate-ui/icons/icon.tsx`
- Why fragile: Multiple `eslint-disable` for hooks rules and `any` types; non-standard hook usage.
- Safe modification: Treat as vendored code; minimize edits; upgrade via upstream package if available.
- Test coverage: None.

## Scaling Limits

**Server AI proxy (single provider key):**
- Current capacity: One `AI_PROVIDER_KEY` shared by all authenticated users; tier split via env list and JWT metadata.
- Limit: Cost explosion and upstream rate limits under concurrent parses.
- Scaling path: Per-tenant keys, queue-based workers, caching (`generation_output_cache`, `canonical_document_extractions` tables in Supabase).

**Vision staging (in-memory fallback):**
- Current capacity: 80 entries × up to 12 MiB ≈ potentially ~960 MiB per Node process (theoretical max before eviction).
- Limit: OOM on serverless; non-shared state across instances.
- Scaling path: Require Vercel Blob in all deployed environments; delete in-memory store in production.

**Supabase RLS (well-covered but storage-coupled):**
- Current capacity: Per-user isolation on `study_sets`, documents, media, OCR, approved items, quiz sessions.
- Limit: Storage policies assume `doc2quiz` bucket layout; mis-keyed `object_path` breaks access.
- Scaling path: Document bucket conventions in migrations; add storage integration tests.

**Browser IndexedDB:**
- Current capacity: Study-set data in Supabase; local IDB for parse cache and embedding index only.
- Limit: Quota errors on Safari/private mode; `openParseCacheDb` returns `null` silently.
- Scaling path: Handle `null` DB with user-visible warning; degrade without cache.

## Dependencies at Risk

**`pdfjs-dist` + Next bundling:**
- Risk: Requires `serverExternalPackages: ["pdfjs-dist"]` and postinstall worker copy script.
- Impact: Breaks on major pdfjs upgrades or ESM/CJS mismatch.
- Migration plan: Pin version; run PDF smoke test after upgrades; see `scripts/copy-pdf-worker.mjs`.

**`zod` v4:**
- Risk: Project uses `zod@^4.4.3` while ecosystem often still on v3.
- Impact: Schema/API differences when copying examples from docs.
- Migration plan: Document v4 patterns in `CONVENTIONS.md`; avoid mixing v3 snippets.

**Dual `framer-motion` / `motion` packages:**
- Risk: Redundant dependencies in `package.json`.
- Impact: Bundle bloat if both get imported later.
- Migration plan: Remove `motion` if unused.

## Missing Critical Features

**Automated test suite:**
- Problem: Zero `*.test.ts` / `*.spec.ts` files; only manual `scripts/verify-import-validate.ts` and `scripts/verify-study-set-redirects.ts`.
- Blocks: Safe refactoring of parse pipeline, API auth changes, and DB layer splits.

**CI pipeline:**
- Problem: No `.github/workflows` detected.
- Blocks: Lint/test gates on PRs; migration verification.

**Server-side parse worker:**
- Problem: `parse-jobs` returns `501`; parsing remains client-tab-bound.
- Blocks: Reliable long-document processing and mobile background parse.

**Production-grade AI billing / quotas:**
- Problem: `resolveUserAiTier` uses env CSV `AI_PRO_USER_IDS` and JWT metadata hacks.
- Blocks: Fair usage enforcement and monetization.

## Test Coverage Gaps

**Vision parse pipeline:**
- What's not tested: Batch planning, legacy fallback, cache key stability, dedupe across overlap windows.
- Files: `src/lib/ai/runVisionBatchSequential.ts`, `src/lib/ai/visionBatching.ts`, `src/lib/ai/visionParseCache.ts`
- Risk: Silent quality regressions and cache poisoning after prompt changes.
- Priority: High

**MCQ draft → validator loop:**
- What's not tested: `parseChunkOnce`, `mcqDraftValidate`, validator reason codes.
- Files: `src/lib/ai/parseChunk.ts`, `src/lib/ai/mcqDraftValidate.ts`
- Risk: Invalid MCQs reach review UI.
- Priority: High

**Strict generation validators (partial smoke only):**
- What's not tested: Only happy-path and two failure cases in `scripts/verify-import-validate.ts`; no flashcard duplicate/stem edge cases beyond one good row.
- Files: `src/lib/server/generateFromFile/validateStrictGenerated.ts`, `scripts/verify-import-validate.ts`
- Risk: `generate-from-file` route ships bad items to Supabase.
- Priority: Medium

**PDF upload finalize contract:**
- What's not tested: Token expiry, session mismatch, multipart completion.
- Files: `src/app/api/uploads/pdf/*.ts`, `src/lib/uploads/pdfUploadFinalizeToken.ts`
- Risk: Orphan objects in storage or failed uploads with poor error messages.
- Priority: Medium

**Auth guards on API routes:**
- What's not tested: Matrix of which routes require auth vs not.
- Files: `src/app/api/**/route.ts`
- Risk: Accidental exposure when adding new endpoints.
- Priority: High

**Supabase RLS policies:**
- What's not tested: Cross-user access attempts on `study_sets`, `media_assets`, storage objects.
- Files: `supabase/migrations/20260418_000001_doc2quiz_cloud_first.sql`
- Risk: Data leak if policy typo introduced in new migration.
- Priority: High

---

*Concerns audit: 2026-07-24*
