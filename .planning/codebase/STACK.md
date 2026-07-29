# Doc2Quiz — Technology Stack

> Last updated: 2026-07-26
> Next.js 16 + React 19 + TypeScript 6 — full-stack AI study workbench.

---

## Runtime

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Framework | Next.js (App Router) | `^16.2.11` | Server-side rendering, API routes, file-based routing, middleware (proxy) |
| Language | TypeScript | `^6.0.3` | Type-safe codebase across `src/` — both server and client |
| Node.js | Node.js | `>=20` | Runtime target (defined in `package.json` `engines`, Next.js 16 requirement) |
| Package manager | npm | — | Dependency management |

**Key files:**
- `next.config.ts` — webpack tuning (Windows ENOENT workaround, chunk load timeout), production Cache-Control headers, legacy redirect map
- `tsconfig.json` — `bundler` module resolution, `@/` path alias → `./src/*`, `react-jsx` JSX transform

---

## UI Framework

| Technology | Version | Usage |
|-----------|---------|-------|
| React | `^19.2.8` | Component model with Server Components (default in App Router) and Client Components (`"use client"`) |
| react-dom | `^19.2.8` | Server/client rendering, portal for toasts |

**Pattern:** Next.js App Router uses Server Components by default. Client boundary is marked explicitly with `"use client"` directives in interactive components (forms, dashboard, quiz/flashcard workspaces).

**Typography:** Manrope (`--font-body`) and Space Grotesk (`--font-label`) via `next/font/google`, defined in `src/app/layout.tsx`.

---

## Styling

| Technology | Version | Role |
|-----------|---------|------|
| Tailwind CSS | `^4` (via `@tailwindcss/postcss`) | Utility-first CSS framework |
| `tw-animate-css` | `^1.4.0` | Tailwind-compatible animation utilities |
| shadcn/tailwind.css | (bundled with shadcn) | Shared design token layer |
| PostCSS | (via `@tailwindcss/postcss`) | CSS processing pipeline |

**Entry point:** `src/app/globals.css`

- `@import "tailwindcss"` — Tailwind v4 CSS-first configuration
- `@import "tw-animate-css"` — animation utilities
- `@import "shadcn/tailwind.css"` — shadcn design tokens
- `@import "sonner/dist/styles.css"` — toast notification styles
- `@custom-variant dark (&:is(.dark *))` — dark mode variant

**Design tokens:** Mint / blueprint palette with ~50 CSS custom properties in `:root` and `.dark`. Includes `--d2q-*` prefix tokens for app-specific values (colors, radii, grid patterns).

**Custom utilities:** `@utility` directives for `font-label`, `d2q-ghost-grid`, `d2q-technical-grid`, `d2q-blueprint-grid`, `d2q-stitch-ghost-grid`.

**Custom animations:** Shimmer sweep, progress stripes, dot bounce, conversion slide, step enter, dashboard enter, card enter, results enter, route enter, auth enter/shake, status dot pop.

**Key files:**
- `src/app/globals.css` — all global styles and tokens
- No `tailwind.config.*` — Tailwind v4 uses CSS-based config

---

## UI Components

| Technology | Version | Usage |
|-----------|---------|-------|
| @base-ui/react | `^1.6.0` | Low-level accessible UI primitives (Base UI) |
| Framer Motion | `^12.42.2` | Declarative animations, layout transitions, gesture support |
| motion | `^12.42.2` | Companion animation library (same version line) |
| lucide-react | `^1.26.0` | Icon library, optimized via `optimizePackageImports` |
| cmdk | `^1.1.1` | Command menu / combobox primitive |
| sonner | `^2.0.7` | Toast notifications with rich colors and loading state support |
| react-markdown | `^10.1.0` | Markdown rendering in canonical document viewer |
| remark-gfm | `^4.0.1` | GFM (tables, strikethrough, task lists) for react-markdown |
| shadcn | `^4.14.1` | CLI/registry for copy-paste UI components built on Base UI |
| class-variance-authority | `^0.7.1` | Variant-based component styling (mostly via shadcn) |
| clsx | `^2.1.1` | Conditional class merging |
| tailwind-merge | `^3.6.0` | Intelligent Tailwind class conflict resolution (via `cn()` utility) |

