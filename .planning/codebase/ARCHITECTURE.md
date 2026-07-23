<!-- refreshed: 2026-07-24 -->
# Architecture

**Analysis Date:** 2026-07-24

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     Next.js App Router (React 19)                        │
│  Pages: `src/app/(app)/*`  │  Auth: `src/app/(auth)/*`  │  API routes   │
├──────────────────┬──────────────────────┬───────────────────────────────┤
│  Dashboard /     │  Import & review     │  Quiz / flashcard sessions    │
│  `dashboard/`    │  `edit/new/*`,       │  `quiz/[id]`,                 │
│                  │  `edit/quiz|flashcards/[id]` │ `flashcards/[id]`     │
└────────┬─────────┴──────────┬───────────┴───────────────┬───────────────┘
         │                    │                           │
         ▼                    ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Client domain (`src/lib/*`, `src/components/*`)             │
│  PDF extract · vision/OCR parse · IndexedDB · upload client · UI       │
└────────┬───────────────────────────────┬────────────────────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────────────────────┐
│  Route Handlers         │   │  Supabase (Postgres + Storage + Auth)    │
│  `src/app/api/*`        │   │  `study_sets`, `approved_*`, caches      │
│  forward · uploads ·    │   │  RLS per `user_id`                       │
│  generate-from-file     │   │  `supabase/migrations/*.sql`             │
└────────┬────────────────┘   └─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  External: OpenAI-compatible LLM API, Vercel Blob (optional staging)   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Doc2Quiz** turns PDF study material into **quiz (MCQ)** or **flashcard** practice. The architecture is **hybrid**:

1. **Cloud-first canonical pipeline (server):** authenticated upload → Supabase storage → canonical LLM extraction → generation from canonical units only → draft rows in `approved_*` → `study_sets.status = draft`. Same steps for all tiers; only the resolved model id differs (free vs pro/admin). Authoritative narrative: `docs/ARCHITECTURE-IMPORT-GENERATION.md`.

2. **Rich client AI stack (vision / OCR / workbench):** PDF rasterization, batch vision parsing, layout chunk parsing, embeddings — under `src/lib/ai/**` and `src/components/ai/**`, orchestrated by `AiParseSection.tsx` and proxied through `/api/ai/forward` or vision staging routes.

3. **Dual persistence:** Supabase is the source of truth for authenticated study sets; `src/lib/db/studySetDb.ts` provides browser-side Supabase access plus legacy IndexedDB helpers and client-side caches (OCR, parse progress, embedding index metadata).

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root layout | Fonts, global CSS, theme/toast providers | `src/app/layout.tsx` |
| App layout guard | Require authenticated user; mount app shell | `src/app/(app)/layout.tsx` |
| Auth layout | Login/signup chrome | `src/app/(auth)/layout.tsx` |
| Middleware | Refresh Supabase session; attach `x-next-pathname` | `src/middleware.ts` |
| PDF import flow | Early study set creation, local PDF preview, background upload | `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx` |
| Canonical generation API | Extraction cache, generation cache, strict validation, persist drafts | `src/app/api/study-sets/[id]/generate-from-file/route.ts` |
| AI forward proxy | Server-side BYOK / env-key proxy to LLM vendor | `src/app/api/ai/forward/route.ts` |
| PDF upload API | Multipart init/part/complete/abort to Supabase storage | `src/app/api/uploads/pdf/*` |
| Parse orchestration UI | Vision, OCR, layout chunk, embedding index, uncertain fallback | `src/components/ai/AiParseSection.tsx` |
| Study set data access | CRUD for sets, documents, assets, approved banks | `src/lib/db/studySetDb.ts` |
| Canonical server pipeline | Extract units, generate items, cache, validate | `src/lib/server/generateFromFile/*` |
| Path helpers | Canonical URLs (legacy `/sets/*` redirected in `next.config.ts`) | `src/lib/routes/studySetPaths.ts` |

## Pattern Overview

**Overall:** Next.js App Router with **route groups**, **server Route Handlers** for privileged operations, and **client-heavy AI orchestration** for parse workbench flows.

