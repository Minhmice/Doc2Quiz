# Technology Stack

**Analysis Date:** 2026-04-14

## Languages

**Primary:**
- TypeScript (strict) — application logic under `src/` (`tsconfig.json`)
- CSS — Tailwind v4 (compiled via PostCSS) (`src/app/globals.css`, `postcss.config.mjs`)

**Secondary:**
- JavaScript (ESM) — ESLint flat config and Node scripts (`eslint.config.mjs`, `scripts/*.mjs`)

## Runtime

**Environment:**
- Node.js — Next.js dev/build, Route Handlers (`src/app/api/**`)
- Browser — client components (`"use client"`) for PDF rendering, canvas, IndexedDB (`src/lib/pdf/*`, `src/lib/db/studySetDb.ts`)

**Package Manager:**
- npm — scripts in `package.json`; lockfile expected at repo root

## Frameworks

**Core:**
- Next.js `^15.2.4` — App Router (`src/app/**`)
- React `^19.0.0` / React DOM `^19.0.0` — UI runtime (`src/components/**`)

**Testing:**
- Not detected — no Jest/Vitest config and no `*.test.*` / `*.spec.*` found in `src/`

**Build/Dev:**
- Next dev (Turbopack): `next dev --turbopack` (`package.json`)
- ESLint: `eslint` + `eslint-config-next` (`eslint.config.mjs`)

## Key Dependencies

**Critical:**
- `pdfjs-dist` `^4.10.38` — text extraction + page rasterization (`src/lib/pdf/extractPdfText.ts`, `src/lib/pdf/renderPagesToImages.ts`)
- Tailwind CSS `^4` + `@tailwindcss/postcss` `^4` — styling (`postcss.config.mjs`)
- `zod` `^4.3.6` — validation of settings and AI outputs (`src/lib/validations/**`, `src/lib/ai/validate*`)

**Infrastructure:**
- `@vercel/blob` `^2.3.3` — optional public vision-image staging (`src/app/api/ai/vision-staging/*`)
- `@sentry/nextjs` `^9.47.1` — optional client/server error reporting (`sentry.*.config.ts`, `instrumentation.ts`)

## Configuration

**Environment:**
- BYOK is stored in browser `localStorage` (not server env) and forwarded per request (`src/lib/ai/forwardSettings.ts`, `src/app/api/ai/forward/route.ts`)
- Server feature flag: `D2Q_SERVER_PARSE_ENABLED` (`src/lib/serverParse/env.ts`)
- Optional Sentry: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` (`sentry.server.config.ts`, `sentry.client.config.ts`)
- Optional Vercel Blob: `BLOB_READ_WRITE_TOKEN` (`src/app/api/ai/vision-staging/*`, `src/lib/ai/stageVisionDataUrl.ts`)

**Build:**
- `next.config.ts` — redirects; `serverExternalPackages: ["pdfjs-dist"]`
- `tsconfig.json` — strict TS, `@/*` alias → `src/*`
- `eslint.config.mjs` — ignores `.next/**`, `public/pdf.worker.min.mjs`, `public/mathjax/**`
- `postcss.config.mjs` — Tailwind v4 via `@tailwindcss/postcss`

## Platform Requirements

**Development:**
- Node.js + npm
- Browser environment with IndexedDB available (`src/lib/db/studySetDb.ts`)

**Production:**
- Node host for `next start` or Next-compatible deployment. Optional Vercel Blob and Sentry integration when env vars are set.

---

*Stack analysis: 2026-04-14*
