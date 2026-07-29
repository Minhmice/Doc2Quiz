# Doc2Quiz Project Structure

> An AI study workbench web app — Next.js 16 App Router, TypeScript, Supabase, Tailwind CSS v4.

---

## Root Files

| File | Purpose |
|---|---|
| `package.json` | Dependencies: Next.js 16, React 19, Supabase SSR, Tailwind v4, Framer Motion, shadcn/ui, Zod, Sentry, Vitest, Playwright |
| `tsconfig.json` | TypeScript 6 config — ES2017 target, bundler module resolution, `@/*` → `./src/*` paths |
| `next.config.ts` | Next.js 16 config — experimental `optimizePackageImports`, Windows webpack workarounds (memory cache, polling), production cache headers, legacy redirects |
| `postcss.config.mjs` | PostCSS with `@tailwindcss/postcss` (Tailwind v4 PostCSS plugin) |
| `eslint.config.mjs` | ESLint 9 flat config |
| `vitest.config.ts` | Vitest test runner config |
| `playwright.config.ts` | Playwright E2E test config |
| `components.json` | shadcn/ui component registry config |
| `instrumentation.ts` | Next.js instrumentation — imports Sentry in Node.js runtime |
| `sentry.client.config.ts` | Sentry client SDK config |
| `sentry.server.config.ts` | Sentry server SDK config |
| `.env.example` | Required env vars: Supabase URL/keys, AI provider URL/key/model, MarkItDown Python path |
| `requirements.txt` | Python dependency: `markitdown[all]==0.1.6` |
| `next-env.d.ts` | Next.js TypeScript declarations (auto-generated) |
| `DESIGN.md` | Design system documentation |
| `PRODUCT.md` | Product requirements / vision |
| `README.md` | Project overview and setup |
| `TASTE.md` | Visual taste and aesthetic guidelines |

---

## `src/`

### `src/app/` — Next.js App Router Pages + API Routes

#### Root Layout & Entry

| File | Description |
|---|---|
| `layout.tsx` | **Root layout** — font loading (Manrope body, Space Grotesk labels), `ThemeProvider` (dark default, system-aware), `AppRootProviders` (TooltipProvider + Toaster), chunk load recovery script in dev |
| `page.tsx` | **`/`** — redirects to `/dashboard` |

---

#### `src/app/(app)/` — Authenticated Routes

**Layout & Template**

| File | Description |
|---|---|
| `layout.tsx` | **Auth gate** — calls `requireUser()`, redirects to `/login` if unauthenticated. Wraps children in `AppProviders` (LocaleProvider, DisplayNameProvider, AppShell, CommandPalette) |
| `template.tsx` | **Page transition wrapper** — wraps route children in `PageTransition` (fade-in on navigation) |

**Dashboard**

| File | Description |
|---|---|
| `dashboard/page.tsx` | **`/dashboard`** — renders `DashboardHomeClient` |

**Edit / Create New**

| File | Description |
|---|---|
| `edit/new/page.tsx` | **`/edit/new`** — format selection (quiz vs flashcards), server component with `FormatSelectionCardsGrid` |
| `edit/new/quiz/page.tsx` | **`/edit/new/quiz`** — quiz import workbench: upload/paste/YouTube, `UnifiedInputZone` |
| `edit/new/flashcards/page.tsx` | **`/edit/new/flashcards`** — flashcard import workbench: upload/paste/YouTube, `UnifiedInputZone` |

**Edit / Review Existing**

| File | Description |
|---|---|
| `edit/quiz/[id]/layout.tsx` | Layout for quiz edit page |
| `edit/quiz/[id]/page.tsx` | **`/edit/quiz/[id]`** — loads `approved_questions` from Supabase, renders `ReviewSection` for human-in-the-loop editing |
| `edit/flashcards/[id]/layout.tsx` | Layout for flashcard edit page |
| `edit/flashcards/[id]/page.tsx` | **`/edit/flashcards/[id]`** — loads `approved_flashcards`, renders `FlashcardReviewWorkspace` |

