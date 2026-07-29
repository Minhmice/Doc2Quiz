# Doc2Quiz — External Integrations

> Last updated: 2026-07-26
> Covers all external services and runtimes that Doc2Quiz depends on.

---

## 1. Supabase

**Purpose:** Authentication (SSR), Postgres database, file storage.

**Packages:**
- `@supabase/ssr` ^0.12.3 — SSR cookie-based session management
- `@supabase/supabase-js` ^2.110.8 — Core client library

**Environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (auto-prepends `https://` if missing) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key for client-side queries |
| `SUPABASE_SERVICE_ROLE_KEY` | For signup | Service role key for admin operations (bypasses RLS) |
| `SERVICE_SUPABASESERVICE_KEY` | Fallback | Legacy env var name for service role key |

### Auth (SSR Sessions)

**Flow:**
1. **Proxy layer** (`src/proxy.ts`): Runs on every matching request. Calls `updateSession()` from `src/lib/supabase/middlewareClient.ts` which creates a `createServerClient` with cookie handling. Refreshes the Supabase auth session silently.
2. **Browser client** (`src/lib/supabase/browser.ts`): `createSupabaseBrowserClient()` uses `createBrowserClient` from `@supabase/ssr`. Used in client components for data access.
3. **Server client** (`src/lib/supabase/server.ts`): `createSupabaseServerClient()` uses `createServerClient` with `next/headers` cookies. Throws on cookie set in Server Components (caught and ignored — refresh happens in proxy).
4. **Admin client** (`src/lib/supabase/admin.ts`): `createSupabaseAdminClient()` uses service role key with `autoRefreshToken: false` and `persistSession: false`. Server-only, bypasses RLS. Used for signup and user management.

**Endpoints:**
- `POST /api/auth/signup` — Creates user via `admin.auth.admin.createUser()` with auto-confirm, handles "already registered" by updating existing user's password. Requires `SUPABASE_SERVICE_ROLE_KEY`.
- `GET|POST /logout` — Calls `supabase.auth.signOut()` and redirects to `/login`.
- `GET /api/health` — Basic health check.

**Client components for auth:**
- `src/app/(auth)/login/LoginClient.tsx` — Login form
- `src/app/(auth)/signup/SignupClient.tsx` — Signup form

**Error handling:**
- `src/lib/supabase/authErrors.ts` — Maps network errors and "Email not confirmed" to actionable messages for login/signup forms.

### Postgres Database

**Migrations:** `supabase/migrations/`

| Migration | Description |
|-----------|-------------|
| `20260725120000_v21_baseline.sql` | Full v2.1 schema (7 tables, RLS policies, storage bucket) |
| `20260725130000_canonical_section_key.sql` | Adds `section_key` column to `canonical_sections` |

**Tables:**

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `study_sets` | `id` (uuid PK), `user_id`, `title`, `pipeline_stage`, `content_kind` | Core entity — tracks state through pipeline: `input` → `raw` → `canonical` → `mode_selected` → `quiz` / `flashcards` |
| `canonical_documents` | `id`, `user_id`, `study_set_id` (unique), `raw_markdown`, `canonical_markdown`, `metadata` (jsonb) | 1:1 with study sets — stores original and clean knowledge |
| `canonical_sections` | `id`, `user_id`, `canonical_document_id`, `ordinal`, `heading`, `body_markdown`, `section_type`, `section_key` | Section-level chunks of canonical content |
| `approved_questions` | `id`, `user_id`, `study_set_id`, `prompt`, `choices` (text[]), `correct_index` (0-3), `explanation`, `source` (jsonb) | AI-generated MCQs approved by user |
| `approved_flashcards` | `id`, `user_id`, `study_set_id`, `front`, `back`, `tags`, `source` (jsonb) | AI-generated flashcards approved by user |
| `quiz_sessions` | `id`, `user_id`, `study_set_id`, `completed_at`, `total_questions`, `correct_count` | Completed quiz attempts |
| `study_wrong_history` | `user_id` + `study_set_id` (composite PK), `question_ids` (uuid[]) | Mistake drill loop per study set |

**Security:** All tables have RLS enabled with user-scoped policies (`user_id = auth.uid()`). The `study_sets` table has a composite unique constraint `(id, user_id)` used as foreign key target for all child tables — ensures data isolation.

### Storage

**Bucket:** `doc2quiz` (private, not public)

**RLS policies:** User-scoped — `bucket_id = 'doc2quiz' AND owner = auth.uid()`

