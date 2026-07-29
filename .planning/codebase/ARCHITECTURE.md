# Doc2Quiz Architecture

## High-Level Architecture

Doc2Quiz is a **Next.js 16 App Router** application (TypeScript, React 19) that turns uploaded documents into interactive study materials — multiple-choice quizzes and flashcards — via an AI processing pipeline.

### Route Groups

The application uses three top-level route groups:

| Route Group | Path Prefix | Purpose |
|---|---|---|
| `(app)` | `/dashboard`, `/edit/*`, `/quiz/*`, `/flashcards/*` | Authenticated pages — protected by `requireUser()` server-side auth gate in `(app)/layout.tsx` |
| `(auth)` | `/login`, `/signup`, `/logout` | Unauthenticated pages — wrapped in `AuthShell` layout |
| `api` | `/api/*` | Server-side route handlers — protected by `requireApiUser()` middleware |

### Rendering Model

- **Server components** for page shells, layouts, and initial auth checks
- **Client components** (`"use client"`) for interactive panels — quiz sessions, flashcard review, import flows, dashboards
- Dynamic imports (`next/dynamic`) with `{ ssr: false }` for heavy components like `CommandPalette`
- `(app)/template.tsx` wraps pages in a `PageTransition` component for route-level fade-in animation

### State & Data Layer

| Layer | Technology | Purpose |
|---|---|---|
| Auth | Supabase SSR (`@supabase/ssr`) | Cookie-based session management — Server Components use `createSupabaseServerClient()`, client uses `createSupabaseBrowserClient()` |
| Database | Supabase Postgres | Study set metadata, canonical documents/sections, approved questions/flashcards, activity tracking |
| File Storage | Supabase Storage (`doc2quiz` bucket) | Original uploaded files |
| Offline Cache | IndexedDB (planned via `studySetDb.ts`) | Offline-capable study set operations (currently backed by Supabase directly) |
| AI | Server-side OpenAI-compatible chat | No client-side API keys — all LLM calls go through `postChatCompletionAssistantText()` |

### AI Processing

AI document processing is **server-only**. The stack is:

1. **MarkItDown** (Python subprocess) — converts uploaded PDFs, DOCX, PPTX, pasted text, or YouTube URLs to Markdown
2. **Canonicalize** — LLM call to extract structured knowledge (sections, concepts, metadata) from raw Markdown
3. **Quiz/Flashcard generation** — LLM call to produce questions or flashcards from canonical knowledge
4. **Faithfulness checks** — Post-LLM guardrails that verify the output is grounded in the source document

All AI calls use `postChatCompletionAssistantText()`, a thin wrapper around OpenAI-compatible `/chat/completions` endpoints. Model routing is determined by `resolveUserAiTier()` which checks user metadata for "pro" status.

### Python Subprocess

- `requirements.txt` requires `markitdown[all]==0.1.6`
- `src/lib/pipeline/markitdown.ts` spawns `python -m markitdown <input> -o <output>` as a child process
- Python executable resolved from `MARKITDOWN_PYTHON` env var, falling back to `.venv/bin/python` (or `.venv\Scripts\python.exe` on Windows), then `python`

---

## Key Data Flow

### End-to-End Pipeline

```
Upload -> Ingest -> Canonicalize -> Generate -> Review -> Practice -> Drill Mistakes
```

### Step-by-Step

1. **User uploads a document** (or pastes text / YouTube URL) on `/edit/new/quiz` or `/edit/new/flashcards`
   - `ingestStudySetSource()` (client) creates a study set record in Supabase via `POST /api/study-sets`
   - Files go directly as multipart or via Supabase Storage (for files >10MB)
   - Pipeline stage: `input`

2. **POST /api/study-sets/[id]/ingest**
   - `runIngest()` calls MarkItDown subprocess to convert the document to Markdown
   - Raw Markdown stored in `canonical_documents.raw_markdown`
   - Original file stored in Supabase Storage at `{userId}/{studySetId}/{filename}`
   - Pipeline stage advances: `raw`