**Quiz Practice**

| File | Description |
|---|---|
| `quiz/[id]/layout.tsx` | Layout for quiz practice page |
| `quiz/[id]/page.tsx` | **`/quiz/[id]`** — keyboard-first quiz session via `QuizSession`, supports `?review=mistakes` for drill loop, renders `QuizPlayNavigator` sidebar |
| `quiz/[id]/done/page.tsx` | **`/quiz/[id]/done`** — completion results: score, mistake drill CTA, links to review/play again |

**Flashcard Practice**

| File | Description |
|---|---|
| `flashcards/[id]/layout.tsx` | Layout for flashcard practice page |
| `flashcards/[id]/page.tsx` | **`/flashcards/[id]`** — flashcard session via `FlashcardSession` with flip animation |
| `flashcards/[id]/done/page.tsx` | **`/flashcards/[id]/done`** — completion page, links to play again or return to library |

**Study Set (Legacy / Source)**

| File | Description |
|---|---|
| `sets/[id]/layout.tsx` | Layout — max-w container for sets pages |
| `sets/[id]/source/page.tsx` | **`/sets/[id]/source`** — canonical knowledge preview (Markdown viewer + section TOC), triggers canonicalize if raw, offers quiz/flashcard generation |
| `sets/[id]/parse/page.tsx` | **`/sets/[id]/parse`** — legacy redirect: reads `contentKind` and navigates to `/edit/quiz/[id]` or `/edit/flashcards/[id]` |
| `sets/[id]/practice/page.tsx` | **`/sets/[id]/practice`** — legacy redirect client component |
| `sets/[id]/practice/PracticeLegacyRedirectClient.tsx` | Client component for legacy practice redirect |
| `sets/new/page.tsx` | Legacy redirect (via next.config.ts → /edit/new) |
| `sets/new/quiz/page.tsx` | Legacy redirect |
| `sets/new/flashcards/page.tsx` | Legacy redirect |

**Settings**

| File | Description |
|---|---|
| `settings/page.tsx` | **`/settings`** — language selector, dev engine panel, data export (ApprovedBankExportButton) |

**Other**

| File | Description |
|---|---|
| `develop/` | (empty directory, reserved for dev tools) |

---

#### `src/app/(auth)/` — Unauthenticated Routes

| File | Description |
|---|---|
| `layout.tsx` | **Auth layout** — wraps children in `AuthShell` (brand aside, theme toggle, ghost grid) |
| `login/page.tsx` | **`/login`** — renders `LoginClient` (Suspense-wrapped) |
| `login/LoginClient.tsx` | Login form component (magic link or password) |
| `signup/page.tsx` | **`/signup`** — renders `SignupClient` |
| `signup/SignupClient.tsx` | Signup form component |
| `logout/route.ts` | **`/logout`** — POST/GET handler, signs out via Supabase server client, redirects to `/login` |
| `dev/gate/exit` | (empty directory, reserved) |

---

#### `src/app/api/` — Route Handlers (API)

