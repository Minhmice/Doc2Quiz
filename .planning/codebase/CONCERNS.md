# Doc2Quiz — Technical Concerns & Risks

> **Audience**: Developers onboarding or maintaining this project.
> **Last updated**: 2026-07-26

This document catalogs real issues found in the codebase as of the snapshot date. Each entry includes a severity rating, the impact if left unaddressed, the specific file location, and a recommendation.

---

## 1. Security Concerns

### 1.1 `.env` credentials committed to version control

**Severity**: **High**  
**Impact**: Live Supabase service-role key (admin, bypasses RLS) and AI provider API key are tracked by git. Anyone with repo access can exfiltrate credentials. The service-role key grants full database access — data exfiltration, deletion, or user impersonation is trivially possible.  
**Location**: `.env` (modified, tracked)  
**Evidence**: Git status shows ` M .env` — the file is tracked and modified.  
**Recommendation**:
1. Immediately rotate the Supabase service-role key and AI provider key.
2. Remove `.env` from git history (`git rm --cached .env`) and add `.env` to `.gitignore`.
3. Use a `.env.local` file (already in `.gitignore` by Next.js convention) for local development.
4. For production deployment, use the platform's secrets manager.

### 1.2 No middleware-level authentication enforcement

**Severity**: **Medium**  
**Impact**: Without a `middleware.ts` guarding all routes, a misconfiguration in the App Router layout hierarchy (or a new route added outside `(app)`) could accidentally expose authenticated pages. Currently, auth is enforced at the layout level via `requireUser()` in `src/app/(app)/layout.tsx`, but there is no centralized middleware filter.  
**Location**: No `middleware.ts` exists in the project root or `src/`.  
**Recommendation**: Add a `middleware.ts` at the project root that checks the session on every request and redirects to `/login` for unauthenticated users, providing defense-in-depth.

### 1.3 Signup endpoint — email enumeration and no rate-limiting

**Severity**: **Medium**  
**Impact**: `POST /api/auth/signup` is public and returns different error messages for "already registered" vs. "invalid password" scenarios. An attacker can enumerate which emails have accounts. There is no rate limiting, CAPTCHA, or proof-of-work on this endpoint.  
**Location**: `src/app/api/auth/signup/route.ts`  
**Recommendation**:
1. Return the same generic error (`"Signup failed"`) regardless of whether the email exists.
2. Add rate limiting (e.g., 3 attempts per IP per 10 minutes).
3. Consider a CAPTCHA challenge for the signup flow.

### 1.4 Public health endpoint exposes uptime

**Severity**: **Low**  
**Impact**: `GET /api/health` is unauthenticated and returns `process.uptime()`, leaking server runtime info. Minor reconnaissance risk.  
**Location**: `src/app/api/health/route.ts`  
**Recommendation**: Remove `uptime` from the response, or restrict the health endpoint to internal networks only.

### 1.5 Logout endpoint has no CSRF protection

**Severity**: **Low**  
**Impact**: The logout route (`/(auth)/logout`) accepts GET requests, making it vulnerable to CSRF attacks where an attacker could log out the victim by embedding an image or link. The route also accepts a `next` query parameter for redirect — while the code validates the path starts with `/`, there is no allowlist of valid destinations.  
**Location**: `src/app/(auth)/logout/route.ts`  
**Recommendation**: Make logout POST-only, and/or add a CSRF token check. Validate the `next` redirect target against an explicit allowlist.

---

## 2. Performance Concerns

### 2.1 High client-component ratio (38% of all TSX files)

**Severity**: **Medium**  
**Impact**: 102 out of 268 `.ts`/`.tsx` files carry `"use client"` directives. This increases the JavaScript bundle shipped to the browser, increases time-to-interactive, and prevents the server from pre-rendering these components. Many of these may not need client-side interactivity.  
**Location**: Widespread across `src/components/` (75 files), `src/app/` (14 route files), `src/hooks/` (2 files)  
**Recommendation**: Audit components marked `"use client"` and convert to server components where possible. In particular:
- Layout-only wrappers and purely presentational cards may not need client directives.
- Data-fetching components that delegate to client-only children can be split into a server-data layer + thin client shell.

### 2.2 12MB+ dev bundles on Windows with 5-minute chunk load timeout