**Key Characteristics:**
- **Server-only secrets:** `src/lib/server/ai-processing-config.ts` reads `AI_PROVIDER_URL` / `AI_PROVIDER_KEY`; never import in client components.
- **Canonical-only generation:** no raw-text-to-items path; all server generation goes through `runGenerateItemsFromCanonicalUnits` (`src/lib/server/generateFromFile/runGenerateItemsFromCanonicalUnits.ts`).
- **User-scoped data:** Supabase RLS on all tables; Route Handlers call `supabase.auth.getUser()` before mutations.
- **Legacy URL compatibility:** permanent redirects from `/sets/*` and `/new/*` to `/edit/*` and `/quiz/*` in `next.config.ts`.
- **Feature flags / stubs:** parse job queue (`src/app/api/parse-jobs/route.ts`) and dev engine panel gated by env.

## Layers

**Routing & layouts:**
- Purpose: URL mapping, auth boundaries, page transitions
- Location: `src/app/**`, `src/middleware.ts`, `next.config.ts`
- Contains: `page.tsx`, `layout.tsx`, `template.tsx`, `route.ts`
- Depends on: Supabase auth guard, component providers
- Used by: Browser navigation, API clients

**API (Route Handlers):**
- Purpose: Server-only AI, uploads, generation, dev tooling
- Location: `src/app/api/**`
- Contains: JSON request/response handlers
- Depends on: `src/lib/server/**`, `src/lib/supabase/server.ts`, upload contracts
- Used by: Client fetch calls during import, parse, and generation

**UI components:**
- Purpose: Product surfaces (dashboard, import, review, practice, settings)
- Location: `src/components/**` (active); `src/components-legacy/**` (archived, do not import)
- Contains: React client components, shadcn-style primitives in `src/components/ui/`
- Depends on: `src/lib/**`, `src/hooks/**`, `src/types/**`
- Used by: App Router pages

**Server domain:**
- Purpose: Canonical extraction/generation, AI config, draft persistence
- Location: `src/lib/server/**`
- Contains: OpenAI chat helper, SHA helpers, tier resolution, generate-from-file modules
- Depends on: Env vars, Supabase server client, Zod schemas in `canonicalUnitSchemas.ts`
- Used by: `generate-from-file` route, embed route, forward route

**Client / shared domain:**
- Purpose: PDF processing, AI pipelines, routing, validations, uploads
- Location: `src/lib/**` (excluding `server/` and `serverParse/`)
- Contains: `ai/`, `pdf/`, `db/`, `supabase/`, `uploads/`, `review/`, `logging/`
- Depends on: Browser APIs, pdf.js, optional IndexedDB
- Used by: Components and client pages

**Types:**
- Purpose: Shared contracts across client and server
- Location: `src/types/**`
- Contains: `question.ts`, `studySet.ts`, `canonicalSource.ts`, `visionParse.ts`, upload types
- Depends on: Nothing runtime
- Used by: All layers

## Data Flow

### Primary Request Path — New study set import (client-led)

1. User selects PDF on `/edit/new/quiz` or `/edit/new/flashcards` (`src/app/(app)/edit/new/quiz/page.tsx`, `flashcards/page.tsx`).
2. `NewStudySetPdfImportFlow` creates early `study_sets` row via `createStudySetEarlyMeta` (`src/lib/db/studySetDb.ts`).
3. Local text extraction enriches `study_set_documents` via `enrichStudySetDocumentFromLocalPdf` (`src/lib/pdf/extractPdfText.ts`).
4. Background upload runs through `runBackgroundStudySetPdfUpload` → `runPdfUploadSession` → `/api/uploads/pdf/*` (`src/lib/uploads/runBackgroundStudySetPdfUpload.ts`).
5. Client calls `POST /api/study-sets/[id]/generate-from-file` with `fileRef` matching `source_pdf_asset_id`.
6. Server resolves `contentSha256`, loads canonical units (cache or `extractCanonicalSourceUnits`), optionally hits `generation_output_cache`, runs `runGenerateItemsFromCanonicalUnits`, validates with `validateStrictQuizQuestions` / `validateStrictFlashcards`, persists via `persistQuizDraft` / `persistFlashcardDraft`, sets `study_sets.status = "draft"`.
7. User lands on edit/review (`/edit/quiz/[id]` or `/edit/flashcards/[id]`).

### Secondary Flow — Client vision / OCR parse workbench

