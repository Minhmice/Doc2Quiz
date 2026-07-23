# Coding Conventions

**Analysis Date:** 2026-07-24

## Naming Patterns

**Files:**
- React components: **PascalCase** filenames with `.tsx` extension — e.g. `QuestionEditor.tsx`, `ApiStatusIndicator.tsx` in `src/components/`.
- Hooks: **`use` + PascalCase** in camelCase filename — e.g. `useStudySetProductSurfaceRedirect.ts`, `useDashboardHome.ts`. One exception uses kebab-case: `use-is-in-view.tsx`.
- Library modules: **camelCase** filenames — e.g. `validateStrictGenerated.ts`, `pipelineLogger.ts`, `studySetDb.ts` under `src/lib/`.
- Route segments: **kebab-case** in `src/app/` — e.g. `generate-from-file`, `processing-status`.
- Types: domain files in `src/types/` — e.g. `question.ts`, `visionParse.ts`, `studySet.ts` (camelCase file, PascalCase exported types).
- Validation schemas: `src/lib/validations/*.ts` and `src/lib/server/generateFromFile/*Schemas.ts`.

**Functions:**
- **camelCase** for functions and methods — e.g. `validateStrictQuizQuestions`, `mismatchHrefForSurface`, `pipelineLog`, `requireUser`.
- **PascalCase** only for React components and component-local variant helpers — e.g. `Button`, `QuestionEditor`, `buttonVariants`.
- Async route handlers: named HTTP verbs — `export async function POST(req: Request)` in `src/app/api/**/route.ts`.

**Variables:**
- **camelCase** for locals and parameters — e.g. `studySetId`, `correctIndex`, `parsed`.
- **SCREAMING_SNAKE_CASE** for module-level constants — e.g. `MAX_IMAGE_BYTES` in `src/components/review/QuestionEditor.tsx`, `FOCUS_CHECK_MIN_MS` in `src/components/layout/ApiStatusIndicator.tsx`, `LS_LAST_AI_REACHABILITY` in `src/lib/ai/aiReachability.ts`.
- Boolean state often prefixed with `is` / `has` — e.g. `isPipelineVerbose`, `isAiProcessingConfigured`.

**Types:**
- Domain types: **PascalCase** — e.g. `Question`, `FlashcardVisionItem`, `StudyContentKind`, `PipelineDomain`.
- Form/schema inferred types: suffix **`FormValues`** or descriptive name — e.g. `QuestionEditorFormValues` from `z.infer<typeof questionEditorSchema>` in `src/lib/validations/question.ts`.
- Props types: **`ComponentNameProps`** — e.g. `QuestionEditorProps` in `src/components/review/QuestionEditor.tsx`.
- Discriminated result unions: **`{ ok: true } | { ok: false; error: string }`** — used in `src/lib/server/generateFromFile/validateStrictGenerated.ts` and parse flows in `src/components/ai/AiParseSection.tsx`.

## Code Style

**Formatting:**
- **No Prettier config** detected. Formatting is implicit via ESLint + TypeScript + editor defaults.
- **Semicolons are mixed** — many `src/lib/` and API files use semicolons; several `src/components/ui/` primitives omit them (e.g. `src/lib/utils.ts`, `src/components/ui/button.tsx`). Match the surrounding file when editing.
- **Double quotes** dominate string literals in TypeScript/TSX.
- Numeric separators allowed — e.g. `1_500_000`, `60_000`.

**Linting:**
- **ESLint 10** flat config in `eslint.config.mjs`.
- Extends **`next/core-web-vitals`** and **`next/typescript`** via `@eslint/eslintrc` `FlatCompat`.
- Ignored paths: `.next/**`, `node_modules/**`, `public/pdf.worker.min.mjs`, `public/mathjax/**`, `next-env.d.ts`.
- Run: `npm run lint` (invokes `eslint` directly, not `next lint`).

**TypeScript:**
- **`strict: true`** in `tsconfig.json`.
- Path alias: **`@/*` → `./src/*`**. Prefer `@/lib/...`, `@/components/...`, `@/types/...` over deep relative imports from `src/`.
- Target `ES2017`, `moduleResolution: "bundler"`, `jsx: "preserve"`.

## Import Organization

