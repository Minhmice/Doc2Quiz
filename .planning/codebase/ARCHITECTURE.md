# Architecture

**Analysis Date:** 2026-04-14

## Pattern Overview

**Overall:** Next.js App Router monolith with a browser-first pipeline. Server code is limited to Route Handlers (AI forward + optional image staging + stubs), while ingestion, parsing orchestration, storage, review, and study are primarily client-side.

**Key Characteristics:**
- **Local-first persistence** via IndexedDB (`src/lib/db/studySetDb.ts`) with schema constants `DB_NAME`, `DB_VERSION = 6` (`src/types/studySet.ts`).
- **BYOK, forward-only AI**: AI credentials live in browser `localStorage` and are forwarded through `POST /api/ai/forward` (`src/lib/ai/forwardSettings.ts`, `src/app/api/ai/forward/route.ts`).
- **Two content lanes**: quiz (MCQ) and flashcards (vision-only theory cards), separated at both UX and storage layers (`src/types/visionParse.ts`, `src/lib/db/studySetDb.ts`).

## Layers

**Routing & shell:**
- Purpose: layouts, navigation, route boundaries, redirects
- Location: `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/page.tsx`, route groups under `src/app/(app)/**`
- Used by: all pages

**UI components:**
- Purpose: dashboard, import flows, parse UI, review UI, study sessions
- Location: `src/components/**`

**Domain + pipeline libraries:**
- Purpose: ingestion (PDF), AI parsing, validation, page mapping, persistence helpers
- Location: `src/lib/**`

**Types/contracts:**
- Purpose: canonical models shared across UI + libs
- Location: `src/types/**`

**API surface (Route Handlers):**
- Purpose: same-origin forward to vendor APIs; optional image staging; stub parse-queue endpoints
- Location: `src/app/api/**`

## Data Flow

**Study set creation and persistence:**
1. Create set meta + initial document in IndexedDB (`src/lib/db/studySetDb.ts`: `createStudySet`, `putDocument`, `putStudySetMeta`).
2. Store PDF bytes (`pdfArrayBuffer`) + extracted text (`extractedText`) in `document` store (`src/types/studySet.ts`).

**Parse orchestration (client):**
1. Rasterize PDF pages → JPEG data URLs (`src/lib/pdf/renderPagesToImages.ts`).
2. Optional OCR prefetch in developer surfaces (not in product surfaces) (`src/components/ai/AiParseSection.tsx`, `src/lib/ai/runOcrSequential.ts`).
3. Vision parse:
   - **Quiz**: sequential vision or vision-batch depending on “attach page images” and strategy (`src/components/ai/AiParseSection.tsx`, `src/lib/ai/runVisionSequential.ts`, `src/lib/ai/runVisionBatchSequential.ts`).
   - **Flashcards**: vision-batch only (`src/components/ai/AiParseSection.tsx`, `src/lib/ai/runVisionBatchSequential.ts`).
4. Validate + dedupe results (`src/lib/ai/validateVision*`, `src/lib/ai/visionDedupe.ts`, `src/lib/ai/dedupeQuestions.ts`).
5. Persist to lane-specific stores in IndexedDB (`src/lib/db/studySetDb.ts`).

**Review and study:**
1. Review edits drafts / approves banks (quiz review pages and components under `src/app/(app)/edit/**`, `src/components/review/**`).
2. Study reads approved banks and runs sessions (`src/app/(app)/quiz/[id]/page.tsx`, `src/components/quiz/QuizSession.tsx`; flashcards: `src/app/(app)/flashcards/[id]/page.tsx`, `src/components/flashcards/FlashcardSession.tsx`).

## Flashcards Workflow Invariants (Vision-only lane)

**Invariant 1 — vision-only generation (no OCR/chunk/hybrid):**
- Flashcards are produced by **vision batch parsing only**, not by layout chunking, OCR gating, or MCQ extraction.
  - Guardrails:
    - Prompt contract and “theory-only” requirement are codified in `src/lib/ai/visionPrompts.ts` (flashcard branch of `buildVisionSystemPrompt` and `buildVisionUserPrompt`).
    - UI orchestration forces batch path for flashcards (`parseOutputMode === "flashcard"` in `src/components/ai/AiParseSection.tsx`), including explicit errors if layout chunk parse is attempted.

