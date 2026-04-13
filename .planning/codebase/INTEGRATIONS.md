# External Integrations

**Analysis Date:** 2026-04-11

## Same-origin AI forward (browser → Next → vendor)

**Purpose:** Avoid browser CORS for OpenAI-compatible chat, Anthropic Messages, or custom HTTPS gateways. Phase 19 consolidates BYOK into a **forward triple** (base URL, API key, model id) in `localStorage`, with one-time migration from legacy keys — see `src/lib/ai/forwardSettings.ts`, key constants in `src/types/question.ts`, and product notes in `docs/BYOK-forward-only.md`.

**Client:** `src/lib/ai/sameOriginForward.ts` — `forwardAiPost()` POSTs JSON to `/api/ai/forward` with `provider` (`openai` | `anthropic` | `custom`), `targetUrl`, `apiKey`, and upstream `body`.

**Server:** `src/app/api/ai/forward/route.ts` — validates provider, requires `targetUrl` + `apiKey`, allows `https:` or `http://localhost` / `http://127.0.0.1`, sets vendor headers (`Authorization: Bearer …` for OpenAI/custom; `x-api-key` + `anthropic-version` for Anthropic), `fetch`es upstream, returns upstream status/body.

**Downstream usage:** Text and multimodal parse paths (`src/lib/ai/parseChunk.ts`, `src/lib/ai/ocrAdapter.ts`, vision helpers, layout chunk parse) call through this hop. Declarative gating of which surfaces are allowed lives in `src/lib/ai/parseCapabilities.ts` (not a live model probe).

**Secrets:** Keys and URLs travel in the **request body** from client to Route Handler for forwarding — not loaded from server env for vendor auth (operator-owned BYOK). Do not commit secrets; `.env` files are local only.

## Vision image staging (HTTPS URLs for gateways)

**POST:** `src/app/api/ai/vision-staging/route.ts` — accepts `{ dataUrl }`, decodes base64 (`node:buffer`), enforces `VISION_STAGING_MAX_BYTES` from `src/lib/ai/visionStagingStore.ts`, returns `{ url, id }`.

**Behavior split:**

- When `BLOB_READ_WRITE_TOKEN` is set — uploads bytes with `@vercel/blob` (`put`); returned `url` is provider-hosted HTTPS (multi-instance safe). Path naming via `visionStagingBlobPathname` in `src/lib/ai/visionStagingStore.ts`.
- When token unset — `putVisionStaging` in-memory map; `url` is same-origin `…/api/ai/vision-staging/[id]` (dev default; not shared across serverless instances).

**GET:** `src/app/api/ai/vision-staging/[id]/route.ts` — serves staged bytes for in-memory ids.

**Limits / ops:** Payload size cap on POST; unauthenticated surface — rate limiting and auth are backlog (see `README.md`). Public Blob objects are not auto-deleted by this app.

## Static test image route

**GET:** `src/app/api/ai/vision-test-image/route.ts` — fixed PNG from `src/lib/ai/visionTestImageData.ts` for connection and vision smoke tests.

## Optional server parse queue (Phase 15 scale mode)

**Flag:** `src/lib/serverParse/env.ts` — `isServerParseQueueEnabled()` reads **`D2Q_SERVER_PARSE_ENABLED`** (`1` / `true`, case-insensitive). No `NEXT_PUBLIC_` variant; toggling stays a server decision.

**Routes:**

- `src/app/api/parse-jobs/route.ts` — **GET** returns `{ enabled: false }` with **404** when flag off; when on, **200** with `{ enabled: true, version: "stub-15-02" }`. **POST** with flag off → **404** `{ enabled: false }`; when on → validates JSON, enforces `Content-Length` cap (`MAX_CONTENT_LENGTH` in file), returns **501** `{ error: "not_implemented", … }` (worker not wired).
- `src/app/api/parse-jobs/[id]/route.ts` — **GET** with flag off → **404**; when on → **501** `{ error: "not_implemented", id }`.

**Types:** `src/types/parseJob.ts` — `ParseJobStatus`, `ParseJobSummary`, `ParseJobCreateResponse` for future client/worker contract.

**Reserved env (not read by current routes):** `D2Q_SERVER_PARSE_MAX_MB` — documented in `docs/SCALE-MODE-parse-queue.md` for a future upload cap.

## pdf.js worker (same origin, not a remote SaaS API)

**Artifact:** `public/pdf.worker.min.mjs` — copied from `pdfjs-dist` via `scripts/copy-pdf-worker.mjs` on `postinstall`.

**Client wiring:** `src/lib/pdf/pdfWorker.ts` sets `GlobalWorkerOptions.workerSrc` to `/pdf.worker.min.mjs`.

**Library usage:** `src/lib/pdf/extractPdfText.ts`, `src/lib/pdf/renderPagesToImages.ts`, helpers alongside `src/lib/pdf/`.

## Browser-local persistence (no third-party DB)

**IndexedDB:** `src/lib/db/studySetDb.ts` — database name/version from `src/types/studySet.ts` (`DB_NAME`, **`DB_VERSION` 5**). Object stores: `meta`, `document`, `draft`, `approved`, `media`, `parseProgress`, `ocr`, `quizSessions`, `studyWrongHistory`.

**localStorage:** AI settings — `src/lib/ai/storage.ts`, `src/lib/ai/forwardSettings.ts`, `src/lib/ai/parseLocalStorage.ts`; key constants and legacy keys in `src/types/question.ts`. Parse UI toggles referenced from `src/components/ai/AiParseSection.tsx` and related components.

**Canvas:** JPEG data URLs from `src/lib/pdf/renderPagesToImages.ts` for OCR/vision inputs.

## Environment variables (code-referenced, no values)

| Variable | Where | Purpose |
|----------|--------|---------|
| `NODE_ENV` | `src/lib/logging/pipelineLogger.ts` | Development-only log branches |
| `NEXT_PUBLIC_D2Q_PIPELINE_DEBUG` | `src/lib/logging/pipelineLogger.ts` | Verbose browser pipeline logs when `"1"` |
| `BLOB_READ_WRITE_TOKEN` | `src/app/api/ai/vision-staging/route.ts` | Enables Vercel Blob upload path for staged images |
| `D2Q_SERVER_PARSE_ENABLED` | `src/lib/serverParse/env.ts` | Exposes parse-job API stubs when truthy |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry SDK + `reportPipelineError` | Optional server/client capture (see `README.md`) |

Repository `.env*` files: local configuration only; never commit secrets.

## Authentication & identity

Not implemented — no accounts or OAuth. API keys are per-browser storage and forwarded per request through `POST /api/ai/forward`.

## Error reporting (optional)

`src/lib/observability/reportPipelineError.ts` — console-first; optional `@sentry/nextjs` when DSN configured. Scrubbing expectations documented in `README.md`.

## Monitoring, CI/CD, webhooks

No required remote monitoring in v1. No incoming webhooks. CI config not detected in workspace snapshot used for this pass.

---

*Integration audit: 2026-04-11*