**Order:**
1. **External packages** (React, Next.js, third-party) — e.g. `next/server`, `react`, `zod`, `@base-ui/react`.
2. **Blank line**
3. **Internal `@/` aliases** — grouped by layer: `@/lib/`, `@/types/`, `@/components/`.

**Path Aliases:**
- `@/*` maps to `./src/*` (see `tsconfig.json` `paths`).

**Barrel re-exports:**
- Use sparingly. `src/components/buttons/index.ts` re-exports `Button` from `./button` for a stable import path (`@/components/buttons/button` is also used directly in feature code).

**Example (client component):**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { putMediaBlob } from "@/lib/db/studySetDb";
import type { Question } from "@/types/question";
import { questionEditorSchema } from "@/lib/validations/question";
import { Button } from "@/components/buttons/button";
```

Pattern from `src/components/review/QuestionEditor.tsx`.

## Server vs Client Components

- **Default:** Server Components in the App Router (`src/app/`).
- Add **`"use client"`** as the **first statement** when the module uses browser APIs, React client hooks (`useState`, `useEffect`, `useRouter`, etc.), or client event handlers — e.g. `src/components/review/QuestionEditor.tsx`, `src/hooks/useStudySetProductSurfaceRedirect.ts`.
- Server-only auth: `requireUser()` in `src/lib/supabase/auth-guard.ts` uses `redirect()` from `next/navigation` on the server.

## Error Handling

**Patterns:**

**1. Discriminated `ok` results (pure validation):**

```typescript
export function validateStrictQuizQuestions(
  questions: Question[],
): { ok: true } | { ok: false; error: string } {
  // return { ok: false, error: "..." } on failure
  return { ok: true };
}
```

Use in `src/lib/server/generateFromFile/validateStrictGenerated.ts`, `src/lib/ai/validateVisionQuizItems.ts`, and similar validators. Callers branch on `.ok` before persisting.

**2. API route HTTP errors:**

Return `NextResponse.json({ error: string }, { status: number })` — e.g. `401` unauthorized, `400` invalid body, `502` upstream failure, `503` service unavailable in `src/app/api/ai/embed/route.ts`. Authenticate via Supabase `getUser()` before processing.

**3. Upstream AI / HTTP body sanitization:**

Use `describeBadAiResponse(status, bodyText)` and `responseLooksLikeHtml(text)` from `src/lib/ai/upstreamErrors.ts` to avoid dumping HTML error pages into the UI.

**4. Unknown thrown values:**

Normalize with `normalizeUnknownError(err)` from `src/lib/logging/pipelineLogger.ts` before logging structured context.

**5. User-facing toasts:**

Use `toast.success` / `toast.error` from **sonner** in client components — e.g. `src/components/review/QuestionEditor.tsx`.

**6. Redirect guards:**

Server layouts/pages call `requireUser()`; client surfaces use `useStudySetProductSurfaceRedirect` (`src/hooks/useStudySetProductSurfaceRedirect.ts`) with `router.replace` when content kind mismatches the route.

**7. Async cleanup in effects:**

Use `let cancelled = false` + check before `setState` — pattern in `src/hooks/useStudySetProductSurfaceRedirect.ts`.

## Logging

**Framework:** Structured **`console`** via `pipelineLog` in `src/lib/logging/pipelineLogger.ts`.

**Patterns:**
- Prefix: `[DOMAIN][stage]` where `DOMAIN` is `PDF | OCR | VISION | IDB | STUDY_SET | MAPPING | PARSE`.
- **`info`**: only when `NODE_ENV === "development"` or `NEXT_PUBLIC_D2Q_PIPELINE_DEBUG === "1"`.
- **`warn` / `error`**: always emitted.
- Vision events: `visionPipelineEvent()` flattens `VisionPipelineEvent` into info logs.
- Do not use `pipelineLog` for routine UI events; reserve for PDF intake, OCR, vision, IDB, and parse pipelines.

**Error tracking:** **Sentry** (`@sentry/nextjs`) configured in `sentry.client.config.ts` and `sentry.server.config.ts`. Enabled only when `NEXT_PUBLIC_SENTRY_DSN` is set. `beforeSend` must not attach PDF bytes or API keys.

## Validation

**Zod** (`zod` ^4) is the standard schema library.

- **Form validation:** `src/lib/validations/` — e.g. `questionEditorSchema` in `question.ts`, paired with **react-hook-form** + `@hookform/resolvers/zod` (`zodResolver`).
- **Server generation payloads:** `src/lib/server/generateFromFile/schemas.ts`, `canonicalUnitSchemas.ts`.
- **Post-parse strict checks:** imperative validators in `validateStrictGenerated.ts` (complement Zod, do not replace for persistence gates).

Export inferred types with `z.infer<typeof schema>`.

## UI Conventions

**Primitives:** `src/components/ui/` — built on **@base-ui/react**, styled with **class-variance-authority** (`cva`) and **`cn()`** from `src/lib/utils.ts` (`clsx` + `tailwind-merge`).

**Feature components:** `src/components/{feature}/` — e.g. `review/`, `quiz/`, `ai/`, `dashboard/`, `layout/`.

**Buttons:** Import from `@/components/buttons/button` or `@/components/buttons` — do not duplicate button styling in feature code.

**Styling:** Tailwind CSS v4 (`tailwindcss` ^4, `@tailwindcss/postcss`).

**Images from IndexedDB / blob URLs:** Use `<img>` with a targeted eslint exception — `// eslint-disable-next-line @next/next/no-img-element` plus short justification (see `src/components/media/StoredImage.tsx`, `src/components/quiz/QuizSession.tsx`). Do not use `next/image` for dynamic blob/object URLs.