1. `AiParseSection` (`src/components/ai/AiParseSection.tsx`) plans strategy from user preferences in `parseLocalStorage.ts`.
2. PDF pages rasterize via `src/lib/pdf/renderPagesToImages.ts`; optional OCR through `runOcrSequential` (`src/lib/ai/runOcrSequential.ts`).
3. Quiz paths may use layout chunks (`runLayoutChunkParse`) or vision batch/sequential (`runVisionBatchSequential`, `runVisionSequential`).
4. Flashcard paths use vision batch only (theory-only prompts per file header comment).
5. LLM calls go through client forward helpers to `/api/ai/forward` (`src/app/api/ai/forward/route.ts`), which applies tier-based model routing via `resolveUserAiTier`.
6. Results dedupe, map to pages, and persist through `studySetDb.ts` into `approved_questions` / `approved_flashcards`.

### Practice session flow

1. User opens `/quiz/[id]` or `/flashcards/[id]` (`src/app/(app)/quiz/[id]/page.tsx`, `flashcards/[id]/page.tsx`).
2. `useStudySetProductSurfaceRedirect` (`src/hooks/useStudySetProductSurfaceRedirect.ts`) redirects if `contentKind` mismatches surface (`src/lib/routing/studySetContentKindRedirects.ts`).
3. `QuizSession` / `FlashcardSession` load approved banks from Supabase via `studySetDb.ts`.
4. Session progress writes to `quiz_sessions` and `study_wrong_history` (schema in `supabase/migrations/20260418_000001_doc2quiz_cloud_first.sql`).

**State Management:**
- **Server:** Supabase Postgres + Storage; generation/extraction caches in dedicated tables.
- **Client UI:** React `useState` / context (`ParseProgressProvider`, `DisplayNameProvider`, `LibrarySearchContext`).
- **Parse preferences:** `localStorage` via `src/lib/ai/parseLocalStorage.ts`.
- **OCR / embedding index:** IndexedDB modules `src/lib/ai/ocrDb.ts`, `src/lib/db/embeddingIndexDb.ts`.

## Key Abstractions

**Study set:**
- Purpose: Top-level user artifact (quiz or flashcards)
- Examples: `src/types/studySet.ts`, `study_sets` table, `getStudySetMeta` in `studySetDb.ts`
- Pattern: UUID id, `content_kind`, `status` (`draft` | `ready`)

**Canonical source unit:**
- Purpose: Normalized extract from document text for deterministic generation
- Examples: `src/types/canonicalSource.ts`, `extractCanonicalSourceUnits.ts`, `canonical_document_extractions` table
- Pattern: Cached by `contentSha256` + schema version; every generated item must reference `sourceUnitIds`

**Approved bank:**
- Purpose: Reviewed content ready for practice
- Examples: `ApprovedBank` in `src/types/question.ts`, `ApprovedFlashcardBank` in `src/types/visionParse.ts`, `approved_questions` / `approved_flashcards` tables
- Pattern: Upsert-by-id in `persistStudySetGeneratedDraft.ts`; review UI in `src/components/review/`

**AI provider / tier:**
- Purpose: Route LLM calls to correct model for user tier
- Examples: `resolveUserAiTier.ts`, `getAiProcessingConfig()` in `ai-processing-config.ts`
- Pattern: Server env models (`AI_MODEL_FREE`, `AI_MODEL_PRO`); temperature `0` in generation runner

**PDF upload session:**
- Purpose: Resumable multipart upload to Supabase storage
- Examples: `src/types/uploads.ts`, `src/app/api/uploads/pdf/init/route.ts`, `runPdfUploadSession.ts`
- Pattern: init → part(s) → complete; optional local-only skip when provider not configured

## Entry Points

**Web app root:**
- Location: `src/app/page.tsx`
- Triggers: `GET /`
- Responsibilities: Redirect to `/dashboard`

**Authenticated app shell:**
- Location: `src/app/(app)/layout.tsx`
- Triggers: Any `(app)` route
- Responsibilities: `requireUser()`, wrap with `AppProviders` (command palette, parse progress, app shell)

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: All non-static routes per matcher
- Responsibilities: Supabase session refresh via `updateSession` (`src/lib/supabase/middlewareClient.ts`)

**Canonical generation:**
- Location: `src/app/api/study-sets/[id]/generate-from-file/route.ts`
- Triggers: `POST` from import flow after PDF upload
- Responsibilities: Full canonical pipeline; returns generated item counts and cache hit flags