| File | Method | Description |
|---|---|---|
| `health/route.ts` | GET | Health check — returns `{ status: "ok", timestamp, uptime }` |
| `ai/ping/route.ts` | GET | AI provider connectivity test — calls LLM with a simple ping, returns latency + status |
| `ai/dev-engine-panel/route.ts` | GET, POST | Dev-only — shows AI config (model, URL, key status), POST runs a ping. Gated by `ENABLE_DEV_ENGINE_PANEL=false` |
| `auth/signup/route.ts` | POST | User registration — email + password via Supabase Admin API, auto-confirms + signs in |
| `study-sets/route.ts` | GET | List all study sets for authenticated user (ordered by `updated_at` desc) |
| `study-sets/route.ts` | POST | Create a new study set (defaults `pipeline_stage: "input"`) |
| `study-sets/[id]/route.ts` | GET | Get single study set metadata |
| `study-sets/[id]/route.ts` | PATCH | Update study set (title, subtitle, content_kind, pipeline_stage) |
| `study-sets/[id]/route.ts` | DELETE | Delete a study set |
| `study-sets/[id]/ingest/route.ts` | POST | Ingest document — supports multipart file upload, JSON body (paste, YouTube, file_ref). Runs MarkItDown, stores raw markdown |
| `study-sets/[id]/ingest/route.test.ts` | Unit tests for ingest route |
| `study-sets/[id]/canonicalize/route.ts` | POST | Run canonicalization (AI extraction of structured knowledge from raw markdown) |
| `study-sets/[id]/canonicalize/route.test.ts` | Unit tests for canonicalize route |
| `study-sets/[id]/canonical/route.ts` | GET | Fetch canonical preview data (document metadata + sections) |
| `study-sets/[id]/quiz/generate/route.ts` | POST | AI MCQ generation — reads canonical document/sections, calls LLM, persists to `approved_questions` |
| `study-sets/[id]/quiz/generate/route.test.ts` | Unit tests for quiz generate route |
| `study-sets/[id]/flashcards/generate/route.ts` | POST | AI flashcard generation — reads canonical document/sections, calls LLM, persists to `approved_flashcards` |
| `study-sets/[id]/flashcards/generate/route.test.ts` | Unit tests for flashcard generate route |

---

### `src/app/globals.css`

Global styles with:

- **CSS custom properties** — theme tokens (colors, fonts, spacing) via Tailwind v4 `@theme`
- **Dark/light mode** — `.dark` / `:root` class-based theming
- **`d2q-*` utility classes** — route transitions, technical grid, import/results animations
- **`@media (prefers-reduced-motion)`** — respects user motion preferences

---

### `src/components/` — React Components by Domain

#### `components/animate-ui/`

| File | Description |
|---|---|
| `icons/icon.tsx` | Animated icon component |
| `icons/layers.tsx` | Layered icon animation utility |
| `primitives/animate/slot.tsx` | Animated slot primitive (Base UI compatible) |

#### `components/auth/`

| File | Description |
|---|---|
| `AuthBrandAside.tsx` | Brand showcase panel for auth pages (desktop sidebar) |
| `AuthGhostGrid.tsx` | Decorative background grid for auth pages |
| `AuthMobileHeader.tsx` | Mobile auth page header |
| `AuthShell.tsx` | Auth page layout shell — wraps login/signup content |
| `AuthThemeToggle.tsx` | Theme toggle for auth pages |

#### `components/buttons/`

| File | Description |
|---|---|
| `button.tsx` | Button component with variants (default, destructive, outline, secondary, ghost, link) |
| `index.ts` | Button barrel export |

#### `components/canonical/`

| File | Description |
|---|---|
| `CanonicalizeProgressCard.tsx` | Progress display during canonicalization (with error state) |
| `CanonicalMarkdownViewer.tsx` | Renders canonical markdown with syntax highlighting |
| `CanonicalMetadataChips.tsx` | Metadata badges (language, content type, topics) |
| `CanonicalModeSelectionFooter.tsx` | Footer with quiz/flashcard generation action buttons |
| `CanonicalNextStepPlaceholder.tsx` | Placeholder for next-step content selection |
| `CanonicalPreviewHeader.tsx` | Header for the canonical preview page |
| `CanonicalSectionToc.tsx` | Table of contents sidebar for canonical sections |

#### `components/dashboard/`