3. **POST /api/study-sets/[id]/canonicalize**
   - `runCanonicalize()` reads raw Markdown, sends to LLM with a structured prompt
   - LLM returns: title, language, sections (with headings + content), extracted questions, metadata
   - Results stored in `canonical_documents.canonical_markdown` and `canonical_sections` table
   - Faithfulness checks validate title is source-grounded, filenames are valid, sections are non-empty
   - Pipeline stage advances: `canonical`

4. **User selects content type** on the source review page (`/sets/[id]/source`)
   - `CanonicalModeSelectionFooter` shows "Generate Quiz" or "Generate Flashcards" actions
   - For flashcards, a `FlashcardSetupWizard` collects learning goals, coverage, and count

5. **POST /api/study-sets/[id]/quiz/generate** or **/flashcards/generate**
   - `runQuizGenerate()` / `runFlashcardGenerate()` send canonical markdown + sections to LLM
   - LLM returns structured output (questions with 4 options, or front/back flashcard pairs)
   - Results deduplicated, capped, and inserted into `approved_questions` or `approved_flashcards` tables
   - Faithfulness checks validate concepts and questions map to real sections
   - Pipeline stage advances: `quiz` or `flashcards`

6. **User reviews and edits questions** at `/edit/quiz/[id]` or `/edit/flashcards/[id]`
   - `ReviewSection` loads `approved_questions` from Supabase, allows editing each question
   - `FlashcardReviewWorkspace` loads `approved_flashcards`, allows editing front/back text
   - Changes saved back via `putApprovedBankForStudySet()` / `putApprovedFlashcardBankForStudySet()`

7. **User practices** at `/quiz/[id]` or `/flashcards/[id]`
   - `QuizSession` renders one question at a time with keyboard-first interaction (1/2/3/4 keys)
   - `FlashcardSession` shows front/back with flip animation, keyboard navigation
   - Mistakes tracked in `quiz_sessions` and `study_wrong_history` tables in Supabase

8. **Mistake drill loop**
   - After completing a quiz, `/quiz/[id]/done` offers "Drill mistakes" link with `?review=mistakes` param
   - `QuizSession` accepts `reviewMistakesOnly` to filter to previously wrong questions
   - Activity tracking in `src/lib/client/activityTracking.ts` handles session recording

---

## Route Structure

### Page Routes

| Path | File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Redirects to `/dashboard` |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | Dashboard home with library, hero, stats |
| `/edit/new` | `src/app/(app)/edit/new/page.tsx` | Format selection (quiz vs flashcards) |
| `/edit/new/quiz` | `src/app/(app)/edit/new/quiz/page.tsx` | Upload/paste text for quiz creation |
| `/edit/new/flashcards` | `src/app/(app)/edit/new/flashcards/page.tsx` | Upload/paste text for flashcard creation |
| `/edit/quiz/[id]` | `src/app/(app)/edit/quiz/[id]/page.tsx` | Review and edit generated quiz questions |
| `/edit/flashcards/[id]` | `src/app/(app)/edit/flashcards/[id]/page.tsx` | Review and edit generated flashcards |
| `/quiz/[id]` | `src/app/(app)/quiz/[id]/page.tsx` | Interactive quiz taking (keyboard-first) |
| `/quiz/[id]/done` | `src/app/(app)/quiz/[id]/done/page.tsx` | Quiz completion results + mistake drill |
| `/flashcards/[id]` | `src/app/(app)/flashcards/[id]/page.tsx` | Interactive flashcard review |
| `/flashcards/[id]/done` | `src/app/(app)/flashcards/[id]/done/page.tsx` | Flashcard session complete |
| `/sets/[id]/source` | `src/app/(app)/sets/[id]/source/page.tsx` | Canonical knowledge preview + generate/regenerate |
| `/sets/[id]/parse` | `src/app/(app)/sets/[id]/parse/page.tsx` | Legacy redirect to edit pages |
| `/settings` | `src/app/(app)/settings/page.tsx` | Language selector, dev engine panel, data export |
| `/login` | `src/app/(auth)/login/page.tsx` | Login form |
| `/signup` | `src/app/(auth)/signup/page.tsx` | Signup form |
| `/logout` | `src/app/(auth)/logout/route.ts` | POST/GET logout handler |