**Invariant 2 — theory-only (no MCQ carriers, no `Question[]` in flashcard output):**
- Flashcard outputs are `FlashcardVisionItem` and `ApprovedFlashcardBank`, not `Question[]`.
  - Types: `src/types/visionParse.ts` (`FlashcardVisionItem`, `ApprovedFlashcardBank`)
  - Parsing: `src/lib/ai/parseVisionFlashcardResponse.ts` (schema `{ cards: [...] }`; never uses the MCQ parser path)

**Invariant 3 — storage separation: `approvedFlashcards` store:**
- Approved flashcards are persisted in the dedicated IndexedDB object store **`approvedFlashcards`** (`src/lib/db/studySetDb.ts`).
- Persisting an approved flashcard deck also clears the quiz-shaped `approved` row for the same set to prevent mixing lanes:
  - `putApprovedFlashcardBankForStudySet` writes to `approvedFlashcards` and writes an empty `approved.questions` payload (`src/lib/db/studySetDb.ts`).
- One-time migration from legacy “MCQ carrier” encoding exists and only runs for `meta.contentKind === "flashcards"`:
  - `migrateLegacyFlashcardCarrierToApprovedFlashcards` (`src/lib/db/studySetDb.ts`)

**Invariant 4 — required grounding (`sourcePages`) in flashcard mode:**
- Flashcard prompt requires `sourcePages` per card, using 1-based PDF page indices (`src/lib/ai/visionPrompts.ts`).
- Validation enforces page bounds when strict mode is used (`src/lib/ai/runVisionBatchSequential.ts` + `src/lib/ai/validateVisionFlashcardItems.ts`).

**Invariant 5 — flashcard generation controls influence prompts and persistence:**
- User-facing controls are `FlashcardGenerationConfig`:
  - Types + normalization: `src/types/flashcardGeneration.ts` (`normalizeFlashcardGenerationConfig`, targetCount clamp 10–60)
  - UI: `src/components/edit/new/flashcards/FlashcardsGenerationControls.tsx`
- The config is passed into the vision system/user prompts (`src/lib/ai/visionPrompts.ts`) and is preserved alongside flashcard draft writes:
  - Draft persistence: `putDraftFlashcardVisionItems` stores `flashcardGenerationConfig` in `draft` rows (`src/lib/db/studySetDb.ts`)

## Entry Points

**Web entry:**
- `src/app/page.tsx` redirects to `/dashboard`

**Flashcards:**
- New import: `src/app/(app)/edit/new/flashcards/page.tsx`
- Review/edit: `src/app/(app)/edit/flashcards/[id]/page.tsx`
- Study: `src/app/(app)/flashcards/[id]/page.tsx`
- Done: `src/app/(app)/flashcards/[id]/done/page.tsx`

**Quiz:**
- Study: `src/app/(app)/quiz/[id]/page.tsx`

## Error Handling

**Strategy:** fail-soft with partial progress + explicit fatal errors for auth/rate limits.

**Patterns:**
- Fatal errors: `src/lib/ai/errors.ts` (`FatalParseError`)
- Abort handling: `AbortController` used in `src/components/ai/AiParseSection.tsx`
- Optional error reporting: Sentry init (`sentry.*.config.ts`, `instrumentation.ts`)

## Cross-Cutting Concerns

**Logging:** `src/lib/logging/pipelineLogger.ts` (pipeline events + optional verbose mode)
**Validation:** `src/lib/validations/**`, `src/lib/ai/validate*`, `src/lib/review/validateMcq.ts`
**Authentication:** none (v1); BYOK keys stored in browser and forwarded per request (`src/lib/ai/forwardSettings.ts`)

---

*Architecture analysis: 2026-04-14*