| File | Description |
|---|---|
| `AnimateUIChartLineIcon.tsx` | Animated chart line icon for dashboard |
| `DashboardBlueprintDecor.tsx` | Blueprint-style decorative background element |
| `DashboardHero.tsx` | Top section: stats, resume CTA, create button |
| `DashboardHomeClient.tsx` | Main dashboard orchestrator — manages loading, hero, library, mobile nav |
| `DashboardHomeSkeleton.tsx` | Skeleton loader while dashboard data loads |
| `DashboardLibraryClient.tsx` | Filterable, sortable library of study sets |
| `DashboardLibraryHeader.tsx` | Library section header with search and filters |
| `DashboardMobileBottomNav.tsx` | Fixed bottom navigation for mobile |
| `DashboardStatsRow.tsx` | Statistics row (streak, sessions, questions) |
| `DashboardStudySetCard.tsx` | Individual study set card in the library |
| `RenameStudySetDialog.tsx` | Dialog for renaming a study set |
| `StreakFlameChip.tsx` | Streak indicator chip with flame icon |
| `dashboardFormat.ts` | Dashboard formatting utilities |

#### `components/dev/`

| File | Description |
|---|---|
| `ChunkLoadRecovery.tsx` | React component for chunk load error boundary |

#### `components/edit/new/`

| File | Description |
|---|---|
| `NewStudySetTextImportFlow.tsx` | Text import flow (paste/upload) for new study sets |
| **`format-selection/`** | | 
| `FormatSelectionCard.tsx` | Individual format card (quiz or flashcards) |
| `FormatSelectionCardsGrid.tsx` | Grid layout for format selection cards |
| `HowItWorksStrip.tsx` | "How it works" informational strip |
| `NewStudySetFormatFooter.tsx` | Footer for format selection page |
| `NewStudySetFormatHero.tsx` | Hero section for format selection |
| **`import/`** | |
| `ImportFlowTechnicalDetails.tsx` | Technical details panel for import flow |
| `ImportMcqCardShell.tsx` | MCQs preview shell during import |
| `IngestProgressCard.tsx` | Ingest progress (validating → uploading → converting → done) with retry |
| `StudySetNewImportStepContext.tsx` | React context for multi-step import flow, tab strip |
| `UnifiedInputZone.tsx` | Unified upload box / paste / YouTube URL input zone |
| **`quiz/`** | |
| `QuizNewImportTechnicalBackdrop.tsx` | Technical backdrop decoration for quiz import |
| `QuizNewImportWorkbench.tsx` | Import workbench wrapper for quiz creation |
| **`flashcards/`** | |
| `FlashcardsGenerationControls.tsx` | Flashcard generation controls |
| `FlashcardsImportTechnicalGrid.tsx` | Technical grid for flashcard import |
| `FlashcardsImportWorkbench.tsx` | Import workbench wrapper for flashcard creation |
| `FlashcardsImportWorkbenchHeader.tsx` | Header for flashcard import workbench |

#### `components/flashcards/`

| File | Description |
|---|---|
| `FlashcardActions.tsx` | Flashcard action buttons (flip, next, previous, mark known) |
| `FlashcardGenerateProgressCard.tsx` | Progress card during flashcard generation |
| `FlashcardInteractionHints.tsx` | Keyboard shortcut hints for flashcard session |
| `FlashcardSession.tsx` | Main flashcard practice session component |
| `FlashcardSetupWizard.tsx` | Configuration wizard (learning goal, coverage, amount) before generation |
| **`review/`** | |
| `FlashcardReviewWorkspace.tsx` | Flashcard review/editor with side-by-side front/back editing |

#### `components/layout/`

| File | Description |
|---|---|
| `ApiStatusIndicator.tsx` | AI provider connection status dot (green/red/yellow) with tooltip |
| `AppProviders.tsx` | Client-side providers for authenticated routes (LocaleProvider, DisplayNameProvider, AppShell, CommandPalette) |
| `AppShell.tsx` | Main authenticated shell — AppTopBar + main content area + LibrarySearchProvider |
| `AppTopBar.tsx` | Top navigation bar with logo, search, theme toggle, API status, language selector |
| `CommandPalette.tsx` | Keyboard command palette (cmd+k), dynamically imported and deferred |
| `LibrarySearchContext.tsx` | React context + hook for dashboard library search |
| `PageTransition.tsx` | Route-level fade-in animation (CSS opacity-based) |
| `RoutePrefetch.tsx` | Prefetches common routes for instant navigation |
| `StudySetFlowPageShell.tsx` | Reusable page shell for multi-step study set flows |
| `ThemeToggle.tsx` | Dark/light theme toggle button |