**Client component examples:** `DashboardHomeClient`, `QuizSession`, `AuthMobileHeader`, `FlashcardReviewWorkspace`, `StudySetNewImportStepContext`, `PageTransition`.

---

## Forms / Validation

| Technology | Version | Role |
|-----------|---------|------|
| react-hook-form | `^7.82.0` | Performant form state management with uncontrolled inputs |
| zod | `^4.4.3` | Schema-based validation — both client-side forms and server API request bodies |
| @hookform/resolvers | `^5.4.0` | Bridge between react-hook-form and Zod schemas |

**Usage patterns:**
- Zod schemas validate all API route request bodies (e.g., signup, quiz generate, flashcard generate, ingest)
- Zod validates AI pipeline output (canonicalize response, quiz/flashcard generation responses)
- react-hookform + @hookform/resolvers used in signup/login forms and settings

---

## State Management

**No global store.** State is managed through:

| Pattern | Location | Examples |
|---------|----------|---------|
| React hooks | `src/hooks/` | `useDashboardHome` (dashboard data + cache), `useStudySetProductSurfaceRedirect` (routing) |
| Custom hooks in components | `src/components/` | `use-is-in-view` (animate-ui), context providers |
| React Context | Various | `LibrarySearchContext`, `StudySetNewImportStepContext` |
| App-level cache | `src/lib/client/appDataCache.ts` | In-memory dashboard cache with invalidation |
| Supabase direct queries | `src/lib/client/studySetDb.ts` | No client-side store — queries run on demand |
| Custom events | `src/lib/appEvents.ts` | Cross-component messaging (study set list changed, activity stats changed) |

---

## Authentication

| Technology | Version | Role |
|-----------|---------|------|
| @supabase/ssr | `^0.12.3` | Server-side auth session management (cookie-based SSR) |
| @supabase/supabase-js | `^2.110.8` | Core Supabase client (auth, database, storage) |

**Client structure in `src/lib/supabase/`:**
- `env.ts` — URL/key normalization helpers, service role key resolution
- `browser.ts` — `createSupabaseBrowserClient()` for client components
- `server.ts` — `createSupabaseServerClient()` for Server Components (uses `next/headers` cookies)
- `middlewareClient.ts` — `updateSession()` for the proxy layer (Supabase session refresh)
- `admin.ts` — `createSupabaseAdminClient()` with service_role key (server-only, bypasses RLS)
- `auth-guard.ts` — `requireUser()` helper that redirects unauthenticated users to `/login`
- `authErrors.ts` — user-friendly error formatting for login/signup flows

**Auth flow:**
1. Proxy (`src/proxy.ts`) calls `updateSession()` on every request matching the matcher pattern
2. `requireApiUser()` is called in API routes to verify authentication
3. Signup uses service_role key via `admin.auth.admin.createUser()` with auto-confirm
4. Logout posts to `/logout` route which calls `supabase.auth.signOut()` then redirects

**Key files:**
- `src/proxy.ts` — Supabase session refresh (replaces `middleware.ts`)
- `src/app/api/auth/signup/route.ts` — Email/password signup
- `src/app/(auth)/logout/route.ts` — Logout handler
- `src/app/(auth)/login/` and `src/app/(auth)/signup/` — Auth page components
- `src/app/(auth)/layout.tsx` — Auth surface layout

---

## Database

| Technology | Version | Role |
|-----------|---------|------|
| Supabase Postgres | — | Primary data store — study sets, canonical documents, questions, flashcards, sessions |
| IndexedDB (via studySetDb.ts) | — | Client-side data cache for offline resilience |

**Database schema (`supabase/migrations/`):**

| Table | Purpose |
|-------|---------|
| `study_sets` | Core entity — title, pipeline stage, content kind |
| `canonical_documents` | 1:1 with study_sets — original file metadata + raw + canonical markdown |
| `canonical_sections` | Section-level breakdown of canonical content with stable section keys |
| `approved_questions` | AI-generated MCQs approved by user (4 choices, correct_index) |
| `approved_flashcards` | AI-generated flashcards (front/back pairs) |
| `quiz_sessions` | Completed quiz attempts (score tracking) |
| `study_wrong_history` | Mistake drill loop — wrong question IDs per study set |

