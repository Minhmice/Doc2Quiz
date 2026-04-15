# External Integrations

**Analysis Date:** 2026-04-14

## APIs & External Services

**AI model providers (Bring-your-own-key, browser-owned):**
- **Same-origin AI forward** — browser → Next Route Handler → vendor
  - Implementation:
    - Client: `src/lib/ai/sameOriginForward.ts` (`forwardAiPost`)
    - Server: `src/app/api/ai/forward/route.ts`
    - Settings/migration: `src/lib/ai/forwardSettings.ts` (persists a forward triple in `localStorage`)
  - Supported providers (forward header behavior): `openai`, `anthropic`, `custom` (`src/app/api/ai/forward/route.ts`)
  - Auth: **request body includes apiKey** (no server-side vendor keys by default)
  - Target URL policy: `https:` allowed; `http:` allowed only for `localhost`/`127.0.0.1` (`src/app/api/ai/forward/route.ts`)

## Data Storage

**Databases:**
- **IndexedDB (browser local-first)** — `src/lib/db/studySetDb.ts`
  - Name/version: `DB_NAME = "doc2quiz"`, `DB_VERSION = 6` (`src/types/studySet.ts`)
  - Core stores: `meta`, `document`, `draft`, `approved`, `approvedFlashcards`, `media`, `parseProgress`, `ocr`, `quizSessions`, `studyWrongHistory` (`src/lib/db/studySetDb.ts`)

**File Storage:**
- **Optional Vercel Blob** (`@vercel/blob`) — vision image staging when `BLOB_READ_WRITE_TOKEN` is set
  - POST: `src/app/api/ai/vision-staging/route.ts` (uploads with `put`)
  - GET: `src/app/api/ai/vision-staging/[id]/route.ts` (redirects via `head`)
  - Path naming: `visionStagingBlobPathname` (`src/lib/ai/visionStagingStore.ts`)
- **In-memory staging fallback** — local dev / no token (`src/lib/ai/visionStagingStore.ts`)
  - TTL: ~10 minutes; bounded entries; not multi-instance safe

**Caching:**
- **Client-side vision parse cache** — `src/lib/ai/visionParseCache.ts` (caches batch results keyed by batch hash; used by `src/lib/ai/runVisionBatchSequential.ts`)

## Authentication & Identity

**Auth Provider:**
- Not implemented (no accounts). AI credentials are stored per-browser in `localStorage` (`src/lib/ai/forwardSettings.ts`) and sent through `POST /api/ai/forward`.

## Monitoring & Observability

**Error Tracking:**
- Optional Sentry (`@sentry/nextjs`)
  - Client init: `sentry.client.config.ts` (env: `NEXT_PUBLIC_SENTRY_DSN`)
  - Server init: `sentry.server.config.ts` + `instrumentation.ts` (env: `SENTRY_DSN`)

**Logs:**
- Structured pipeline logging to console (`src/lib/logging/pipelineLogger.ts`)

## CI/CD & Deployment

**Hosting:**
- Not enforced in code. Optional Vercel-specific integration exists via `@vercel/blob` for image staging.

**CI Pipeline:**
- Not detected in this pass (no repo-level CI config referenced here).

## Environment Configuration

**Required env vars:**
- None required for local-only usage if the user supplies AI settings in the UI (stored in `localStorage`).

**Optional env vars (code-referenced):**
- `BLOB_READ_WRITE_TOKEN` — enables public HTTPS staging for vision upstream (`src/app/api/ai/vision-staging/*`, `src/lib/ai/stageVisionDataUrl.ts`)
- `D2Q_SERVER_PARSE_ENABLED` — exposes parse job API stubs (`src/lib/serverParse/env.ts`, `src/app/api/parse-jobs/*`)
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` — enable Sentry (`sentry.*.config.ts`)

**Secrets location:**
- Browser `localStorage` (AI forward triple), plus optional local `.env*` files for operator configuration. Do not commit secrets.

## Webhooks & Callbacks

**Incoming:**
- None detected.

**Outgoing:**
- None detected (no webhook emitters).

---

*Integration audit: 2026-04-14*