### API Routes

| Path | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check (status, timestamp, uptime) |
| `/api/ai/ping` | GET | Tests AI provider connectivity |
| `/api/ai/dev-engine-panel` | GET, POST | Dev-only AI config inspection + ping test |
| `/api/auth/signup` | POST | User registration (email + password) |
| `/api/study-sets` | GET, POST | List user's study sets / create new |
| `/api/study-sets/[id]` | GET, PATCH, DELETE | Read, update, delete a study set |
| `/api/study-sets/[id]/ingest` | POST | Upload file / paste text → MarkItDown conversion |
| `/api/study-sets/[id]/canonicalize` | POST | AI extraction of structured knowledge |
| `/api/study-sets/[id]/canonical` | GET | Fetch canonical document + sections |
| `/api/study-sets/[id]/quiz/generate` | POST | AI generates MCQ questions |
| `/api/study-sets/[id]/flashcards/generate` | POST | AI generates flashcards |

### Legacy Redirects (next.config.ts)

Multiple `/sets/*` and `/new/*` paths redirect to the canonical `/edit/*` routes.

---

## Data Model

### Key Tables (Supabase Postgres)

#### `study_sets`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users |
| `title` | text | Study set title |
| `subtitle` | text? | Optional subtitle |
| `pipeline_stage` | text | One of: `input`, `raw`, `canonical`, `mode_selected`, `quiz`, `flashcards` |
| `content_kind` | text? | `quiz` or `flashcards` |
| `source_type` | text? | How the source was provided |
| `section_key` | text? | Reference to canonical section |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `canonical_documents`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `study_set_id` | UUID | FK to study_sets |
| `user_id` | UUID | FK to auth.users |
| `original_storage_path` | text | Path in Supabase Storage |
| `original_filename` | text | Original uploaded filename |
| `original_mime_type` | text | MIME type |
| `raw_markdown` | text | MarkItDown output (raw) |
| `canonical_markdown` | text | AI-structured markdown |
| `metadata` | jsonb | Language, topics, extraction status, warnings |

#### `canonical_sections`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `canonical_document_id` | UUID | FK to canonical_documents |
| `user_id` | UUID | FK to auth.users |
| `ordinal` | int | Section ordering |
| `heading` | text | Section heading |
| `body_markdown` | text | Section content |
| `section_type` | text | `theory`, `question`, `answer_key`, `example`, `reference` |
| `section_key` | text | Stable ID like `sec_001` |

#### `approved_questions` (MCQ bank)
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `study_set_id` | UUID | FK to study_sets |
| `user_id` | UUID | FK to auth.users |
| `prompt` | text | Question text |
| `choices` | text[] | 4 options |
| `correct_index` | int | 0-3 |
| `explanation` | text? | LLM-generated explanation |
| `source` | jsonb | Source chunk/concept references |
| `tags` | text[] | Concept IDs |

#### `approved_flashcards`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `study_set_id` | UUID | FK to study_sets |
| `user_id` | UUID | FK to auth.users |
| `front` | text | Card front |
| `back` | text | Card back |
| `tags` | text[] | Concept IDs |
| `source` | jsonb | Source references |

#### Session & Activity Tracking
- `quiz_sessions` — Records completed quiz attempts (total questions, correct count, timestamps)
- `study_wrong_history` — Tracks missed question IDs per study set for drill loop

---

## Component Architecture

### Dashboard (`DashboardHomeClient`)
- **`DashboardHero`** — Stats, resume/continue CTA, create new button
- **`DashboardLibraryClient`** — Filterable, sortable list of study sets with `DashboardStudySetCard`
- **`DashboardMobileBottomNav`** — Mobile navigation
- **`StreakFlameChip`** — Study streak indicator
- **`RenameStudySetDialog`** — Inline rename

### Practice Sessions
- **`QuizSession`** — Interactive quiz engine (keyboard-first: 1/2/3/4 for answers, Enter to confirm)
- **`FlashcardSession`** — Flashcard flip with keyboard navigation
- **`QuizInteractionHints`** / **`FlashcardInteractionHints`** — Keyboard shortcut guides

