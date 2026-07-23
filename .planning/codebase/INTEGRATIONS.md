# External Integrations

**Analysis Date:** 2026-07-24

## APIs & External Services

**AI — OpenAI-compatible HTTP (server-configured):**

- **Purpose:** Document extraction, MCQ/flashcard generation, embeddings, vision page parsing, title generation
- **Client:** No vendor SDK; native `fetch` from Route Handlers and server modules
- **Config:** `src/lib/server/ai-processing-config.ts` reads `AI_PROVIDER_URL`, `AI_PROVIDER_KEY`, `AI_MODEL_FREE`, `AI_MODEL_PRO`, optional `AI_EMBEDDING_MODEL`, `DOC_PROCESSING_MODE`
- **Auth:** `Authorization: Bearer ${AI_PROVIDER_KEY}` on upstream requests
- **Default models:** `mineru25` (free tier), `gpt-4.1-mini` (pro tier) when env vars unset
- **Tier routing:** `src/lib/server/resolveUserAiTier.ts` — `AI_PRO_USER_IDS` CSV, `user.app_metadata.doc2quiz_ai_tier`, `user.app_metadata.role === "admin"`, or `user.user_metadata.doc2quiz_ai_tier`
- **Same-origin proxy routes (authenticated Supabase user required):**
  - `POST /api/ai/forward` — chat completions and models probe (`src/app/api/ai/forward/route.ts`)
  - `POST /api/ai/embed` — embeddings (`src/app/api/ai/embed/route.ts`)
- **Direct server calls:** `src/lib/server/openAiChatCompletion.ts` used by canonical extraction/generation (`src/lib/server/generateFromFile/**`)
- **URL policy:** HTTPS only; HTTP allowed for `localhost` / `127.0.0.1` (`isAllowedTargetUrl` in forward/embed routes)
- **UX status (no secrets):** `GET /api/ai/processing-status` (`src/app/api/ai/processing-status/route.ts`)

**Vision image staging:**

- **Purpose:** Convert client-rendered PDF page `data:` URLs into fetchable HTTPS URLs for multimodal upstream calls
- **Route:** `POST /api/ai/vision-staging`, `GET /api/ai/vision-staging/[id]` (`src/app/api/ai/vision-staging/**`)
- **Client helper:** `src/lib/ai/stageVisionDataUrl.ts`
- **Fallback:** In-memory store (`src/lib/ai/visionStagingStore.ts`, ~10 min TTL) when Blob token unset
- **Note:** Vision staging POST is currently **unauthenticated**; size-capped only (~12 MB decoded)

**Developer / debug surfaces (gated):**

- `GET|POST /api/ai/dev-engine-panel` — when `ENABLE_DEV_ENGINE_PANEL=true` and not production (`src/app/api/ai/dev-engine-panel/route.ts`)
- `GET /api/develop/mock/[slug]` — when `NODE_ENV === "development"` or `ALLOW_DEVELOP_MOCKS=1`
- `GET /api/study-sets/[id]/generation-debug` — dev-only generation fingerprints (`src/app/api/study-sets/[id]/generation-debug/route.ts`)

## Data Storage

**Databases:**