All tables have **Row Level Security (RLS)** scoped to `user_id = auth.uid()`. Storage bucket `doc2quiz` (private) for uploaded files with user-scoped RLS.

**Key files:**
- `supabase/migrations/20260725120000_v21_baseline.sql` — Full v2.1 schema
- `supabase/migrations/20260725130000_canonical_section_key.sql` — Added `section_key` column

---

## AI Pipeline

| Technology | Version | Role |
|-----------|---------|------|
| OpenAI-compatible `/chat/completions` | — | AI text generation (canonicalization, MCQ generation, flashcard generation) |
| Prompt contracts | — | Versioned JSON prompt files loaded at runtime |

**Architecture:**
- Generic HTTP POST to any OpenAI-compatible `/chat/completions` endpoint
- Prompt contracts are JSON files in `prompt/` directory loaded at runtime via `readFile`
- Each prompt file includes: system message, tasks, output schema, constraints, examples

**Prompt files:**
| File | Version | Purpose |
|------|---------|---------|
| `prompt/canonical_builder_v1.json` | 1.2 | Clean extracted text → structured canonical knowledge with sections |
| `prompt/quiz_generator_v1.json` | 1.2 | Canonical knowledge → multiple-choice questions |
| `prompt/flashcard_generator_v1.json` | 1.0 | Canonical knowledge → front/back flashcards |

**Prompt loaders:**
- `src/lib/pipeline/canonicalPrompt.ts` — `loadCanonicalPrompt()`, `substituteTemplate()`, `buildSystemPrompt()`
- `src/lib/pipeline/quizPrompt.ts` — `loadQuizPrompt()`, `substituteQuizInput()`
- `src/lib/pipeline/flashcardPrompt.ts` — `loadFlashcardPrompt()`, `substituteFlashcardInput()`

**AI client:**
- `src/lib/ai/openAiEndpoint.ts` — URL normalization (`/v1/chat/completions`, `/v1/embeddings`, `/v1/models`)
- `src/lib/server/openAiChatCompletion.ts` — `postChatCompletionAssistantText()` — raw POST with streaming off, JSON mode support, temperature/seed control
- `src/lib/server/ai-processing-config.ts` — tier-based model routing (free/pro), embedding model config
- `src/lib/server/resolveUserAiTier.ts` — resolves "free" vs "pro" tier from user metadata / env

**API routes:**
- `POST /api/study-sets/[id]/ingest` — file upload + MarkItDown conversion
- `POST /api/study-sets/[id]/canonicalize` — AI canonical knowledge extraction
- `POST /api/study-sets/[id]/quiz/generate` — AI MCQ generation
- `POST /api/study-sets/[id]/flashcards/generate` — AI flashcard generation
- `GET /api/ai/ping` — AI endpoint health check

---

## Document Conversion

| Technology | Version | Role |
|-----------|---------|------|
| Microsoft MarkItDown | `0.1.6` | Python-based document → Markdown conversion |
| Python | `>=3.10` | MarkItDown runtime |

**Supported formats:** PDF, DOCX, PPTX, XLSX, JPEG, PNG, WAV, MP3, HTML, CSV, JSON, XML, plain text.

**Implementation:** `src/lib/pipeline/markitdown.ts`
- Spawns `python -m markitdown <input> -o <output>` via Node.js `child_process.spawn`
- Writes input to temp file, reads output, cleans up
- Auto-detects `.venv` Python interpreter or uses `MARKITDOWN_PYTHON` env var
- Paste content written to temp `.txt` file, URLs passed directly

**Python environment setup:**
- `scripts/setup-python.mjs` — creates `.venv` and installs `markitdown[all]==0.1.6`
- `requirements.txt` — single dependency: `markitdown[all]==0.1.6`

---

## Build / Tooling

| Technology | Version | Role |
|-----------|---------|------|
| eslint | `^9.39.5` | Linting with `eslint-config-next` |
| vitest | `^3.2.4` | Unit testing (node environment, `@/` path alias) |
| playwright | `^1.52.0` | E2E / integration testing |
| tsx | (npx) | TypeScript execution for scripts (e.g., `npx tsx scripts/verify-study-set-redirects.ts`) |
| cross-env | `^10.1.0` | Cross-platform NODE_OPTIONS sanitization |

