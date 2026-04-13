# Codebase Structure

**Analysis Date:** 2026-04-13

## Directory layout (project root)

```
Doc2Quiz/
├── public/                 # Static assets: pdf.worker.min.mjs, mathjax/es5 (postinstall copies)
├── scripts/                # copy-pdf-worker.mjs, copy-mathjax-assets.mjs
├── src/
│   ├── app/                # Next.js App Router: layouts, pages, API routes, globals.css
│   ├── components/         # React UI by feature + shared ui/
│   ├── lib/                # Domain logic: ai, db, pdf, review, validations, …
│   └── types/              # Shared TypeScript types
├── docs/                   # Architecture notes, BYOK, scale mode, parse contracts
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── sentry.client.config.ts
├── sentry.server.config.ts
└── tsconfig.json
```

## Parse pipeline — file pointers (quick nav)

| Concern | Path |
|--------|------|
| User Parse / Cancel, strategy routing | `src/components/ai/AiParseSection.tsx` |
| Parse / Cancel buttons | `src/components/ai/AiParseActions.tsx` |
| Route policy (text char hint vs layout vs vision intent) | `src/lib/ai/parseRoutePolicy.ts` |
| PDF → JPEG data URLs (caps, abort, per-page callback) | `src/lib/pdf/renderPagesToImages.ts` |
| Sequential vision: attach / single / overlapping pairs | `src/lib/ai/runVisionSequential.ts` |
| One vs two `image_url` per chat request | `src/lib/ai/parseVisionPage.ts` |
| Data URL → staging URL client | `src/lib/ai/stageVisionDataUrl.ts` |
| Staging store limits (memory fallback) | `src/lib/ai/visionStagingStore.ts` |
| Staging POST / GET routes | `src/app/api/ai/vision-staging/route.ts`, `src/app/api/ai/vision-staging/[id]/route.ts` |
| Same-origin AI proxy | `src/lib/ai/sameOriginForward.ts`, `src/app/api/ai/forward/route.ts` |
| Native text at ingest | `src/lib/pdf/extractPdfText.ts`, `src/app/(app)/sets/new/NewStudySetPdfImportFlow.tsx` |
| OCR prefetch | `src/lib/ai/runOcrSequential.ts`, `src/lib/ai/ocrAdapter.ts` |
| Layout chunks + chunk text parse | `src/lib/ai/runLayoutChunkParse.ts`, `src/lib/ai/parseChunk.ts`, `src/lib/ai/layoutChunksFromOcr.ts` |
| Batch vision (attach off, quiz path) | `src/lib/ai/runVisionBatchSequential.ts`, `src/lib/ai/visionBatching.ts` |
| Question dedupe after vision | `src/lib/ai/dedupeQuestions.ts` |

## `src/app/` — Routes and entry points

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout: fonts, `globals.css`, `AppRootProviders`. |
| `src/app/page.tsx` | `/` → redirects to `/dashboard`. |
| `src/app/globals.css` | Tailwind / design tokens entry. |
| `src/app/(app)/layout.tsx` | App shell providers (`AppProviders`). |
| `src/app/(app)/dashboard/page.tsx` | Library / dashboard. |
| `src/app/(app)/settings/page.tsx` | Settings (AI provider / forward configuration UI). |
| `src/app/(app)/sets/new/page.tsx` | Create new study set. |
| `src/app/(app)/sets/[id]/layout.tsx` | Per-set layout: width + `StepProgressBar`. |
| `src/app/(app)/sets/[id]/source/page.tsx` | **Parse hub:** PDF info, `AiParseSection`, OCR/mapping tools. |
| `src/app/(app)/sets/[id]/review/page.tsx` | Review and edit draft questions. |
| `src/app/(app)/sets/[id]/play/page.tsx` | Quiz play session. |
| `src/app/(app)/sets/[id]/practice/page.tsx` | **Redirect only** → `/sets/[id]/play`. |
| `src/app/(app)/sets/[id]/flashcards/page.tsx` | Flashcard session. |
| `src/app/(app)/sets/[id]/done/page.tsx` | Completion step. |
| `src/app/(app)/sets/[id]/parse/page.tsx` | Redirect only → `…/source`. |
| `src/app/api/ai/forward/route.ts` | Same-origin AI proxy. |
| `src/app/api/ai/vision-staging/route.ts` | Register `data:` URL → staging URL. |
| `src/app/api/ai/vision-staging/[id]/route.ts` | Serve staged image (Blob redirect or memory bytes). |
| `src/app/api/ai/vision-test-image/route.ts` | Fixed PNG for tests. |
| `src/app/api/parse-jobs/route.ts` | Phase 15 stub: capability GET + POST placeholder. |
| `src/app/api/parse-jobs/[id]/route.ts` | Phase 15 stub: job status placeholder. |