**Severity**: **Medium**  
**Impact**: The project uses webpack (not Turbopack) in development, and `next.config.ts` sets `chunkLoadTimeout = 300_000` (5 minutes) for large dev bundles. The `scripts/dev.mjs` wrapper exists solely to work around Cursor/Node 25 injecting an invalid `--localstorage-file` flag. If the dev server were run without this wrapper, webpack worker processes could crash.  
**Location**: `next.config.ts` (line 13), `scripts/dev.mjs`  
**Recommendation**: Evaluate switching to Turbopack (`dev:turbo` script already exists) — it may eliminate both the wrapper script and the large-bundle timeout. If staying with webpack, document the wrapper requirement clearly in the README.

### 2.3 `framer-motion` and `motion` both in dependencies

**Severity**: **Low**  
**Impact**: Both `framer-motion@^12.42.2` and `motion@^12.42.2` are listed in `package.json` dependencies. `motion` is the modern package that re-exports framer-motion under a unified namespace, but having both means duplicate bundle weight until tree-shaking resolves it.  
**Location**: `package.json` (lines 31-33)  
**Recommendation**: Standardize on one package. Remove `framer-motion` and migrate imports to `"motion"`, or vice versa.

### 2.4 No code splitting at route-level for quiz/flashcard sessions

**Severity**: **Low**  
**Impact**: `QuizSession.tsx` (901 lines) and `FlashcardReviewWorkspace.tsx` (541 lines) are monolithic components. While Next.js App Router code-splits by route, any dynamic imports within these pages are absent — the entire component is loaded eagerly per session page.  
**Location**: `src/components/quiz/QuizSession.tsx`, `src/components/flashcards/review/FlashcardReviewWorkspace.tsx`  
**Recommendation**: Use `next/dynamic` to lazy-load heavyweight sub-components within session pages (e.g., the results view, question editor, navigator sidebar).

---

## 3. Maintainability

### 3.1 Dead code: unused components

**Severity**: **Medium**  
**Impact**: Three components exist on disk but are imported by zero files in `src/`. They add confusion, increase build times marginally, and represent untested code paths.  
**Locations**:
- `src/components/dashboard/StatCard.tsx` — not imported anywhere
- `src/components/dashboard/DashboardStatsRow.tsx` — not imported anywhere
- `src/components/dashboard/DashboardBlueprintDecor.tsx` — not imported anywhere

**Recommendation**: Remove these files. They can be recovered from git history if needed.

### 3.2 Deprecated `NewStudySetTextImportFlow.tsx` still present

**Severity**: **Medium**  
**Impact**: Marked `@deprecated Replaced by UnifiedInputZone` but still in the source tree. No active imports reference it, but it risks confusing developers who encounter it.  
**Location**: `src/components/edit/new/NewStudySetTextImportFlow.tsx`  
**Recommendation**: Delete the file. The migration to `UnifiedInputZone` is complete.

### 3.3 Near-identical workbench components (Flashcards vs. Quiz)

**Severity**: **Medium**  
**Impact**: `FlashcardsImportWorkbench.tsx` and `QuizNewImportWorkbench.tsx` are structurally identical. Both wrap `StudySetNewImportStepProvider` and render the same container div. The only difference is the backdrop component (grid vs. empty div — see 3.4). Any layout change must be duplicated.  
**Locations**:
- `src/components/edit/new/flashcards/FlashcardsImportWorkbench.tsx`
- `src/components/edit/new/quiz/QuizNewImportWorkbench.tsx`

**Recommendation**: Create a shared `ImportWorkbenchShell` component that accepts the backdrop as a `children` or `slot` prop.

### 3.4 QuizNewImportTechnicalBackdrop is a no-op shell

**Severity**: **Medium**  
**Impact**: `FlashcardsImportTechnicalGrid` renders a real background grid pattern. `QuizNewImportTechnicalBackdrop` renders an empty `<div>` with `pointer-events-none` — no background, no grid, no visible effect. This is either a bug (the quiz backdrop is missing) or stale code.  
**Location**: `src/components/edit/new/quiz/QuizNewImportTechnicalBackdrop.tsx`  
**Recommendation**: Either implement the grid for quiz (matching `FlashcardsImportTechnicalGrid`) or remove the component and its usage.

### 3.5 Vestigial IndexedDB constants and no-op functions

**Severity**: **Low**  
**Impact**: `src/types/studySet.ts` defines `DB_NAME = "doc2quiz"`, `DB_VERSION = 6`, and `LS_IDB_MIGRATED` — but no actual IndexedDB code exists. `ensureStudySetDb()` in `studySetDb.ts` is an empty async function. `getDocument()` and `putDocument()` are no-ops. These are migration leftovers from an earlier IndexedDB-based storage layer.  
**Locations**: `src/types/studySet.ts` (lines 30-34), `src/lib/client/studySetDb.ts` (lines 280-288)  
**Recommendation**: Remove the dead constants and no-op functions. They serve no purpose now that Supabase is the single source of truth.