#### `components/locale/`

| File | Description |
|---|---|
| `LanguageSelector.tsx` | Language dropdown selector |
| `LocaleProvider.tsx` | i18n context provider with slang/encouragement system |
| `LocaleProvider.test.tsx` | Unit tests for LocaleProvider |
| `LocalizedCopy.tsx` | `<LocalizedText>` and `<LocalizedSlangLine>` components |
| `LocalizedCopy.test.tsx` | Unit tests for LocalizedCopy |

#### `components/math/`

| File | Description |
|---|---|
| `index.ts` | Math utilities barrel export |
| `MathText.tsx` | Math-aware text renderer (detects and formats LaTeX math) |

#### `components/media/`

| File | Description |
|---|---|
| `StoredImage.tsx` | Image component for stored/uploaded images |

#### `components/processing/`

| File | Description |
|---|---|
| `conversion-progress.tsx` | `ConversionProgressShell` — generic conversion progress display with step indicators |

#### `components/profile/`

| File | Description |
|---|---|
| `DisplayNameProvider.tsx` | Display name context provider (reads from localStorage) |

#### `components/providers/`

| File | Description |
|---|---|
| `app-root-providers.tsx` | Root-level providers: TooltipProvider + Sonner Toaster |

#### `components/quiz/`

| File | Description |
|---|---|
| `QuizGenerateProgressCard.tsx` | Progress card during quiz generation |
| `QuizInteractionHints.tsx` | Keyboard shortcut hints for quiz session |
| `QuizSession.tsx` | Main quiz practice session — keyboard-first (1/2/3/4 for answers), progress tracking, mistake review |

#### `components/review/`

| File | Description |
|---|---|
| `MappingQualityBadge.tsx` | Badge showing AI mapping quality score |
| `McqOptionsPreview.tsx` | Preview of MCQ options (A/B/C/D) |
| `QuestionCard.tsx` | Display card for a single question |
| `QuestionEditor.tsx` | Inline question editing form |
| `QuestionReviewNavigator.tsx` | Sidebar navigator with status dots (answered/approved/edited) |
| `ReviewList.tsx` | Scrollable list of review cards |
| `ReviewSection.tsx` | Main review section — loads bank, manages edit state, save-to-bank |

#### `components/settings/`

| File | Description |
|---|---|
| `ApprovedBankExportButton.tsx` | Export button for training/evaluation data |
| `DevEnginePanel.tsx` | Dev-only AI engine configuration panel |

#### `components/ui/` (shadcn primitives)

| File | Description |
|---|---|
| `alert-dialog.tsx` | Alert dialog |
| `alert.tsx` | Alert component |
| `avatar.tsx` | Avatar |
| `badge.tsx` | Badge |
| `button.tsx` | Button (ui variant) |
| `card-7.tsx` | Alternative card style |
| `card.tsx` | Card |
| `checkbox.tsx` | Checkbox |
| `command.tsx` | Command palette primitives |
| `dialog.tsx` | Dialog |
| `dropdown-menu.tsx` | Dropdown menu |
| `field.tsx` | Form field |
| `input-group.tsx` | Input group |
| `input.tsx` | Input |
| `label.tsx` | Label |
| `progress.tsx` | Progress bar |
| `radio-group.tsx` | Radio group |
| `scroll-area.tsx` | Scroll area |
| `select.tsx` | Select dropdown |
| `separator.tsx` | Separator |
| `sheet.tsx` | Sheet (slide-over panel) |
| `skeleton.tsx` | Skeleton loader |
| `sonner.tsx` | Sonner toast wrapper |
| `switch.tsx` | Switch toggle |
| `tabs.tsx` | Tabs |
| `textarea.tsx` | Textarea |
| `tooltip.tsx` | Tooltip |
| `vertical-cut-reveal.tsx` | Vertical cut reveal animation |

