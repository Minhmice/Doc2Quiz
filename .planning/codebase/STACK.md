# Technology Stack

**Analysis Date:** 2026-07-24

## Languages

**Primary:**

- **TypeScript 7** (`typescript` `^7`, lockfile resolves `7.0.2`) — all application code under `src/` with `strict: true` in `tsconfig.json`
- **CSS** — Tailwind CSS v4 utility classes and design tokens in `src/app/globals.css`

**Secondary:**

- **JavaScript (ESM)** — Node build scripts (`scripts/*.mjs`), ESLint flat config (`eslint.config.mjs`), PostCSS config (`postcss.config.mjs`)

## Runtime

**Environment:**

- **Node.js ≥ 20.9.0** — required by Next.js 16 (`package-lock.json` → `node_modules/next` `engines.node`)
- **Browser** — client components for PDF import, AI parse UI, quiz/flashcard practice, IndexedDB-backed caches

**Package Manager:**

- **npm** — `package.json` at repo root
- Lockfile: **present** (`package-lock.json`, lockfileVersion 3)

## Frameworks

**Core:**

- **Next.js 16.2.11** (`next` `^16.2.11`) — App Router (`src/app/**`), Route Handlers (`src/app/api/**`), middleware (`src/middleware.ts`)
- **React 19.2.8** (`react`, `react-dom`) — UI in `src/components/**`

**UI / Styling:**

- **Tailwind CSS 4** (`tailwindcss` `^4`, `@tailwindcss/postcss`) — PostCSS pipeline in `postcss.config.mjs`
- **shadcn/ui v4** (`shadcn` `^4.14.1`, `components.json` style `base-nova`) — components in `src/components/ui/**`
- **Base UI** (`@base-ui/react`) — headless primitives
- **class-variance-authority**, **clsx**, **tailwind-merge** — component variants and class merging (`src/lib/utils.ts`)
- **cmdk** — command palette (`src/components/layout/CommandPalette.tsx`)
- **lucide-react** — icons
- **framer-motion** / **motion** — animations
- **next-themes** — light/dark theme switching
- **sonner** — toast notifications
- **tw-animate-css** — animation utilities imported in `globals.css`

**Forms & Validation:**

- **react-hook-form** `^7.82.0` — form state
- **zod** `^4.4.3` — runtime schema validation
- **@hookform/resolvers** — bridges zod to react-hook-form

**Testing:**

- **Not detected** — no Jest, Vitest, or Playwright config in repo
- Manual verification scripts instead: `scripts/verify-study-set-redirects.ts`, `scripts/verify-import-validate.ts`, `scripts/eval-export-smoke.mjs`

**Build/Dev:**

- **Next.js built-in bundler** — `next dev`, `next dev --turbopack` (`dev:turbo` script), `next build`, `next start`
- **ESLint 10** + **eslint-config-next 16** — `npm run lint` (`eslint.config.mjs`)
- **tsx** (via `npx --yes tsx`) — ad-hoc TypeScript script execution

## Key Dependencies

**Critical:**

| Package | Version (declared) | Why it matters |
|---------|-------------------|----------------|
| `next` | `^16.2.11` | App framework, API routes, SSR/RSC |
| `@supabase/supabase-js` | `^2.110.8` | Postgres, Auth, Storage for cloud study sets |
| `@supabase/ssr` | `^0.12.3` | Cookie-based session bridge for Next.js |
| `pdfjs-dist` | `^6.1.200` | PDF text extraction and page rasterization (`src/lib/pdf/**`) |
| `zod` | `^4.4.3` | API input validation and generated-item schemas |

**AI / Document Processing:**

| Package | Role |
|---------|------|
| *(no AI SDK)* | Server calls OpenAI-compatible HTTP APIs via `fetch` (`src/lib/server/openAiChatCompletion.ts`, `src/app/api/ai/forward/route.ts`) |
| `mathjax` `^4.1.3` | Math rendering; assets copied to `public/mathjax/` by `scripts/copy-mathjax-assets.mjs` |

**Infrastructure / Observability:**

| Package | Role |
|---------|------|
| `@vercel/blob` `^2.6.1` | Optional public image staging for vision parse (`src/app/api/ai/vision-staging/route.ts`) |
| `@sentry/nextjs` `^10.67.0` | Optional error reporting (`sentry.client.config.ts`, `sentry.server.config.ts`, `instrumentation.ts`) |

## Configuration

**Environment:**

- `.env` file present at repo root (secrets — never commit)
- `.env.example` documents server AI vars: `AI_PROVIDER_URL`, `AI_PROVIDER_KEY`, `AI_MODEL_FREE`, `AI_MODEL_PRO`, `DOC_PROCESSING_MODE`, `ENABLE_DEV_ENGINE_PANEL`
- Supabase public vars required at runtime: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`src/lib/supabase/env.ts`)
- Optional: `BLOB_READ_WRITE_TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `AI_EMBEDDING_MODEL`, `AI_PRO_USER_IDS`, upload/parse feature flags (see `INTEGRATIONS.md`)

**Build:**

| File | Purpose |
|------|---------|
| `next.config.ts` | Redirects (legacy `/sets/*` → `/edit/*`), long-cache `/_next/static`, `serverExternalPackages: ["pdfjs-dist"]` |
| `tsconfig.json` | Strict TS, `@/*` → `src/*` path alias |
| `eslint.config.mjs` | Flat ESLint; ignores `.next/`, `public/mathjax/**`, `public/pdf.worker.min.mjs` |
| `postcss.config.mjs` | `@tailwindcss/postcss` plugin |
| `components.json` | shadcn registry config (`style: base-nova`, aliases to `@/components`, `@/lib`) |
| `sentry.client.config.ts` / `sentry.server.config.ts` | Optional Sentry init (disabled when DSN unset) |
| `instrumentation.ts` | Loads server Sentry config on Node.js runtime |

**Postinstall scripts (`package.json`):**

- `scripts/copy-pdf-worker.mjs` — copies pdf.js worker to `public/pdf.worker.min.mjs`
- `scripts/copy-mathjax-assets.mjs` — copies MathJax to `public/mathjax/`

## Platform Requirements

**Development:**

- Node.js ≥ 20.9.0, npm
- Supabase project (hosted or local) with migrations applied from `supabase/migrations/*.sql`
- Browser with IndexedDB for client-side parse caches and legacy local-first stores
- Optional: `BLOB_READ_WRITE_TOKEN` for multi-instance vision staging; without it, in-memory staging is used locally

**Production:**

- **Deployment target:** Node-compatible host; README and code assume **Vercel** (Blob storage, serverless Route Handlers)
- **Database:** Supabase Postgres with RLS policies from migrations
- **Object storage:** Supabase Storage bucket `doc2quiz` (private); optional Vercel Blob for vision image staging
- **AI upstream:** Any OpenAI-compatible HTTPS endpoint configured via `AI_PROVIDER_URL` / `AI_PROVIDER_KEY`

---

*Stack analysis: 2026-07-24*