### 3.6 Dual button components

**Severity**: **Low**  
**Impact**: There are two `button.tsx` files: `src/components/buttons/button.tsx` (custom implementation) and `src/components/ui/button.tsx` (shadcn-style). Having two button primitives increases maintenance burden and risks inconsistent styling.  
**Locations**: `src/components/buttons/button.tsx`, `src/components/ui/button.tsx`  
**Recommendation**: Consolidate to one button component. Check which is actually used by the majority of the codebase and migrate accordingly.

### 3.7 Type casting soup in studySetDb.ts

**Severity**: **Low**  
**Impact**: Multiple functions in `studySetDb.ts` use `as StudySetRow[]`, `as ApprovedQuestionRow[]`, `as { id: string }`, etc. — casting raw Supabase query results instead of using typed generics from `@supabase/supabase-js`. This bypasses compile-time safety: if the Supabase schema changes, these casts will silently produce incorrect data at runtime.  
**Location**: `src/lib/client/studySetDb.ts` (lines 150, 234, 248, 302, 325, etc.)  
**Recommendation**: Generate Supabase database types via `supabase gen types typescript` and use them in all queries instead of manual casts.

---

## 4. Technical Debt

### 4.1 Legacy route redirect pyramid

**Severity**: **Medium**  
**Impact**: There are **four layers** of legacy-to-canonical route mapping, all active simultaneously:
1. `next.config.ts` redirects (9 rules, lines 49-98) — server-side 301 redirects for 9 legacy URL patterns
2. Server-side redirect pages under `src/app/(app)/sets/new/` — 3 pages that each call `redirect()` 
3. Server-side redirect at `src/app/(app)/sets/[id]/parse/page.tsx` — reads IndexedDB (which is dead — see 3.5) then redirects
4. Client-side redirect at `src/app/(app)/sets/[id]/practice/page.tsx` via `PracticeLegacyRedirectClient` — reads Supabase to determine content kind, then client-navigates

This pyramid means old URLs pass through multiple hops before reaching their destination. The `next.config.ts` redirects fire first (301), but the page-level redirects (`/sets/new/*`, `/sets/[id]/parse`, `/sets/[id]/practice`) are still hit via direct navigation or bookmarks.  
**Locations**: `next.config.ts`, `src/app/(app)/sets/new/*`, `src/app/(app)/sets/[id]/parse/page.tsx`, `src/app/(app)/sets/[id]/practice/*`  
**Recommendation**: Once analytics confirm legacy URL traffic has dropped, remove the page-level redirects and rely solely on `next.config.ts` redirects. The parse and practice redirects that read from the database should be consolidated into server-side routes that read Supabase directly (not through the dead IndexedDB code).

### 4.2 AI environment variable split-brain

