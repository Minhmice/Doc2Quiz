# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**

- TypeScript (strict) — application logic under `src/`
- CSS — Tailwind v4 via `src/app/globals.css` and PostCSS

**Secondary:**

- JavaScript — ESLint flat config (`eslint.config.mjs`), Node ESM scripts under `scripts/` (`copy-pdf-worker.mjs`, `copy-mathjax-assets.mjs`)

## Runtime

**Environment:**

- Node.js — Next.js dev/build/server Route Handlers
- Browsers — client components (`"use client"`) for PDF, IndexedDB, canvas, MathJax-loaded rendering

**Package Manager:**

- npm — `package-lock.json` at repository root
- `package.json`: `private: true`, version `0.1.0`

## Frameworks

**Core:**

- Next.js `^15.2.4` — App Router (`src/app/`), Route Handlers under `src/app/api/`
- React `^19.0.0` / `react-dom` `^19.0.0`

**UI:**

- Tailwind CSS `^4` with `@tailwindcss/postcss` (`postcss.config.mjs`)
- Component primitives — `class-variance-authority`, `tailwind-merge`, `clsx`, `lucide-react`, `@base-ui/react`, patterns in `src/components/ui/`
- Theming — `next-themes`
- Forms — `react-hook-form`, `@hookform/resolvers`, `zod` `^4.3.6`
- Toasts — `sonner`
- Command palette — `cmdk`
- Animation utilities — `tw-animate-css`
- CLI scaffolding package — `shadcn` (dependency present; UI built from shared primitives above)

**Document & math rendering:**

- `pdfjs-dist` `^4.10.38` — PDF open, text layer, canvas rasterization for vision/OCR paths (`next.config.ts`: `serverExternalPackages: ["pdfjs-dist"]`)
- `mathjax` `^3.2.2` — client-side math rendering; ES5 bundle copied to `public/mathjax/es5` by `npm run copy-mathjax` / `postinstall`

**Testing:**

- Not detected — no `*.test.*` / `*.spec.*` under `src/` and no Jest/Vitest config in repo root

**Build / Dev:**

- `npm run dev` — `next dev --turbopack`
- `npm run build` — `next build`
- `npm run start` — `next start`
- `npm run lint` — `eslint` (flat config extending `next/core-web-vitals`, `next/typescript`)
- `npm run copy-mathjax` — `node scripts/copy-mathjax-assets.mjs`
- `postinstall` — `node scripts/copy-pdf-worker.mjs && node scripts/copy-mathjax-assets.mjs` (worker to `public/pdf.worker.min.mjs`, MathJax to `public/mathjax/es5`)

## Key Dependencies

**Critical:**

- `next`, `react`, `react-dom` — shell and rendering
- `pdfjs-dist` — ingestion (`src/lib/pdf/`)
- `zod` — validation (`src/lib/validations/`)

**Infrastructure / optional remote:**

- `@vercel/blob` — optional public blob upload path in `src/app/api/ai/vision-staging/route.ts` when `BLOB_READ_WRITE_TOKEN` is set
- `@sentry/nextjs` — optional capture from `src/lib/observability/reportPipelineError.ts` when DSN/runtime is configured (`sentry.client.config.ts`, `sentry.server.config.ts`)

## TypeScript Configuration

**File:** `tsconfig.json`

- `strict: true`, `noEmit: true`, `jsx: "preserve"`
- `module` / `moduleResolution`: `esnext` / `bundler`
- `target`: `ES2017`; `lib`: `dom`, `dom.iterable`, `esnext`
- Path alias: `"@/*"` → `./src/*`
- Next plugin: `"plugins": [{ "name": "next" }]`
- Includes `.next/types/**/*.ts` for generated route types

## Build / Configuration Files

- `next.config.ts` — `serverExternalPackages: ["pdfjs-dist"]` (no `withSentryConfig` wrapper in-repo; see `README.md`)
- `postcss.config.mjs` — `@tailwindcss/postcss` only
- `eslint.config.mjs` — ignores `.next/`, `node_modules/`, `public/pdf.worker.min.mjs`, `public/mathjax/**`, `next-env.d.ts`

## Platform Requirements

**Development:**

- Node compatible with Next 15; `npm install`; `npm run dev` on default Next port

**Production:**

- Node host for `next start` or Vercel-style Next deployment; optional Blob + Sentry env for staging and observability (documented in `README.md`)

---

*Stack analysis: 2026-04-11*