### Edit & Review
- **`ReviewSection`** — Question review/editor with navigator, approve/reject, save to bank
- **`QuestionCard`** — Display MCQ question with options
- **`QuestionEditor`** — Inline edit form for questions
- **`ReviewList`** — Scrollable question list
- **`QuestionReviewNavigator`** — Sidebar question index with status dots
- **`FlashcardReviewWorkspace`** — Flashcard review/editor side-by-side

### Import Pipeline
- **`UnifiedInputZone`** — Upload box, paste text area, YouTube URL input — triggers ingest
- **`IngestProgressCard`** — Shows ingestion progress (validating → uploading → converting → done)
- **`CanonicalizeProgressCard`** — Shows canonicalization progress
- **`QuizGenerateProgressCard`** / **`FlashcardGenerateProgressCard`** — Generation progress
- **`FlashcardSetupWizard`** — Configuration for flashcard generation (learning goal, coverage, count)

### Layout
- **`AppShell`** — Main authenticated shell with `AppTopBar` and `LibrarySearchProvider`
- **`AppTopBar`** — Top navigation with search, theme toggle, API status, language selector
- **`CommandPalette`** — Keyboard command palette (deferred load via requestIdleCallback)
- **`PageTransition`** — Fade-in animation on route change
- **`ApiStatusIndicator`** — Shows AI provider connection status
- **`ThemeToggle`** — Dark/light mode toggle
- **`StudySetFlowPageShell`** — Reusable page shell for multi-step study set flows

### Providers
- **`AppRootProviders`** — Wraps root layout: `TooltipProvider` + `Toaster` (sonner)
- **`AppProviders`** — Wraps authenticated routes: `LocaleProvider` + `DisplayNameProvider` + `AppShell`
- **`LocaleProvider`** — i18n with slang/encouragement system
- **`LibrarySearchProvider`** — Dashboard search context

---

## Key Design Patterns

### Server Components for Auth Gating
The `(app)/layout.tsx` calls `requireUser()` from `src/lib/supabase/auth-guard.ts` which redirects unauthenticated users to `/login`. API routes use `requireApiUser()` which returns a 401 JSON response.

### Supabase SSR Cookie Auth
- Server: `createSupabaseServerClient()` — reads cookies from `next/headers`
- Client: `createSupabaseBrowserClient()` — standard `createBrowserClient`
- Admin: `createSupabaseAdminClient()` — service_role key, bypasses RLS (server-only)
- Middleware: `updateSession()` refreshes auth tokens on every request + tracks pathname

### File-Based Routing with Route Groups
Route groups `(app)` and `(auth)` keep authenticated and unauthenticated routes visually separate while sharing the same domain. API routes in `api/` are isolated.

### Dynamic Imports for Heavy Client Components
`CommandPalette` uses `next/dynamic(() => import(...), { ssr: false })` and defers loading via `requestIdleCallback` to avoid blocking initial render.

### Pipeline Stage State Machine
Each study set moves through a linear pipeline:
```
input → raw → canonical → mode_selected → quiz|flashcards
```
Server-side business logic validates stage transitions (e.g., you cannot generate questions before canonicalization).

### Window-Specific Webpack Workarounds
`next.config.ts` disables disk cache and sets `poll: 1000` on Windows to work around ENOENT race conditions in `.next/dev/cache/webpack`.

### Chunk Load Recovery
An inline script (`chunkLoadRecoveryScript.ts`) in the root layout catches chunk load errors and silently reloads the page (up to 2 retries) — handles Windows dev server instability gracefully.

### Faithfulness / Hallucination Guardrails
Each AI pipeline step runs post-LLM checks in `src/lib/pipeline/faithfulness.ts`:
- **Canonicalize** — Verifies title is grounded in source, sections are non-empty, filenames are well-formed
- **Quiz** — Validates `concept_id` references map to real sections, answer choices are distinct
- **Flashcard** — Validates concept/section references are valid