**Severity**: **Medium**  
**Impact**: `.env.example` defines three legacy AI env vars (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`) alongside three active ones (`AI_PROVIDER_URL`, `AI_PROVIDER_KEY`, `AI_MODEL_FREE`/`AI_MODEL_PRO`). The legacy vars are **never read** by any code in `src/`. This is confusing and risks someone configuring the wrong set of variables.  
**Locations**: `.env.example` (lines 9-16), `src/lib/server/ai-processing-config.ts`  
**Recommendation**: Remove the unreferenced env vars from `.env.example`. Rename `AI_PROVIDER_URL`/`AI_PROVIDER_KEY` to the more conventional `AI_BASE_URL`/`AI_API_KEY` in a single migration step, updating both code and `.env.example` together.

### 4.3 Service-role key fallback to typo'd env var name

**Severity**: **Low**  
**Impact**: The code falls back to `SERVICE_SUPABASESERVICE_KEY` if `SUPABASE_SERVICE_ROLE_KEY` is not set (see `src/lib/supabase/env.ts`, line 43). This typo'd name (`SERVICE_SUPABASESERVICE_KEY`) exists because the `.env` file was likely created with this incorrect key name. The fallback works, but it's confusing and suggests the env file hasn't been cleaned up.  
**Location**: `src/lib/supabase/env.ts` (lines 40-57)  
**Recommendation**: Standardize on `SUPABASE_SERVICE_ROLE_KEY` across the project. Remove the fallback once `.env` is cleaned up.

### 4.4 `StudySetDocumentRecord` is fully vestigial

**Severity**: **Low**  
**Impact**: The `StudySetDocumentRecord` type is marked `@deprecated` and states "Canonical detail deferred to Phase 3 — use canonical_documents table." Yet its associated `getDocument()` and `putDocument()` functions remain as no-ops. The type itself is still exported from `studySetDb.ts`.  
**Location**: `src/types/studySet.ts` (lines 24-28), `src/lib/client/studySetDb.ts` (lines 280-286)  
**Recommendation**: Remove `StudySetDocumentRecord`, `getDocument()`, and `putDocument()` entirely.

---

## 5. Reliability

### 5.1 `Promise.all` batch-fail in dashboard hook

**Severity**: **Medium**  
**Impact**: `useDashboardHome.ts` (line 90) runs `Promise.all()` over every study set to fetch approved banks and mistake flags. If **any** study set's Supabase query fails (e.g., a corrupted study set, a network blip), the entire `Promise.all` rejects, the catch block fires, and the dashboard shows a "Could not load study sets" error — displaying zero data instead of partial results.  
**Location**: `src/hooks/useDashboardHome.ts` (lines 90-107)  
**Recommendation**: Use `Promise.allSettled()` instead, and filter out failed results. This way one corrupted study set doesn't block the entire dashboard from loading.

### 5.2 Unstructured console logging in production API routes

**Severity**: **Medium**  
**Impact**: Four long-running API routes (canonicalize, flashcard generate, quiz generate, ingest) log errors via `console.error()` with no structured logging, no error IDs, and no environment guard. In production, these logs go to stdout with no way to correlate, filter, or alert on them.  
**Locations**:
- `src/app/api/study-sets/[id]/canonicalize/route.ts` (line 80)
- `src/app/api/study-sets/[id]/flashcards/generate/route.ts` (line 126)
- `src/app/api/study-sets/[id]/ingest/route.ts` (line 112)
- `src/app/api/study-sets/[id]/quiz/generate/route.ts` (line 126)

**Recommendation**: Integrate with the already-configured Sentry (`@sentry/nextjs` is in dependencies, `instrumentation.ts` imports it). Replace `console.error` with `sentry.captureException()` or a logger wrapper that adds correlation IDs.

### 5.3 No loading or error boundaries for most pages

**Severity**: **Medium**  
**Impact**: Only `DashboardHomeSkeleton.tsx` exists as a dedicated loading state. Most pages have no `loading.tsx` or `error.tsx` boundaries. If a data-fetching layout throws, the user may see an unhandled error page or a blank screen.  
**Recommendation**: Add `loading.tsx` and `error.tsx` files for each route segment, especially quiz/flashcard sessions, edit pages, and settings.

### 5.4 Client-side auth check has no error boundary for session expiry

**Severity**: **Low**  
**Impact**: `src/lib/client/studySetDb.ts` uses `requireUserId()` which calls `supabase.auth.getUser()` and throws `"Not authenticated"` if the user is null. However, if the session has expired, this throws in the callers (e.g., `listStudySetMetas()`, `getApprovedBank()`) with no recovery path — the user gets an unhandled rejection instead of being redirected to login.  
**Locations**: `src/lib/client/studySetDb.ts` (lines 37-48), all callers  
**Recommendation**: Wrap client-side auth failures in a redirect to login, or use the Supabase auth listener to auto-redirect on session expiry.

### 5.5 Python subprocess dependency — no graceful failure for serverless

**Severity**: **High** (for serverless deployment)  
**Impact**: Document ingestion depends on `child_process.spawn("python", ["-m", "markitdown", ...])`. This is incompatible with serverless environments (Vercel, Netlify, etc.) where Python is not available and filesystem writes may be restricted. The current deployment targets are unclear, but this is a hard blocker for serverless adoption.  
**Locations**: `src/lib/pipeline/markitdown.ts`, `requirements.txt`  
**Recommendation**:
1. Document the deployment constraint explicitly in README (require Node.js + Python host).
2. If serverless deployment is desired, explore a WASM-based MarkItDown alternative or run MarkItDown as a separate microservice with a REST API.
3. Improve error messaging when Python is not found so users understand why ingest fails.

---

## 6. Dependency Risks

### 6.1 Python subprocess + native dependencies (MarkItDown)

**Severity**: **Medium**  
**Impact**: `requirements.txt` pins `markitdown[all]==0.1.6`. The `[all]` extra pulls in heavy native dependencies (PDF parser, OCR, etc.). On Windows, compiling these native extensions requires a working C compiler toolchain. The version pin is exact, meaning no automated security patches.  
**Locations**: `requirements.txt`, `scripts/setup-python.mjs`  
**Recommendation**: Pin with a compatible range (`>=0.1.6,<0.2`), and document the required Visual Studio Build Tools for Windows Python users.

### 6.2 `shadcn` listed as a runtime dependency

**Severity**: **Low**  
**Impact**: `"shadcn": "^4.14.1"` is listed in `dependencies` instead of `devDependencies`. The `shadcn` CLI is a build-time tool for adding components — it should not ship to production.  
**Location**: `package.json` (line 40)  
**Recommendation**: Move `shadcn` to `devDependencies`.

### 6.3 `cross-env` used in `dev` script but `NODE_OPTIONS` is immediately overridden

**Severity**: **Low**  
**Impact**: The `dev` script is:  
`cross-env NODE_OPTIONS= node scripts/dev.mjs`  
The `cross-env` sets `NODE_OPTIONS` to empty, but `scripts/dev.mjs` immediately sanitizes and deletes `NODE_OPTIONS` anyway. The `cross-env` call is redundant on Unix systems and only potentially useful on Windows for clearing the var before Node spawns. This is a fragile workaround that future developers may not understand.  
**Location**: `package.json` (line 6)  
**Recommendation**: Add a comment explaining why `NODE_OPTIONS=` is needed, or remove the `cross-env` prefix if testing confirms Node 25+ doesn't require it.

### 6.4 Two animation frameworks present

**Severity**: **Low**  
**Impact**: Both `framer-motion@^12.42.2` and `motion@^12.42.2` are installed. Ten files import from `"framer-motion"`. Zero files import from `"motion"`. Since `motion` is the successor and re-exports framer-motion, having both is unnecessary.  
**Location**: `package.json` (lines 31-33)  
**Recommendation**: Migrate all imports to `"motion"` and remove `framer-motion` from dependencies.

---

## 7. Specific Investigated Areas

### 7.1 Why `scripts/dev.mjs` instead of `next dev`?

**Root cause**: Node 25 / Cursor injects a `--localstorage-file` flag into `NODE_OPTIONS` without a path argument, which breaks webpack worker processes. The dev script sanitizes this flag before spawning Next.js. The `--webpack` flag is also passed to use webpack instead of Turbopack (Turbopack is available via `dev:turbo` but may have stability issues).

**Risk**: Low — the script works correctly. The risk is that future Node.js or Cursor updates change the injection behavior, silently breaking `npm run dev`.

### 7.2 AI provider env var confusion

**Root cause**: There are two sets of AI env vars — a legacy set (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`) that is documented in `.env.example` but **never read by any code**, and an active set (`AI_PROVIDER_URL`, `AI_PROVIDER_KEY`, `AI_MODEL_FREE`, `AI_MODEL_PRO`). This is a documentation/configuration hygiene issue.