- **Supabase Postgres** (hosted)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` (public), authenticated via anon key + user session
  - Client: `@supabase/supabase-js` via `@supabase/ssr` wrappers (`src/lib/supabase/server.ts`, `browser.ts`, `middlewareClient.ts`)
  - Schema: `supabase/migrations/*.sql` — `study_sets`, `study_set_documents`, `media_assets`, `canonical_document_extractions`, `generation_output_cache`, parse progress, RLS on `auth.users`
  - **No service-role key** referenced in application code; all access is user-scoped through anon key + RLS

**File Storage:**

- **Supabase Storage** — private bucket `doc2quiz` (`supabase/migrations/20260418_000003_create_storage_bucket_doc2quiz.sql`)
  - Upload API: `/api/uploads/pdf/init`, `part`, `complete`, `abort` (`src/app/api/uploads/pdf/**`)
  - Client upload orchestration: `src/lib/uploads/runPdfUploadSession.ts`, `src/lib/uploads/pdfUploadClient.ts`
  - Direct reads/writes in app code: `src/lib/db/studySetDb.ts`, `src/lib/ai/ocrDb.ts`, `src/lib/server/generateFromFile/resolveContentSha256.ts`
- **Vercel Blob** (optional) — public staging URLs for vision images when `BLOB_READ_WRITE_TOKEN` is set (`@vercel/blob` `put` / `head` in vision-staging routes)
- **Browser IndexedDB** — local-first hybrid caches and legacy stores:
  - `src/lib/db/studySetDb.ts`, `src/lib/db/parseCacheDb.ts`, `src/lib/db/embeddingIndexDb.ts`
  - Parse settings/history: `src/lib/ai/parseLocalStorage.ts`, `src/lib/ai/ocrStorage.ts`, `src/lib/review/approvedBank.ts`

**Caching:**

- **Postgres tables:** `canonical_document_extractions`, `generation_output_cache` (server-side dedup by content hash + schema version)
- **In-memory:** Vision staging fallback (`visionStagingStore.ts`)
- **IndexedDB:** Vision parse batch cache (`src/lib/ai/visionParseCache.ts`), embedding index jobs (`src/lib/ai/embeddingIndexJob.ts`)
- **CDN / edge:** Long-cache headers for `/_next/static/*` in `next.config.ts`; no separate Redis or CDN SDK

## Authentication & Identity

**Auth Provider:**

- **Supabase Auth** (email/password)
  - Implementation: `src/middleware.ts` refreshes session cookies via `updateSession` (`src/lib/supabase/middlewareClient.ts`)
  - Server guard: `requireUser()` in `src/lib/supabase/auth-guard.ts` redirects unauthenticated users to `/login`
  - Setup notes: `supabase/EMAIL_AUTH_SETUP.md` (confirm-email disabled for MVP flow)
  - API routes check `supabase.auth.getUser()` and return `401` when absent (e.g. `/api/ai/forward`, `/api/ai/embed`, `/api/ai/processing-status`)

**Legacy client key storage (purged on load):**

- `src/lib/ai/forwardSettings.ts` still defines localStorage keys for historical BYOK migration, but `purgeForwardSecretsFromStorageOnce()` clears secrets on app load (`src/components/ai/AiParseSection.tsx`); **active AI calls use server env only** via `src/lib/ai/sameOriginForward.ts`

## Monitoring & Observability

**Error Tracking:**

- **Sentry** (`@sentry/nextjs`) — optional, disabled when DSN unset
  - Server: `SENTRY_DSN` → `sentry.server.config.ts` (loaded from `instrumentation.ts`)
  - Client: `NEXT_PUBLIC_SENTRY_DSN` → `sentry.client.config.ts`
  - Pipeline errors: `src/lib/observability/reportPipelineError.ts` (scrubs PII; `tracesSampleRate: 0`)
  - `next.config.ts` is **not** wrapped with `withSentryConfig` (no source-map upload token required for local builds)

**Logs:**

- **Console via `pipelineLog`** — `src/lib/logging/pipelineLogger.ts`
  - `info` gated to development or `NEXT_PUBLIC_D2Q_PIPELINE_DEBUG=1`
  - `warn` / `error` always emitted

## CI/CD & Deployment

**Hosting:**

- **Vercel** (documented in `README.md` for Blob storage and production deploys)
- **Supabase** (hosted Postgres + Auth + Storage)

**CI Pipeline:**

- **Not detected** — no `.github/workflows/` or other CI config in repo

## Environment Configuration

**Required env vars:**

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key for client + server user-scoped access |
| `AI_PROVIDER_URL` | Server | OpenAI-compatible base URL for chat/embeddings |
| `AI_PROVIDER_KEY` | Server | Bearer token for AI upstream |

**Optional env vars:**

| Variable | Purpose |
|----------|---------|
| `AI_MODEL_FREE` / `AI_MODEL_PRO` | Per-tier model IDs (defaults: `mineru25`, `gpt-4.1-mini`) |
| `AI_EMBEDDING_MODEL` | Embeddings model (default `text-embedding-3-small`) |
| `AI_PRO_USER_IDS` | Comma-separated Supabase user IDs for pro tier |
| `DOC_PROCESSING_MODE` | Document processing mode string (default `auto`) |
| `ENABLE_DEV_ENGINE_PANEL` | `true` enables dev AI panel routes |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for vision staging |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry error reporting |
| `NEXT_PUBLIC_D2Q_PIPELINE_DEBUG` | `1` enables verbose pipeline `info` logs |
| `NEXT_PUBLIC_ENABLE_DEV_OCR_LAB` | `true` allows `/dev/ocr` in production |
| `ALLOW_DEVELOP_MOCKS` | `1` enables develop mock API outside dev |
| `D2Q_OBJECT_STORAGE_ENABLED` | Enables direct-upload capability probe |
| `D2Q_OBJECT_STORAGE_ADAPTER_READY` | Second gate for working presign/finalize path |
| `D2Q_PDF_UPLOAD_FINALIZE_SECRET` | HMAC secret for PDF upload finalize tokens |
| `D2Q_SERVER_PARSE_ENABLED` | `1` or `true` exposes parse-job stub API (`src/lib/serverParse/env.ts`) |

**Secrets location:**

- Local: `.env` / `.env.local` (gitignored)
- Production: Vercel project environment variables and Supabase dashboard
- Template: `.env.example` (server AI vars only; Supabase vars documented in code/README)

## Webhooks & Callbacks

**Incoming:**

- **None** for core product flows
- Parse-job stub (`/api/parse-jobs`, `/api/parse-jobs/[id]`) returns `404` unless `D2Q_SERVER_PARSE_ENABLED` is set; not a webhook receiver

**Outgoing:**

- **None** — no Stripe, email provider, or outbound webhook dispatchers in application code
- AI calls are synchronous HTTP `fetch` to configured upstream; no callback URLs registered

---

*Integration audit: 2026-07-24*
