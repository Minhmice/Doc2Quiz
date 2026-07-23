# Codebase Structure

**Analysis Date:** 2026-07-24

## Directory Layout

```
Doc2Quiz/
├── src/                          # Application source (Next.js App Router)
│   ├── app/                      # Routes, layouts, API Route Handlers
│   │   ├── (app)/                # Authenticated product surfaces
│   │   ├── (auth)/               # Login, signup, logout
│   │   └── api/                  # Server endpoints
│   ├── components/               # Active React UI (feature + ui primitives)
│   ├── components-legacy/        # Archived components — do not import
│   ├── hooks/                    # Shared React hooks
│   ├── lib/                      # Domain logic, clients, utilities
│   │   ├── ai/                   # Vision, OCR, chunk parse, embeddings
│   │   ├── db/                   # studySetDb, parse/embedding IndexedDB
│   │   ├── pdf/                  # pdf.js extraction, rasterization, workers
│   │   ├── server/               # Server-only: canonical pipeline, AI config
│   │   ├── supabase/             # Browser/server/middleware clients
│   │   └── uploads/              # PDF upload client + session runner
│   └── types/                    # Shared TypeScript contracts
├── public/                       # Static assets (pdf worker, mathjax placeholder)
├── scripts/                      # Build helpers and verification scripts
├── supabase/migrations/          # Postgres schema, RLS, storage bucket SQL
├── docs/                         # Product and architecture documentation
├── example/                      # Design mocks / reference UI (not runtime)
├── graphify-out/                 # Generated graph/cache artifacts (local tooling)
├── .planning/                    # GSD roadmaps and codebase maps
├── next.config.ts                # Redirects, headers, external packages
├── tsconfig.json                 # `@/*` → `./src/*`
├── sentry.client.config.ts       # Optional browser error tracking
├── sentry.server.config.ts       # Optional server error tracking
├── eslint.config.mjs
├── postcss.config.mjs
├── package.json
└── .env.example                  # Env var template (secrets in `.env`, gitignored)
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router entry — pages, layouts, API handlers
- Contains: `page.tsx`, `layout.tsx`, `template.tsx`, `route.ts`
- Key files: `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/middleware.ts` (at `src/middleware.ts`)

**`src/app/(app)/`:**
- Purpose: Authenticated product routes behind `requireUser()`
- Contains: Dashboard, edit/import flows, quiz/flashcard play, settings, dev OCR
- Key files: `dashboard/page.tsx`, `edit/new/*`, `edit/quiz/[id]/page.tsx`, `quiz/[id]/page.tsx`, `sets/[id]/*` (legacy redirects)

**`src/app/(auth)/`:**
- Purpose: Unauthenticated auth surfaces
- Contains: Login, signup, logout route handler
- Key files: `login/page.tsx`, `signup/page.tsx`, `logout/route.ts`

**`src/app/api/`:**
- Purpose: Server Route Handlers (privileged operations)
- Contains: AI proxy, embeddings, PDF uploads, study set generation, dev stubs
- Key files: `ai/forward/route.ts`, `study-sets/[id]/generate-from-file/route.ts`, `uploads/pdf/*/route.ts`

**`src/components/`:**
- Purpose: Active UI organized by feature
- Contains: Feature folders + `ui/` primitives (shadcn-style)
- Key files: `layout/AppShell.tsx`, `ai/AiParseSection.tsx`, `dashboard/DashboardHomeClient.tsx`, `edit/new/import/*`

**`src/components-legacy/`:**
- Purpose: Archived components removed from active runtime
- Contains: Old upload/viewer/develop preview batches
- Key files: `LEGACY_COMPONENTS.md` (inventory and migration map)

**`src/lib/server/`:**
- Purpose: Server-only domain logic (env secrets, canonical pipeline)
- Contains: `generateFromFile/*`, `ai-processing-config.ts`, `persistStudySetGeneratedDraft.ts`
- Key files: `generateFromFile/runGenerateItemsFromCanonicalUnits.ts`, `openAiChatCompletion.ts`

**`src/lib/ai/`:**
- Purpose: Client-accessible AI orchestration (parse, vision, OCR, embeddings)
- Contains: Runners (`runSequentialParse.ts`, `runVisionBatchSequential.ts`), prompts, validators
- Key files: `parseChunk.ts`, `visionPrompts.ts`, `embeddingIndexScheduler.ts`

**`src/lib/db/`:**
- Purpose: Data access — primarily Supabase via `studySetDb.ts`; IndexedDB for OCR/parse cache
- Contains: `studySetDb.ts`, `parseCacheDb.ts`, `embeddingIndexDb.ts`
- Key files: `studySetDb.ts` (central study set CRUD)

**`src/lib/pdf/`:**
- Purpose: Client-side PDF processing
- Contains: Text extraction, page classification, image preprocess worker
- Key files: `extractPdfText.ts`, `renderPagesToImages.ts`, `classifyPdfPages.ts`

**`supabase/migrations/`:**
- Purpose: Authoritative database schema
- Contains: Five SQL migration files (core schema, parse progress, storage bucket, canonical cache, generation cache)
- Key files: `20260418_000001_doc2quiz_cloud_first.sql`, `20260430120000_canonical_document_extractions.sql`, `20260430150000_generation_output_cache.sql`

**`scripts/`:**
- Purpose: Build-time asset copy and CI verification
- Contains: `copy-mathjax-assets.mjs`, `copy-pdf-worker.mjs`, `verify-study-set-redirects.ts`, `verify-import-validate.ts`
- Key files: Invoked from `package.json` `postinstall`, `build`, `dev`

**`docs/`:**
- Purpose: Human-written architecture and developer guides
- Contains: `ARCHITECTURE-IMPORT-GENERATION.md`, developer-only AI settings docs
- Key files: Referenced by planners for canonical pipeline behavior

**`example/`:**
- Purpose: Design reference and stitch mocks (not imported by production app)
- Contains: `stitch_doc2quiz/DESIGN.md` and static mock assets
- Key files: Typography/layout reference for dashboard shell migration

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Root redirect to `/dashboard`
- `src/app/(app)/dashboard/page.tsx`: Library home
- `src/middleware.ts`: Supabase session middleware
- `src/app/api/study-sets/[id]/generate-from-file/route.ts`: Canonical generation API

**Configuration:**
- `next.config.ts`: Legacy URL redirects, static cache headers, `serverExternalPackages`
- `tsconfig.json`: Path alias `@/*` → `src/*`
- `src/lib/server/ai-processing-config.ts`: Server AI env (never client-import)
- `src/lib/supabase/env.ts`: Supabase URL/key accessors
- `.env.example`: Documented env var names (actual values in `.env`, not committed)

**Core Logic:**
- `src/lib/db/studySetDb.ts`: Study sets, documents, media assets, approved banks
- `src/lib/server/generateFromFile/`: Canonical extraction, caching, generation
- `src/components/ai/AiParseSection.tsx`: Client parse orchestration (large file)
- `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx`: PDF import UX + upload trigger

**Routing helpers:**
- `src/lib/routes/studySetPaths.ts`: Canonical path builders
- `src/lib/routing/studySetContentKindRedirects.ts`: Content-kind mismatch guards
- `next.config.ts`: Permanent redirects from legacy paths

**Testing:**
- Not detected: no `vitest.config.*`, `jest.config.*`, or `*.test.ts` / `*.spec.ts` files in repo root or `src/`
- Verification scripts: `scripts/verify-study-set-redirects.ts`, `scripts/verify-import-validate.ts`

## Naming Conventions

**Files:**
- App Router pages: `page.tsx`
- App Router layouts: `layout.tsx`
- Segment templates: `template.tsx`
- API handlers: `route.ts` (one per HTTP method export)
- React components: `PascalCase.tsx` (e.g. `DashboardHomeClient.tsx`)
- Client-only pages: often pair `page.tsx` (server) with `*Client.tsx` (e.g. `LoginClient.tsx`)
- Lib modules: `camelCase.ts` for utilities; `run*` prefix for orchestrators (`runSequentialParse.ts`)
- Types: singular domain nouns in `src/types/` (`question.ts`, `studySet.ts`)

**Directories:**
- Route groups: parentheses, omitted from URL — `(app)`, `(auth)`
- Feature colocation: `src/components/<feature>/` mirrors product areas (`dashboard`, `edit/new`, `quiz`)
- Server pipeline: `src/lib/server/generateFromFile/` groups canonical generation modules
- Dynamic routes: bracket segments — `[id]`, `[slug]`

**Imports:**
- Use `@/` alias for all `src/` imports (e.g. `@/lib/utils`, `@/components/ui/button`)
- Never import `src/lib/server/**` from `"use client"` components

## Where to Add New Code

**New authenticated page:**
- Primary code: `src/app/(app)/<segment>/page.tsx`
- Client logic: `src/components/<feature>/<Name>Client.tsx` if the page needs `"use client"`
- Layout (optional): `src/app/(app)/<segment>/layout.tsx`
- Auth: automatic via `src/app/(app)/layout.tsx` → `requireUser()`

**New public/auth page:**
- Primary code: `src/app/(auth)/<segment>/page.tsx`
- Chrome: reuse `src/components/auth/AuthShell.tsx` via `(auth)/layout.tsx`

**New API endpoint:**
- Implementation: `src/app/api/<namespace>/route.ts` or nested `src/app/api/<ns>/[param]/route.ts`
- Shared handler helpers: colocate `_shared.ts` siblings (pattern: `src/app/api/uploads/pdf/_shared.ts`)
- Auth: call `createSupabaseServerClient()` and `getUser()` at start of handler

**Canonical generation / cache change:**
- Primary code: `src/lib/server/generateFromFile/`
- API wiring: `src/app/api/study-sets/[id]/generate-from-file/route.ts`
- Schema migration: new file under `supabase/migrations/` with timestamp prefix
- Docs: update `docs/ARCHITECTURE-IMPORT-GENERATION.md` when pipeline steps change

**Vision / OCR / parse feature:**
- Orchestration: `src/lib/ai/` (new `run*.ts` or extend existing runners)
- UI: `src/components/ai/` (workbench panels, toggles, progress)
- Wire into: `src/components/ai/AiParseSection.tsx` or import flow components under `edit/new/`

**Reusable UI primitive:**
- shadcn-style: `src/components/ui/<component>.tsx`
- App-specific button: `src/components/buttons/` (project uses both `ui/button` and `buttons/button`)

**Shared types:**
- Add or extend: `src/types/<domain>.ts`
- Import from both client and server; keep server secrets out of type files

**URL / redirect:**
- New canonical path: add helper in `src/lib/routes/studySetPaths.ts`
- Legacy alias: add redirect in `next.config.ts` `redirects()`
- Content-kind guard: extend `StudySetProductSurface` in `studySetContentKindRedirects.ts`

**Utilities:**
- Generic helpers: `src/lib/utils.ts` (cn/tailwind merge) or new `src/lib/<area>/` module
- IDs: `src/lib/ids/createRandomUuid.ts`

## Special Directories

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No

**`public/mathjax/es5/`:**
- Purpose: MathJax bundle for `MathText` rendering
- Generated: Yes (`scripts/copy-mathjax-assets.mjs` on postinstall/build/dev)
- Committed: No (placeholder `.gitkeep` only; full bundle copied locally)

**`public/pdf.worker.min.mjs`:**
- Purpose: pdf.js worker for client PDF parsing
- Generated: Yes (`scripts/copy-pdf-worker.mjs` on postinstall)
- Committed: Yes (worker file present in repo)

**`graphify-out/` and `src/graphify-out/`:**
- Purpose: Local graph/analysis cache from tooling
- Generated: Yes
- Committed: Mixed — treat as ephemeral analysis output

**`src/components-legacy/`:**
- Purpose: Archived UI not used in production routes
- Generated: No
- Committed: Yes (intentional archive with `LEGACY_COMPONENTS.md`)

**`.planning/`:**
- Purpose: GSD milestones, phase plans, codebase maps (this folder)
- Generated: By GSD commands
- Committed: Yes

**`.cursor/`:**
- Purpose: Agent orchestrator skills, specialist definitions
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-07-24*