**Stable automation hooks:** Add explicit `data-testid` when automation needs a contract — e.g. `data-testid="doc2quiz-api-status-trigger"` in `src/components/layout/ApiStatusIndicator.tsx`. Do not rely on auto-generated Base UI internal ids.

## Data & Persistence

- **IndexedDB** is the primary client store for study-set lifecycle — `src/lib/db/studySetDb.ts`, `parseCacheDb.ts`, `embeddingIndexDb.ts`, `ocrDb.ts`.
- **localStorage** for small prefs and flags — e.g. AI reachability in `src/lib/ai/aiReachability.ts`, keys in `src/types/studySet.ts`.
- **Supabase** for auth and server-backed features — clients in `src/lib/supabase/browser.ts`, `server.ts`, session refresh in `src/middleware.ts` via `src/lib/supabase/middlewareClient.ts`.
- New durable study-set state should follow existing IDB patterns; avoid parallel ad hoc storage.

## Comments

**When to Comment:**
- Non-obvious business rules, pipeline phase markers, and security constraints.
- File-level JSDoc on modules with external contracts — e.g. `src/lib/logging/pipelineLogger.ts`, `src/lib/ai/upstreamErrors.ts`.
- Phase references in config — e.g. `next.config.ts` redirect comments.

**JSDoc/TSDoc:**
- Use on exported hooks and guards explaining return semantics — e.g. `@returns true when safe to render` on `useStudySetProductSurfaceRedirect`.
- Use on domain types when lanes must not be confused — e.g. `Question` vs flashcard types in `src/types/question.ts`.
- Avoid narrating obvious code.

## Function Design

**Size:** Large orchestration files exist in the AI parse lane (e.g. `src/components/ai/AiParseSection.tsx`). Prefer extracting pure helpers into `src/lib/ai/` or `src/lib/pdf/` rather than growing UI files further.

**Parameters:** Prefer explicit typed objects for complex inputs (`QuestionEditorProps`, API `Body` types in route handlers). Use `string | undefined` for optional route params and guard early.

**Return Values:**
- Pure validators: discriminated `{ ok }` unions.
- API routes: `NextResponse` or `NextResponse.json`.
- Hooks that gate rendering: `boolean` ready flag — `useStudySetProductSurfaceRedirect` returns `true` when safe to render.

## Module Design

**Exports:** Named exports preferred — `export function`, `export type`, `export const schema`. Default exports used for Next.js pages/layouts and `next.config.ts`.

**Barrel Files:** Minimal — `src/components/buttons/index.ts`, `src/lib/learning/index.ts`. Do not add barrels unless there is an established import path to preserve.

**Legacy code:** `src/components-legacy/` holds develop/preview batches; do not extend for new product features.

## ESLint Exceptions

When disabling rules, use **line-scoped** comments with justification:

```typescript
// eslint-disable-next-line @next/next/no-img-element -- object URL from IndexedDB blob
```

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
```

Seen in `src/components/media/StoredImage.tsx`, `src/components/animate-ui/icons/icon.tsx`. Never blanket-disable rules at file level without strong reason.

---

*Convention analysis: 2026-07-24*