**npm scripts:**
| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `cross-env NODE_OPTIONS= node scripts/dev.mjs` | Dev server via custom wrapper |
| `dev:clean` | rm `.next` + `dev` | Clean restart |
| `dev:turbo` | `next dev --turbopack` | Turbopack dev server |
| `build` | `next build --webpack` | Production build with webpack |
| `start` | `next start` | Production server |
| `lint` | `eslint` | Lint check |
| `typecheck` | `tsc --noEmit` | TypeScript type check |
| `test` | `vitest` | Run unit tests |
| `verify:redirects` | `tsx scripts/...` | Verify redirect configuration |
| `capture:dashboard` | `node scripts/capture-dashboard.mjs` | Screenshot capture |
| `eval-export-smoke` | `node scripts/eval-export-smoke.mjs` | Export validation |
| `setup:python` | `node scripts/setup-python.mjs` | Python venv setup |

**Key files:**
- `scripts/dev.mjs` — Custom dev server wrapper that sanitizes `NODE_OPTIONS` (filters `--localstorage-file` flags from Cursor/Node 25)
- `vitest.config.ts` — Node environment, `@/` path alias
- `eslint.config.mjs` — ESLint flat config

---

## Observability

| Technology | Version | Role |
|-----------|---------|------|
| @sentry/nextjs | `^10.67.0` | Optional error tracking (client + server) |

**Configuration:**
- `sentry.client.config.ts` — Uses `NEXT_PUBLIC_SENTRY_DSN`, disabled when DSN empty, `tracesSampleRate: 0`
- `sentry.server.config.ts` — Uses `SENTRY_DSN`, disabled when DSN empty, `tracesSampleRate: 0`
- `instrumentation.ts` — Imports Sentry server config on Node.js runtime

Both are **optional** — the app runs without Sentry when DSN is unset. The `beforeSend` callback explicitly strips PII.

---

## Deployment

| Technology | Version | Role |
|-----------|---------|------|
| Vercel | — | Primary deployment target |
| @vercel/blob | `^2.6.1` | Optional blob storage for vision image staging |

**Config notes:**
- `next.config.ts` exports long-lived Cache-Control headers (`max-age=31536000, immutable`) for static chunks in production
- Legacy redirects map old `/sets/*` and `/new/*` routes to `/edit/*` equivalents
- All API routes use `runtime = "nodejs"` with `maxDuration` between 30s and 120s

---

## Key Dependencies Not Covered Above

| Package | Version | Usage |
|---------|---------|-------|
| @teispace/next-themes | `^2.0.4` | Theme provider (dark/light) with SSR cookie support |
| tailwind-merge | `^3.6.0` | Tailwind class deduplication via `cn()` utility |
| @types/node | `^26` | Node.js type definitions |
| @types/react | `^19` | React type definitions |
| @types/react-dom | `^19` | React DOM type definitions |

---

## Directory Map

```
src/
├── app/(app)/           — Authenticated app routes (dashboard, edit, quiz, flashcards, sets, settings)
├── app/(auth)/          — Auth routes (login, signup, logout)
├── app/api/             — API routes (auth, health, study-sets, ai)
├── components/          — UI components (auth, dashboard, edit, flashcards, quiz, layout, ui, canonical, animate-ui)
├── hooks/               — Shared React hooks
├── lib/
│   ├── ai/              — OpenAI endpoint URL utilities
│   ├── api/             — API helpers (requireApiUser)
│   ├── client/          — Browser-side data access (studySetDb, supabase, appDataCache, activityTracking)
│   ├── locale/          — i18n messages and slang
│   ├── pipeline/        — Core pipeline (ingest, canonicalize, quiz/flashcard generate, markitdown)
│   ├── server/          — Server-only (ai-agent-ping, ai-processing-config, openAiChatCompletion, resolveUserAiTier)
│   └── supabase/        — Supabase client factory (browser, server, middlewareClient, admin)
├── types/               — TypeScript type definitions
├── proxy.ts             — Supabase session refresh middleware (proxy)
└── app/globals.css      — Global styles + design tokens
prompt/                  — Versioned AI prompt contracts (JSON)
supabase/migrations/     — Database migrations
scripts/                 — Utility scripts (dev.mjs, setup-python.mjs, capture scripts)
```
