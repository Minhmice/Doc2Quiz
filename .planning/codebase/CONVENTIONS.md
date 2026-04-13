# Doc2Quiz — project conventions

This document reflects the **current** repository layout and tooling (Next.js App Router, TypeScript, Tailwind CSS v4). It is not a product spec.

## Stack and versions

- **Framework:** Next.js 15 (`next` ^15.2.4), **React 19**, App Router under `src/app/`.
- **Styling:** Tailwind CSS v4 (`tailwindcss` ^4, `@tailwindcss/postcss` ^4).
- **Lint:** ESLint 9 flat config extending **eslint-config-next** presets (`next/core-web-vitals`, `next/typescript`). Entry: `eslint.config.mjs` (uses `@eslint/eslintrc` `FlatCompat`). **Ignored paths** include `.next/`, `node_modules/`, `public/pdf.worker.min.mjs`, `public/mathjax/**`, `next-env.d.ts`.
- **Scripts:** `npm run dev` (Turbopack), `npm run build`, `npm run lint` (runs `eslint` directly — not `next lint`).

## TypeScript and imports

- **Strict mode** enabled (`strict: true` in `tsconfig.json`).
- **Path alias:** `@/*` maps to `./src/*` (see `tsconfig.json` `paths`). Prefer `@/components/...`, `@/lib/...`, `@/types/...` over deep relative imports from `src/`.

## `src/` layout (high level)

| Area | Role |
|------|------|
| `src/app/` | Routes, layouts, route groups (e.g. `(app)`), `page.tsx` / `layout.tsx`, redirects. Root `page.tsx` redirects to `/dashboard`. |
| `src/components/` | Feature UI (`dashboard/`, `play/`, `sets/`, `layout/`, `ai/`, …) and shared building blocks. |
| `src/components/ui/` | **Design-system primitives** (see below). |
| `src/lib/` | PDF ingestion, AI clients, **IndexedDB** (`lib/db/`), logging, utilities (`utils.ts`, `cn`). |
| `src/types/` | Shared domain types and constants (questions, study sets, parse/OCR types). |

Naming is mostly **PascalCase** for React components/files (`.tsx`), **camelCase** for functions and variables, **kebab-case** for route segments where the filesystem requires it.

## Server vs client components

- Default in the App Router is **Server Components**.
- Any file that uses browser-only APIs, React client hooks (`useState`, `useEffect`, …), or event handlers on client-owned subtrees should be a **Client Component** with the directive **`"use client"`** as the first statement in the module.

## Data and persistence (local-first)

- **IndexedDB** is the primary store for study-set lifecycle data (documents, drafts, media, OCR artifacts, etc.). Core access lives in `src/lib/db/studySetDb.ts` (and related modules such as `ocrDb.ts`, migration helpers).
- **localStorage** is still used for smaller or legacy-adjacent concerns (for example AI provider settings, reachability snapshots, OCR tab prefs, migration flags like `LS_IDB_MIGRATED` in `src/types/studySet.ts`). New durable study-set state should follow existing IDB patterns rather than inventing parallel storage.

## UI layer: `src/components/ui`

- Primitives are built on **@base-ui/react** (e.g. `Button` wraps `@base-ui/react/button`), styled with **class-variance-authority** (`cva`) and **`cn`** from `@/lib/utils` (typically `clsx` + `tailwind-merge`).
- Treat these as the **canonical** controls for dialogs, tooltips, inputs, etc., instead of ad hoc HTML in feature code.
- The repo also lists **`shadcn`** as a dev dependency for scaffolding; the implemented primitives in `ui/` follow the Base UI + Tailwind pattern above.

## ESLint habits

- Follow **Next.js + TypeScript** rules from the extended presets; repo-specific ignores cover generated or vendor assets under `public/`.
- When an exception is required (for example `<img>` for blob URLs from IndexedDB), use a **targeted** `eslint-disable-next-line` with a short justification, matching existing files.

## Optional / adjacent tooling

- **Sentry** (`@sentry/nextjs`) and **Vercel Blob** appear in `package.json` for deployment or uploads as configured in the project; they do not change the above source-layout or UI conventions.