## `src/components/` — UI modules

| Directory | Purpose |
|-----------|---------|
| `src/components/ai/` | Parse orchestration: `AiParseSection`, progress overlays, estimates, OCR inspector, previews, preference toggles. |
| `src/components/dashboard/` | Library widgets, stats, rename dialog. |
| `src/components/flashcards/` | Flashcard session. |
| `src/components/layout/` | `AppShell`, top bar, command palette, step progress, parse progress strip, providers, API status. |
| `src/components/math/` | `MathText`, barrel — MathJax-backed rendering. |
| `src/components/media/` | `StoredImage` — IDB media blobs. |
| `src/components/play/` | Quiz play session. |
| `src/components/providers/` | `app-root-providers.tsx` — root provider composition. |
| `src/components/review/` | Question cards, editors, review section. |
| `src/components/settings/` | `AiProviderForm` and related settings UI. |
| `src/components/ui/` | Reusable primitives (button, dialog, tabs, …). |
| `src/components/upload/` | PDF upload and info card. |
| `src/components/viewer/` | Raw text viewer. |

## `src/lib/` — Non-UI logic

| Path | Purpose |
|------|---------|
| `src/lib/ai/` | Chunking, parse/vision/OCR runners, forward client, staging, dedupe, validate, capabilities, estimates, prompts. |
| `src/lib/db/` | `studySetDb.ts` (IndexedDB), `migrateLegacyLocalStorage.ts`. |
| `src/lib/pdf/` | pdf.js worker, **extractPdfText**, render to images, validation. |
| `src/lib/review/` | Draft/approved bank, MCQ validation and diagnostics. |
| `src/lib/learning/` | Barrel for learning-facing read helpers (see `docs/ARCHITECTURE-domain-boundaries.md`). |
| `src/lib/studySet/` | PDF file reconstruction, activity tracking. |
| `src/lib/validations/` | Zod schemas (e.g. AI settings). |
| `src/lib/logging/` | `pipelineLogger.ts`. |
| `src/lib/observability/` | `reportPipelineError.ts`. |
| `src/lib/math/` | Math segment splitting for rendering. |
| `src/lib/serverParse/` | `env.ts` — server parse queue flag. |
| `src/lib/ids/` | `createRandomUuid.ts`. |
| `src/lib/utils.ts` | `cn()` and small helpers. |
| `src/lib/appEvents.ts` | Lightweight app events for shell/search. |

## `src/types/`

| File | Purpose |
|------|---------|
| `src/types/studySet.ts` | `StudySetMeta`, `StudySetDocumentRecord`, **`DB_VERSION`**, `DB_NAME`, parse progress phases. |
| `src/types/question.ts` | `Question`, provider enums, **`localStorage` key constants** (legacy + forward triple). |
| `src/types/ocr.ts` | OCR run/page/block types. |
| `src/types/flashcardSession.ts` | Flashcard session typing. |
| `src/types/parseJob.ts` | Server parse-job types for Phase 15 API contract. |

## Naming conventions

- **Routes:** Next conventions — `page.tsx`, `layout.tsx`, `route.ts`.
- **Components:** PascalCase (`AiParseSection.tsx`).
- **Libraries:** camelCase modules (`extractPdfText.ts`, `studySetDb.ts`).
- **Imports:** Prefer `@/` → `src/` (`tsconfig.json` `paths`).

## Where to add new code

| Change | Primary location |
|--------|------------------|
| New page inside app shell | `src/app/(app)/…/page.tsx` |
| New AI transport or staging behavior | `src/app/api/ai/*/route.ts` + client/helpers in `src/lib/ai/` |
| New IDB store or schema bump | `src/types/studySet.ts` + `src/lib/db/studySetDb.ts` (`onupgradeneeded`) |
| New parse stage or prompt | `src/lib/ai/` + wire from `src/components/ai/AiParseSection.tsx` |
| New reusable control | `src/components/ui/` |
| New study step in the wizard | `src/components/layout/StepProgressBar.tsx` + new `page.tsx` under `sets/[id]/` |
| Learning-only read helper safe for review/play/flashcards | Prefer `src/lib/learning/index.ts` re-exports per `docs/ARCHITECTURE-domain-boundaries.md` |

## Generated / copied artifacts

- `public/pdf.worker.min.mjs` — copied on `postinstall`; ESLint-ignored.
- `public/mathjax/es5/**` — copied from `node_modules/mathjax` on `postinstall`; ESLint-ignored.
- `.next/` — build output (not source of truth).

---

*Structure analysis: 2026-04-13*
