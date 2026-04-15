# Codebase Structure

**Analysis Date:** 2026-04-14

## Directory Layout

```
[project-root]/
├── src/                     # Next.js app code (App Router)
│   ├── app/                 # Routes, layouts, and Route Handlers
│   ├── components/          # Reusable UI + feature components
│   ├── lib/                 # Domain logic + pipeline utilities
│   ├── hooks/               # Shared React hooks
│   └── types/               # Shared TypeScript types/contracts
├── public/                  # Static assets served by Next
├── scripts/                 # Postinstall helpers
├── next.config.ts           # Next config (redirects, externals)
├── tsconfig.json            # TypeScript config + path aliases
├── eslint.config.mjs        # ESLint flat config
└── postcss.config.mjs       # Tailwind PostCSS plugin
```

## Directory Purposes

**`src/app/`:**
- Purpose: route ownership (UI pages/layouts) + server Route Handlers
- Contains: `page.tsx`, `layout.tsx`, `route.ts`
- Key files: `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/api/**`

**`src/components/`:**
- Purpose: feature UI and reusable primitives
- Contains:
  - `src/components/ai/` parse orchestration UI
  - `src/components/review/` quiz review editor UI
  - `src/components/quiz/` quiz session UI
  - `src/components/flashcards/` flashcard session + review UI
  - `src/components/ui/` base primitives (shadcn-style)

**`src/lib/`:**
- Purpose: pipeline + domain logic; keep most modules framework-agnostic except where noted
- Contains:
  - `src/lib/pdf/` pdf.js text extraction and rasterization
  - `src/lib/ai/` parsing pipelines (vision/OCR/chunk), prompts, staging, forwarding helpers
  - `src/lib/db/` IndexedDB access and migrations
  - `src/lib/routes/` path builders

**`src/types/`:**
- Purpose: shared contracts and canonical data models
- Key files: `src/types/studySet.ts`, `src/types/visionParse.ts`, `src/types/flashcardGeneration.ts`, `src/types/question.ts`

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: redirects `/` → `/dashboard`
- `src/app/(app)/dashboard/page.tsx`: dashboard entry

**Configuration:**
- `package.json`: scripts and dependencies
- `next.config.ts`: redirects, `serverExternalPackages`
- `tsconfig.json`: strict TS + `@/*` alias → `src/*`
- `eslint.config.mjs`: ESLint config + ignores
- `postcss.config.mjs`: Tailwind PostCSS plugin
- `sentry.client.config.ts`, `sentry.server.config.ts`, `instrumentation.ts`: optional Sentry initialization

**Core Logic:**
- IndexedDB: `src/lib/db/studySetDb.ts`
- PDF: `src/lib/pdf/extractPdfText.ts`, `src/lib/pdf/renderPagesToImages.ts`
- Vision batch parsing: `src/lib/ai/runVisionBatchSequential.ts`
- Flashcard prompt contract: `src/lib/ai/visionPrompts.ts`

**API Routes (Route Handlers):**
- AI forward: `src/app/api/ai/forward/route.ts`
- Vision staging: `src/app/api/ai/vision-staging/route.ts`, `src/app/api/ai/vision-staging/[id]/route.ts`
- Parse-jobs stub: `src/app/api/parse-jobs/route.ts`, `src/app/api/parse-jobs/[id]/route.ts`

## Naming Conventions

**Files:**
- Routes: `page.tsx`, `layout.tsx`, `route.ts` under `src/app/**`
- Components: `PascalCase.tsx` for exported components (common under `src/components/**`)
- Utilities/libs: `camelCase.ts` or descriptive `kebab-case.ts` is present; prefer matching existing folder norms

**Directories:**
- Route groups use parentheses: `src/app/(app)/...`
- Feature grouping: `src/components/<feature>/`, `src/lib/<domain>/`

## Where to Add New Code

**New route/page:**
- Add under `src/app/(app)/...` (UI) or `src/app/api/...` (server Route Handler)

**New reusable component:**
- Feature component: `src/components/<feature>/...`
- Primitive: `src/components/ui/...`

**New pipeline helper:**
- Vision/OCR/parse logic: `src/lib/ai/...`
- PDF helpers: `src/lib/pdf/...`
- Storage: `src/lib/db/...`

## Special Directories

**`.next/`:**
- Purpose: Next build output
- Generated: Yes
- Committed: No (should be ignored)

**`.planning/`:**
- Purpose: planning and codebase mapping artifacts
- Generated: Yes (by workflow)
- Committed: depends on workflow conventions

---

*Structure analysis: 2026-04-14*