#### `components/upload/`

| File | Description |
|---|---|
| `UploadBox.tsx` | File upload dropzone with drag-and-drop |

---

### `src/hooks/` — Custom React Hooks

| File | Description |
|---|---|
| `use-is-in-view.tsx` | IntersectionObserver hook for scroll-based animations |
| `useDashboardHome.ts` | Dashboard data fetching, filtering, sorting, and state management |
| `useStudySetProductSurfaceRedirect.ts` | Route guard that checks study set exists, has correct content kind, and redirects if needed |

---

### `src/lib/` — Business Logic, Utilities, API Clients

#### `lib/ai/`

| File | Description |
|---|---|
| `openAiEndpoint.ts` | URL normalization for OpenAI-compatible endpoints — resolves `/v1/chat/completions` from base URLs |
| `ping.ts` | AI agent ping types |
| `ping.test.ts` | Tests for ping |

#### `lib/api/`

| File | Description |
|---|---|
| `requireApiUser.ts` | Server-side auth middleware for API routes — reads Supabase session, returns `{ supabase, user }` or 401 |

#### `lib/client/` — Browser-Side API Callers

| File | Description |
|---|---|
| `activityTracking.ts` | Quiz session recording, mistake tracking, weekly stats, streak calculation |
| `activityTracking.test.ts` | Tests for activity tracking |
| `apiPingCache.ts` | Client-side cache for AI ping results (sessionStorage, 60s TTL) |
| `apiStatusEasterEgg.ts` | Easter egg status messages for API status indicator |
| `appDataCache.ts` | Generic app data cache |
| `appDataCache.test.ts` | Tests for app data cache |
| `canonicalizeStudySet.ts` | Client API caller for `POST /api/study-sets/[id]/canonicalize` and `GET .../canonical` |
| `flashcardGenerateStudySet.ts` | Client API caller for `POST /api/study-sets/[id]/flashcards/generate` |
| `flashcardGenerateStudySet.test.ts` | Tests for flashcard generate client |
| `ingestStudySet.ts` | Client API caller for document ingestion — handles file upload (multipart or storage), paste, YouTube |
| `quizGenerateStudySet.ts` | Client API caller for `POST /api/study-sets/[id]/quiz/generate` |
| `quizGenerateStudySet.test.ts` | Tests for quiz generate client |
| `studySetDb.ts` | Supabase-backed CRUD for study sets, approved questions, approved flashcards. Client-side data access layer |
| `studySetDb.test.ts` | Tests for study set db |
| `supabase.ts` | Re-exports `createSupabaseBrowserClient` from `lib/supabase/browser` |

#### `lib/dashboard/`

| File | Description |
|---|---|
| `createSetCtaLinks.ts` | Generates CTA link URLs for dashboard create buttons |
| `studySetDashboardLinks.ts` | Study set link builders for dashboard (playHref, openEditorHref) |

#### `lib/dev/`

| File | Description |
|---|---|
| `chunkLoadRecoveryScript.ts` | Inline script for automatic chunk load recovery (up to 2 retries with 3s delay) |

#### `lib/ids/`

| File | Description |
|---|---|
| `createRandomUuid.ts` | UUID v4 generation utility |

#### `lib/learning/`

| File | Description |
|---|---|
| `index.ts` | Learning utilities barrel export |
| `mappingQuality.ts` | AI question-to-concept mapping quality assessment |

#### `lib/locale/` — i18n System

| File | Description |
|---|---|
| `coverage.test.ts` | Tests for locale coverage |
| `localeStorage.ts` | Persists locale preference to localStorage |
| `localeStorage.test.ts` | Tests for locale storage |
| `messages.ts` | All localized message strings (English, with some Vietnamese support) |
| `messages.test.ts` | Tests for messages |
| `selectSlang.ts` | Selects context-appropriate slang/encouragement messages |
| `selectSlang.test.ts` | Tests for slang selection |
| `slang.ts` | Slang/encouragement message definitions |
| `slang.test.ts` | Tests for slang |
| `types.ts` | Locale types — `Locale`, `Messages`, `SlangMessages` |