**Used by:**
- File upload during ingest (`POST /api/study-sets/[id]/ingest` multipart uploads stored in `doc2quiz` bucket)
- Client-side `src/lib/client/ingestStudySet.ts` handles the upload flow

### Data Access (Client)

`src/lib/client/studySetDb.ts` is the primary client-side data access layer. It wraps Supabase queries with user authentication and error handling:

- `listStudySetMetas()` — List all study sets for current user
- `getStudySetMeta(id)` — Get single study set
- `createStudySetEarlyMeta()` / `createStudySet()` — Create new study set
- `putStudySetMeta()` / `touchStudySetMeta()` — Update study set
- `deleteStudySet()` — Delete study set
- `getApprovedBank()` / `putApprovedBankForStudySet()` — MCQ read/write
- `getApprovedFlashcardBank()` / `putApprovedFlashcardBankForStudySet()` — Flashcard read/write

---

## 2. AI Provider

**Purpose:** Generic OpenAI-compatible chat completions for document canonicalization, MCQ generation, and flashcard generation.

**Protocol:** HTTP POST to `/chat/completions` (OpenAI-compatible).

**Environment variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_BASE_URL` | No | — | Legacy/simple base URL for chat completions (used by `AI_API_KEY` / `AI_MODEL`) |
| `AI_API_KEY` | No | — | API key for `AI_BASE_URL` |
| `AI_MODEL` | No | — | Model for `AI_BASE_URL` |
| `AI_PROVIDER_URL` | No (one of URL vars required for AI features) | — | Primary provider base URL |
| `AI_PROVIDER_KEY` | No (one of key vars required) | — | API key for `AI_PROVIDER_URL` |
| `AI_MODEL_FREE` | No | `mineru25` | Model used for free-tier users |
| `AI_MODEL_PRO` | No | `gpt-4.1-mini` | Model used for pro-tier users |
| `AI_EMBEDDING_MODEL` | No | `text-embedding-3-small` | Model for `/v1/embeddings` endpoint |
| `AI_PRO_USER_IDS` | No | — | Comma-separated Supabase user IDs with pro tier access |
| `ENABLE_DEV_ENGINE_PANEL` | No | `false` | Shows processing debug panel in dev |

**Configuration architecture:**

The AI config has two parallel paths:

1. **Simple path** (`AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL`): Used for direct one-model setups. The `AI_BASE_URL` should point to an OpenAI-compatible endpoint; the code normalizes it via `normalizeOpenAiChatCompletionsUrl()` which appends `/v1/chat/completions` if needed.

2. **Tiered path** (`AI_PROVIDER_URL` + `AI_PROVIDER_KEY` + `AI_MODEL_FREE`/`AI_MODEL_PRO`): Used for tiered routing with separate free/pro models. This is the primary path read by `ai-processing-config.ts`.

Both paths point to the same `postChatCompletionAssistantText()` function. The tiered path is preferred for production.

**Configuration file:** `src/lib/server/ai-processing-config.ts`
- `readRawConfig()` reads `AI_PROVIDER_URL` / `AI_PROVIDER_KEY`
- `resolveAiModel(tier)` returns `AI_MODEL_FREE` or `AI_MODEL_PRO` based on user tier
- `getAiProcessingConfig(tier)` returns URL, key, and resolved model
- `getChatCompletionsUrl()` / `getEmbeddingsUrl()` normalize URLs
- `isAiProcessingConfigured()` returns true when URL+key present

**Tier resolution:** `src/lib/server/resolveUserAiTier.ts`
- Checks `AI_PRO_USER_IDS` env var (comma-separated)
- Checks `user.app_metadata.doc2quiz_ai_tier === "pro"`
- Checks `user.app_metadata.role === "admin"`
- Checks `user.user_metadata.doc2quiz_ai_tier === "pro"`
- Falls back to `"free"`

**Chat completion client:** `src/lib/server/openAiChatCompletion.ts`
- `postChatCompletionAssistantText()` — HTTP POST with Bearer token auth
- Supports `response_format: { type: "json_object" }` for structured output
- Default `temperature: 0` for deterministic results
- Default `max_tokens: 16384`
- Optional `seed` parameter for reproducibility
- Returns `{ ok, text }` or `{ ok: false, status, body }`

**URL normalization:** `src/lib/ai/openAiEndpoint.ts`
- `normalizeOpenAiChatCompletionsUrl()` — Appends `/v1/chat/completions` if URL points to `/v1` base
- `deriveOpenAiModelsListUrlFromChatCompletions()` — Derives `/v1/models` URL for key validation
- `resolveEmbeddingsTargetUrl()` — Derives `/v1/embeddings` URL from chat base URL; falls back to `https://api.openai.com/v1/embeddings`