**Risk**: Medium — a developer setting up the project could configure the wrong variables and get confusing errors at runtime.

### 7.3 Legacy `/sets/` route migration

**Root cause**: The project migrated from a `/sets/` URL scheme to `/edit/`, `/quiz/`, `/flashcards/` routes. The migration left behind 4 layers of redirects (next.config.ts 301s, server redirect pages, client redirect pages). The `/sets/[id]/parse` page is particularly problematic — it still tries to read from the dead IndexedDB layer before falling back.

**Risk**: Medium — the multi-layer redirect approach works but adds complexity and latency. The dead IndexedDB dependency in `/sets/[id]/parse` could break under certain conditions.

### 7.4 ChunkLoadRecovery component

**Root cause**: The `ChunkLoadRecovery.tsx` component and its inline script counterpart handle a very specific failure mode: during development on Windows with large bundles (presumably ~12MB for the main app chunk), webpack can fail to write a chunk before the browser requests it. The component detects `ChunkLoadError` / `Failed to load chunk` / `Failed to fetch RSC payload` and performs up to 2 auto-reloads with a 3-second delay. This is only active in development (`NODE_ENV === "development"`).

**Risk**: Medium — this masks what is likely an underlying webpack or filesystem performance issue. Consider switching to Turbopack (which may not have this problem).

### 7.5 Python subprocess requirement

**Root cause**: Document ingestion uses `markitdown`, a Python CLI tool, via `child_process.spawn`. The Python version is pinned at 0.1.6. This is a hard requirement — without Python + MarkItDown installed, PDF/URL/paste ingestion fails.