#### `lib/math/`

| File | Description |
|---|---|
| `splitMathSegments.ts` | Splits text into math and non-math segments for rendering |

#### `lib/pipeline/` — Core AI Processing Pipeline

| File | Description |
|---|---|
| `canonicalize.ts` | `runCanonicalize()` — orchestrates AI canonicalization: reads raw markdown, calls LLM, post-processes, persists. Includes JSON fence stripping, truncation, retry with repair |
| `canonicalize.test.ts` | Tests for canonicalize |
| `canonicalPrompt.ts` | Prompt builder for canonicalization — loads prompt spec, builds system + user messages |
| `canonicalPrompt.test.ts` | Tests for canonical prompt |
| `canonicalSchemas.ts` | Zod schemas for canonical builder output — `CanonicalBuilderOutput`, section schemas, metadata |
| `canonicalSchemas.test.ts` | Tests for canonical schemas |
| `dedupeAndCapFlashcards.ts` | Deduplicates and caps generated flashcards (max 60) |
| `dedupeAndCapFlashcards.test.ts` | Tests for flashcard deduplication |
| `dedupeAndCapQuestions.ts` | Deduplicates and caps generated questions (max 40) |
| `dedupeAndCapQuestions.test.ts` | Tests for question deduplication |
| `faithfulness.ts` | Post-LLM faithfulness/hallucination guardrails — verifies output is grounded in source |
| `faithfulness.test.ts` | Tests for faithfulness checks |
| `flashcardGenerate.ts` | `runFlashcardGenerate()` — orchestrates AI flashcard generation with LLM calls and repair |
| `flashcardGenerate.test.ts` | Tests for flashcard generate |
| `flashcardPrompt.ts` | Prompt builder for flashcard generation |
| `flashcardPrompt.test.ts` | Tests for flashcard prompt |
| `flashcardSchemas.ts` | Zod schemas for flashcard output, generation body, and concepts |
| `flashcardSchemas.test.ts` | Tests for flashcard schemas |
| `ingest.ts` | `runIngest()` — document ingestion engine: validates input, calls MarkItDown, stores raw markdown + metadata in Supabase |
| `ingest.test.ts` | Tests for ingest |
| `ingestSchemas.ts` | Zod schemas for ingest request body (paste, YouTube, file_ref) |
| `mapFlashcardOutputToRows.ts` | Maps flashcard generator output to Supabase row format |
| `mapFlashcardOutputToRows.test.ts` | Tests for flashcard row mapping |
| `mapQuizOutputToRows.ts` | Maps quiz generator output to Supabase row format |
| `mapQuizOutputToRows.test.ts` | Tests for quiz row mapping |
| `markitdown.ts` | Python MarkItDown CLI subprocess — `convertWithMarkItDown()`, `convertPasteWithMarkItDown()`, `convertUrlWithMarkItDown()` |
| `markitdown.test.ts` | Tests for markitdown |
| `quizGenerate.ts` | `runQuizGenerate()` — orchestrates AI quiz generation with LLM calls and repair |
| `quizGenerate.test.ts` | Tests for quiz generate |
| `quizPrompt.ts` | Prompt builder for quiz generation — loads spec, builds messages from canonical content |
| `quizPrompt.test.ts` | Tests for quiz prompt |
| `quizSchemas.ts` | Zod schemas for quiz generator output and generate body |
| `quizSchemas.test.ts` | Tests for quiz schemas |
| `validation.ts` | Input validation — MIME type allowlist, file size limits, paste length, YouTube URL validation |

#### `lib/profile/`

| File | Description |
|---|---|
| `displayNameStorage.ts` | Persists display name to localStorage |

#### `lib/review/`

| File | Description |
|---|---|
| `approvedBank.ts` | Approved bank utilities |
| `mcqDiagnostics.ts` | MCQ quality diagnostics |
| `validateMcq.ts` | MCQ validation — checks all options have 4 items, correct index is valid, etc. |