**Prompt contracts (loaded at runtime from `prompt/` directory):**

| Prompt File | Loader | Used In |
|-------------|--------|---------|
| `prompt/canonical_builder_v1.json` | `src/lib/pipeline/canonicalPrompt.ts` | `POST /api/study-sets/[id]/canonicalize` |
| `prompt/quiz_generator_v1.json` | `src/lib/pipeline/quizPrompt.ts` | `POST /api/study-sets/[id]/quiz/generate` |
| `prompt/flashcard_generator_v1.json` | `src/lib/pipeline/flashcardPrompt.ts` | `POST /api/study-sets/[id]/flashcards/generate` |

**API Routes:**

| Route | Method | Input | Purpose |
|-------|--------|-------|---------|
| `/api/study-sets/[id]/canonicalize` | POST | Study set with raw document | Runs AI canonicalization (concept extraction, section organization) |
| `/api/study-sets/[id]/quiz/generate` | POST | Optional `questionCount` override | Generates MCQs from canonical knowledge |
| `/api/study-sets/[id]/flashcards/generate` | POST | `learningGoal`, `coverage`, `amount` | Generates flashcards from canonical knowledge |
| `/api/ai/ping` | GET | — | Health check against AI endpoint (resolves user tier, pings `/v1/models`) |

**AI endpoint health check:** `GET /api/ai/ping` calls `runAiAgentPing()` which:
1. Resolves user AI tier
2. Derives `/v1/models` URL from the AI provider URL
3. Sends a GET request with Bearer token
4. Returns status and model availability

**Important:** The AI API key and model are never exposed to the browser. All AI calls happen server-side in API routes.

---

## 3. MarkItDown (Microsoft)

**Purpose:** Converts uploaded documents (PDF, DOCX, PPTX, XLSX, images, HTML, etc.) to Markdown for AI processing.

**Version:** `0.1.6` (`markitdown[all]==0.1.6`)

**Runtime:** Python >= 3.10

**Environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `MARKITDOWN_PYTHON` | No | Path to Python interpreter (e.g., `.venv\Scripts\python.exe` on Windows, `.venv/bin/python` on macOS/Linux). Auto-detects `.venv` if unset. |
| `DOC_PROCESSING_MODE` | No | Processing mode (`auto` default) |

**Python setup:**
- `scripts/setup-python.mjs` — Creates `.venv` virtual environment (`python -m venv .venv`) and runs `pip install -r requirements.txt`
- `requirements.txt` — `markitdown[all]==0.1.6` (the `[all]` extra includes PDF support dependencies)

**Implementation:** `src/lib/pipeline/markitdown.ts`

```typescript
// Core function — spawns Python subprocess
const child = spawn(python, ["-m", "markitdown", inputPath, "-o", outPath]);
```

**Workflow:**
1. File is uploaded to Supabase storage (or sent as multipart)
2. Server downloads file to temp directory
3. `convertWithMarkItDown(inputPath)` spawns `python -m markitdown <input> -o <output>`
4. For paste input, content is written to temp `.txt` file then processed
5. For URLs, the URL is passed directly to MarkItDown CLI
6. Output markdown is read from temp file, temp files cleaned up
7. Result stored in `canonical_documents.raw_markdown`

**Python resolution order:**
1. `MARKITDOWN_PYTHON` env var (if set)
2. `.venv/Scripts/python.exe` (Windows) or `.venv/bin/python` (macOS/Linux)
3. Fallback to `python` on system PATH

**Error handling:**
- Detects `MissingDependencyException` / missing PDF dependencies and shows setup instructions
- Captures stderr and returns formatted error messages
- Times out via Node.js process lifecycle

**Supported input formats:** PDF, DOCX, PPTX, XLSX, JPEG, PNG, WAV, MP3, HTML, CSV, JSON, XML, plain text, URLs.

**MIME type validation:** `src/lib/pipeline/validation.ts` defines the allowlist with per-format size limits (e.g., PDF 50MB, DOCX 25MB, images 10MB).

**Used in:**
- `POST /api/study-sets/[id]/ingest` — Multipart file upload and paste content flow
- `src/lib/client/ingestStudySet.ts` — Client-side ingestion orchestration