**AI proxy:**
- Location: `src/app/api/ai/forward/route.ts`
- Triggers: Client parse/workbench LLM calls
- Responsibilities: Authenticated upstream proxy with URL allowlist and default `max_tokens`

**Dev generation debug:**
- Location: `src/app/api/study-sets/[id]/generation-debug/route.ts`
- Triggers: `GET` when `NODE_ENV !== "production"` and `isDevEnginePanelEnabled()`
- Responsibilities: Non-secret generation diagnostics (hashes, cache hits, coverage)

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop for Route Handlers; PDF image preprocessing uses Web Workers (`src/lib/pdf/imagePreprocess/imagePreprocess.worker.ts`).
- **Global state:** No shared in-memory app state on server; client singletons limited to parse schedulers (`embeddingIndexScheduler.ts`, `uncertainParseFallback.ts`) keyed by `studySetId`.
- **Circular imports:** Avoid importing `src/lib/server/**` from client components; `ai-processing-config.ts` is server-only by convention and comment.
- **pdf.js bundling:** `pdfjs-dist` is `serverExternalPackages` in `next.config.ts` to avoid SSR bundle issues.
- **Auth cookies:** Server Components cannot always set cookies; session refresh relies on middleware (`src/lib/supabase/server.ts` catch block documents this).

## Anti-Patterns

### Importing server AI config in client components

**What happens:** Client bundle pulls `AI_PROVIDER_KEY` or server-only env access.
**Why it's wrong:** Secrets leak to the browser; build may fail or expose credentials.
**Do this instead:** Call Route Handlers (`/api/ai/forward`, `/api/study-sets/.../generate-from-file`) from client code; keep config in `src/lib/server/ai-processing-config.ts`.

### Raw-text-to-quiz generation

**What happens:** Skipping canonical extraction and generating items directly from `extracted_text`.
**Why it's wrong:** Removed from codebase; breaks cache keys, `sourceUnitIds` provenance, and tier parity.
**Do this instead:** Always use `extractCanonicalSourceUnits` → `runGenerateItemsFromCanonicalUnits` per `docs/ARCHITECTURE-IMPORT-GENERATION.md`.

### Importing from `src/components-legacy/`

**What happens:** Archived components re-enter the runtime tree.
**Why it's wrong:** Unmaintained UI; breaks edit-centric taxonomy documented in `src/components-legacy/LEGACY_COMPONENTS.md`.
**Do this instead:** Add or extend components under `src/components/<feature>/`; use `src/lib/routes/studySetPaths.ts` for URLs.

### Hardcoding legacy `/sets/*` URLs

**What happens:** Links bypass `next.config.ts` redirects or mismatch `contentKind`.
**Why it's wrong:** Legacy routes redirect but may not enforce content-kind guards.
**Do this instead:** Use helpers in `src/lib/routes/studySetPaths.ts` and `mismatchHrefForSurface` in `studySetContentKindRedirects.ts`.

## Error Handling

**Strategy:** Route Handlers return JSON `{ error: string }` with appropriate HTTP status; long-running client parse uses `FatalParseError` and `AbortSignal` for cancellation.

**Patterns:**
- **503 when AI unavailable:** `isAiProcessingConfigured()` checks in generation and forward routes; message from `src/lib/ai/processingMessages.ts`.
- **Pipeline logging:** Structured logs via `pipelineLog` in `src/lib/logging/pipelineLogger.ts` (study set id, stage, normalized errors).
- **Parse chunk retries:** `runSequentialParse.ts` retries each chunk once before counting as failed.
- **Optional Sentry:** `sentry.client.config.ts`, `sentry.server.config.ts` — enabled only when `NEXT_PUBLIC_SENTRY_DSN` is set; `reportPipelineError` in `src/lib/observability/reportPipelineError.ts`.

## Cross-Cutting Concerns

**Logging:** `pipelineLog` for import/parse/upload stages; console in dev; Sentry optional for production errors.

**Validation:** Zod schemas in `src/lib/server/generateFromFile/canonicalUnitSchemas.ts` and `schemas.ts`; MCQ review validation in `src/lib/review/validateMcq.ts`; strict generation gates in `validateStrictGenerated.ts`.

**Authentication:** Supabase Auth with cookie sessions; `requireUser()` for `(app)` layout; API routes check `getUser()` per request; middleware refreshes session on every matched request.

---

*Architecture analysis: 2026-07-24*