#### `lib/routes/`

| File | Description |
|---|---|
| `studySetPaths.ts` | Canonical URL builders — `newRoot()`, `newQuiz()`, `newFlashcards()`, `editQuiz(id)`, `editFlashcards(id)`, `quizPlay(id)`, `quizDone(id)`, `flashcardsPlay(id)`, `flashcardsDone(id)`, `studySetSource(id)` |

#### `lib/routing/`

| File | Description |
|---|---|
| `studySetContentKindRedirects.ts` | Content-kind based route redirect logic |

#### `lib/server/` — Server-Only AI & Config Helpers

| File | Description |
|---|---|
| `ai-agent-ping.ts` | `runAiAgentPing()` — tests AI provider by sending a short prompt, measures latency |
| `ai-agent-ping.test.ts` | Tests for AI agent ping |
| `ai-processing-config.ts` | Reads/wraps AI environment config — `AI_PROVIDER_URL`, `AI_PROVIDER_KEY`, model selection (free/pro), embeddings URL |
| `openAiChatCompletion.ts` | `postChatCompletionAssistantText()` — generic OpenAI-compatible chat completion with JSON mode, error mapping |
| `resolveUserAiTier.ts` | Resolves user's AI processing tier (`free` or `pro`) from env, app_metadata, or user_metadata |

#### `lib/supabase/` — Supabase Client Factories

| File | Description |
|---|---|
| `admin.ts` | `createSupabaseAdminClient()` — service_role client (bypasses RLS) |
| `auth-guard.ts` | `requireUser()` — server-side auth redirect guard for page components |
| `authErrors.ts` | Auth error message helpers |
| `browser.ts` | `createSupabaseBrowserClient()` — client-side browser client |
| `env.ts` | Supabase env var accessors — `getSupabaseUrl()`, `getSupabaseAnonKey()`, `getSupabaseServiceRoleKey()` |
| `env.test.ts` | Tests for env vars |
| `middlewareClient.ts` | `updateSession()` — Next.js middleware function for Supabase SSR session refresh + pathname tracking |
| `server.ts` | `createSupabaseServerClient()` — server-side cookies-based client |

#### `lib/ui/`

| File | Description |
|---|---|
| `studySetActionLabels.ts` | Human-readable labels for study set pipeline stage actions |

#### `lib/validations/`

| File | Description |
|---|---|
| `aiSettings.ts` | AI settings validation schemas |
| `question.ts` | Question validation schemas |

#### `lib/utils.ts`

| File | Description |
|---|---|
| `utils.ts` | `cn()` helper — merges Tailwind classes via `clsx` + `tailwind-merge` |

#### `lib/appEvents.ts`

| File | Description |
|---|---|
| `appEvents.ts` | Application-wide custom event name constants (e.g., `ACTIVITY_STATS_CHANGED_EVENT`) |

---

### `src/types/` — TypeScript Type Definitions

| File | Description |
|---|---|
| `aiProcessingUx.ts` | `AiProcessingUxStatus` — safe client-facing processing tier info |
| `flashcard.ts` | `FlashcardVisionItem`, `ApprovedFlashcardBank` — flashcard data types |
| `flashcardGeneration.ts` | `FlashcardGenerationConfig`, `FlashcardLearningDepth`, `FlashcardFocusMode` — generation controls with normalization |
| `flashcardSession.ts` | `FlashcardSessionState` — in-memory session state |
| `generatedQuiz.ts` | `GeneratedQuiz` — raw LLM quiz output shape |
| `question.ts` | `Question` — MCQ type with options + correctIndex + explanation. Also: `ApprovedBank`, localStorage key constants |
| `studySet.ts` | `PipelineStage`, `StudyContentKind`, `StudySetMeta`, `StudySetDocumentRecord` — core domain types |

---

### `src/hooks/`

(See hooks section above — physically located at `src/hooks/`)