**Risk**: High for serverless deployment, Medium for traditional hosting. The error messages when Python is missing are good but the setup friction is real (requires Python 3.10+, venv creation, `pip install` with native deps).

### 7.6 IndexedDB + Supabase dual storage

**Root cause**: The codebase migrated from a pure IndexedDB/localStorage client-side storage to a Supabase-backed architecture. The migration appears complete, but remnants remain: `studySetDb.ts` has no-op functions (`ensureStudySetDb()`, `getDocument()`, `putDocument()`), `studySet.ts` defines dead IndexedDB constants, and one legacy redirect (`/sets/[id]/parse`) still references IndexedDB.

**Risk**: Low — no active code path depends on IndexedDB. The vestigial code is dead, not harmful.

### 7.7 Unauthenticated endpoints

**Root cause**: Only `GET /api/health` is intentionally unauthenticated (used for load balancer health checks). All data-bearing API routes use `requireApiUser()` and enforce `user_id` RLS-equivalent checks. No `POST /api/ai/vision-staging` endpoint was found (the initial concern was not realized in the codebase).

**Risk**: Low — the authentication scaffolding is consistent across all data routes.

### 7.8 DashboardStatsRow / StatCard

**Root cause**: These components existed on disk at the time of the initial exploration but were subsequently deleted (confirmed: files no longer exist). They were never imported by any file in `src/`, confirming they were dead code. The glob listing found them but the Read tool returned "File not found" — suggesting they were removed very recently.

**Risk**: None — they are already gone.

---

## Risk Summary Table

| # | Concern | Severity | Category | Effort to Fix |
|---|---------|----------|----------|---------------|
| 1.1 | .env credentials in git | **High** | Security | 1 hour |
| 5.5 | Python subprocess for serverless | **High** | Reliability | Weeks (architectural) |
| 2.1 | 38% client components | Medium | Performance | Weeks (audit + migrate) |
| 3.1 | Dead/unused components | Medium | Maintainability | 30 minutes |
| 3.2 | Deprecated component still present | Medium | Maintainability | 5 minutes |
| 3.3 | Duplicate workbench components | Medium | Maintainability | 2 hours |
| 3.4 | Empty backdrop component | Medium | Maintainability | 1 hour |
| 4.1 | Legacy redirect pyramid | Medium | Technical Debt | 1 day |
| 4.2 | AI env var split-brain | Medium | Technical Debt | 30 minutes |
| 5.1 | Promise.all batch-fail in dashboard | Medium | Reliability | 30 minutes |
| 5.2 | Unstructured console logging | Medium | Reliability | 2 hours |
| 5.3 | Missing loading/error boundaries | Medium | Reliability | 1 day |
| 6.1 | Python native deps | Medium | Dependency | Documentation |
| 1.2 | No middleware auth | Medium | Security | 2 hours |
| 1.3 | Signup enumeration | Medium | Security | 30 minutes |
| 2.2 | 12MB dev bundles on Windows | Medium | Performance | 1 hour (try Turbopack) |
| 3.5 | Vestigial IndexedDB code | Low | Maintainability | 30 minutes |
| 3.6 | Dual button components | Low | Maintainability | 2 hours |
| 3.7 | Type casting in studySetDb | Low | Maintainability | 1 hour (after types generated) |
| 4.3 | Typo'd env var fallback | Low | Technical Debt | 10 minutes |
| 4.4 | Vestigial StudySetDocumentRecord | Low | Technical Debt | 15 minutes |
| 5.4 | No session expiry handling | Low | Reliability | 1 day |
| 6.2 | shadcn in runtime deps | Low | Dependency | 5 minutes |
| 6.3 | Redundant cross-env | Low | Dependency | 10 minutes |
| 6.4 | Dual animation packages | Low | Dependency | 30 minutes |

---

## Quick Wins (30 minutes or less)

These are low-effort fixes that should be addressed immediately:

1. **Delete dead code**: `NewStudySetTextImportFlow.tsx`, vestigial IndexedDB constants and no-op functions from `studySetDb.ts`
2. **Move `shadcn` to `devDependencies`**: One-line `package.json` edit
3. **Standardize AI env vars in `.env.example`**: Remove `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` — keep only active vars
4. **Remove `SERVICE_SUPABASESERVICE_KEY` fallback**: Clean up `env.ts` after confirming `SUPABASE_SERVICE_ROLE_KEY` is set in production
5. **Add `.env` to `.gitignore`**: Prevent future credential leaks
6. **Fix signup error messages**: Return generic error text regardless of whether the email exists