---

## 4. Vercel Blob

**Purpose:** Optional blob storage for staging vision processing images in production.

**Package:** `@vercel/blob` ^2.6.1

**Environment variables:** Standard Vercel Blob env vars (auto-provisioned with Vercel Blob integration).

**Usage:** Currently configured for vision pipeline staging — images are temporarily stored in Vercel Blob during vision-first processing. Not used in the main v2.1 pipeline (which uses Supabase storage for all uploaded files).

**Status:** Secondary integration, optional at build time. Enabled only when running on Vercel with the Blob add-on configured.

---

## 5. Sentry

**Purpose:** Optional error tracking and performance monitoring.

**Package:** `@sentry/nextjs` ^10.67.0

**Environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `SENTRY_DSN` | No | Server-side Sentry DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Client-side Sentry DSN |

**Configuration:**

- `sentry.client.config.ts` — Browser SDK init. Uses `NEXT_PUBLIC_SENTRY_DSN`. `tracesSampleRate: 0`. `beforeSend` strips PII.
- `sentry.server.config.ts` — Server SDK init. Uses `SENTRY_DSN`. `tracesSampleRate: 0`. `beforeSend` strips PII.
- `instrumentation.ts` — Next.js instrumentation hook, imports `sentry.server.config` when `NEXT_RUNTIME === "nodejs"`.

**Behavior:**
- Both SDKs are **disabled** when the DSN is empty or unset — Sentry is entirely optional
- No performance tracing by default (`tracesSampleRate: 0`)
- The `beforeSend` callbacks explicitly note that PDF bytes and API keys must never be sent

---

## 6. IndexedDB (Client-side Cache)

**Purpose:** Client-side data caching for offline resilience.

**Package:** None (browser-native IndexedDB API)

**Implementation:** `src/lib/client/studySetDb.ts`

The `studySetDb.ts` module serves dual purpose:
1. **Primary data access layer** for client components (wraps Supabase queries)
2. **Legacy IndexedDB interface** — stub functions `ensureStudySetDb()`, `getDocument()`, `putDocument()` exist as no-ops

The IndexedDB integration is currently **vestigial**. The module exposes:
- `getApprovedBank()` / `putApprovedBankForStudySet()` — Read/write MCQs via Supabase
- `getApprovedFlashcardBank()` / `putApprovedFlashcardBankForStudySet()` — Read/write flashcards via Supabase
- `listStudySetMetas()` — Fetches study set list via Supabase
- `getStudySetMeta()` / `putStudySetMeta()` — Study set CRUD via Supabase

The IndexedDB layer was used in v1.0 (local-only mode) and is preserved as a stub for future offline resilience work. The current v2.1 architecture uses Supabase as the source of truth.

**Tests:** `src/lib/client/studySetDb.test.ts`

---

## 7. Other Integrations

### Theme Provider

**Package:** `@teispace/next-themes` ^2.0.4

**Purpose:** Dark/light mode theming with SSR cookie persistence.

**Usage:**
- `src/app/layout.tsx` — `ThemeProvider` wraps the app with `getTheme()` server-side cookie read
- `src/components/layout/ThemeToggle.tsx` — UI toggle
- `src/components/ui/sonner.tsx` — Toast integration

### Sonner Toasts

**Package:** `sonner` ^2.0.7

**Purpose:** Toast notifications. Styles imported from `node_modules/sonner/dist/styles.css` in `globals.css`. Custom styling with CSS variables for loading/success states in both themes.

### react-markdown

**Package:** `react-markdown` ^10.1.0 + `remark-gfm` ^4.0.1

**Purpose:** Renders canonical document content. Used in `CanonicalMarkdownViewer` component. GFM plugin enables table rendering, strikethrough, and task lists.

---

## Summary of Required vs Optional Integrations

| Integration | Required | Falls back gracefully? |
|-------------|----------|----------------------|
| Supabase Auth + DB | **Yes** (core data) | No — app errors without it |
| AI Provider | **Yes** (content generation) | Yes — routes return 503 if unconfigured |
| MarkItDown (Python) | **Yes** (document conversion) | Yes — ingest returns 422 conversion error |
| Vercel Blob | No (vision staging only) | Yes — entirely optional |
| Sentry | No (error tracking) | Yes — disabled when DSN unset |
| IndexedDB | No (vestigial stub) | Yes — no-ops when called |
