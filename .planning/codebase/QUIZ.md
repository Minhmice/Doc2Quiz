# Quiz area — current codebase map

This document describes the current Quiz product path in Doc2Quiz based on the live codebase. It focuses on the learner-facing flow that starts with importing a document and ends with quiz practice, plus the storage, parsing, and review behavior that support that flow.

Scope covered in this scan:

- quiz creation and import routes
- review/edit routes
- quiz play and done routes
- IndexedDB storage for study sets, approved banks, media, and activity
- AI vision parse pipeline and supporting PDF ingestion
- current UX states, safeguards, and constraints visible in code

---

## 1) What the Quiz product path is for

The Quiz path is the multiple-choice study workflow.

At a high level it lets a learner:

1. choose **Create Quiz**
2. upload a PDF
3. save the PDF and extracted text into local study-set storage
4. run an AI vision parse that generates strict 4-option MCQs
5. review and correct the generated question bank
6. practice the quiz with keyboard shortcuts
7. persist local quiz results and wrong-answer history for future review

The main distinction from the Flashcards path is that Quiz uses:

- `contentKind: "quiz"`
- `parseOutputMode: "quiz"`
- `Question[]` / `ApprovedBank` storage
- review UI for MCQ completeness and correct-answer selection
- quiz session persistence in `quizSessions` and `studyWrongHistory`

Relevant type and route anchors:

- `src/types/studySet.ts`
- `src/types/question.ts`
- `src/types/visionParse.ts`
- `src/lib/routes/studySetPaths.ts`

---

## 2) End-to-end flow: new study set import → quiz practice

### 2.1 Entry selection

The format chooser at `src/app/(app)/edit/new/page.tsx` lets the learner choose between Quiz and Flashcards.

For Quiz, the CTA points to:

- `/edit/new/quiz`
- helper: `newQuiz()` in `src/lib/routes/studySetPaths.ts`

### 2.2 New quiz import page

`src/app/(app)/edit/new/quiz/page.tsx` renders the Quiz-specific import workbench and mounts:

- `QuizNewImportWorkbench`
- `NewStudySetPdfImportFlow` with `contentKind="quiz"`

The page copy makes the intended path explicit: upload a document, generate a quiz, then go directly into practice.

### 2.3 Ingest and local study-set creation

`src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx` owns the initial import pipeline.

When a file is selected, it:

1. validates and accepts the file via `UploadBox`
2. ensures IndexedDB is available with `ensureStudySetDb()`
3. reads PDF page count via `getPdfPageCount()`
4. extracts text from the text layer via `extractPdfText()`
5. generates a study-set title via `generateStudySetTitle()`
6. creates the study set via `createStudySet()`

`createStudySet()` in `src/lib/db/studySetDb.ts` writes three stores in one transaction:

- `meta`
- `document`
- `draft`

The created `StudySetMeta` is initially:

- `status: "draft"`
- `contentKind: "quiz"`
- timestamped with `createdAt` / `updatedAt`

The document row stores:

- extracted text
- optional PDF array buffer
- original PDF file name

### 2.4 Inline parse handoff

After study-set creation, the import flow does not navigate to a separate parse page for the current product flow. Instead it sets a `parseContext` and keeps the learner in the same workbench.

The embedded parser is `AiParseSection`, configured with:

- `surface="product"`
- `parseOutputMode={parseOutputModeFromContentKind(contentKind)}`
- quiz therefore resolves to `parseOutputMode: "quiz"`

If the parse succeeds and produces usable MCQs, `NewStudySetPdfImportFlow` redirects to:

- `quizPlay(id)` → `/quiz/[id]`

If the parse finishes but no usable complete MCQs exist, the page keeps the learner in the import flow and shows a retry/start-over path.

### 2.5 AI parse and bank persistence

For Quiz, `AiParseSection` persists results into the approved quiz bank, not a flashcard bank.

`persistQuestions()` in `src/components/ai/AiParseSection.tsx`:

- creates an `ApprovedBank`
- writes it with `putApprovedBankForStudySet(studySetId, bank)`
- marks the set `status: "ready"` using `touchStudySetMeta()`

### 2.6 Review/edit

The quiz review route is `/edit/quiz/[id]`.

`src/app/(app)/edit/quiz/[id]/page.tsx`:

- loads `StudySetMeta`
- redirects flashcard sets away from the quiz editor
- renders `ReviewSection` for quiz sets

The review screen loads the approved quiz bank from IndexedDB and allows inline correction before the learner returns to the library or re-enters practice.

### 2.7 Quiz practice

The main play route is `/quiz/[id]`.

`src/app/(app)/quiz/[id]/page.tsx` renders:

- `PlaySession`
- `QuizPlayNavigator` when session metrics are available

`PlaySession` loads the approved bank, filters to complete MCQs, and drives the actual practice loop.

### 2.8 Session completion

When the stitched quiz theme is used on `/quiz/[id]`, finishing the run automatically redirects to:

- `/quiz/[id]/done`

`src/app/(app)/quiz/[id]/done/page.tsx` shows:

- study-set title and subtitle
- source file label
- approved question count
- latest score from `quizSessions`
- links back to Library and Review

During completion, `recordQuizCompletion()` stores:

- a `quizSessions` record
- the last wrong-question list in `studyWrongHistory`

That wrong-answer history powers mistake-only review in the play route via `?review=mistakes`.

---

## 3) Current pages and routes

### Product entry and legacy redirects

- `src/app/(app)/edit/new/page.tsx`
  - format chooser for Quiz vs Flashcards
- `src/app/(app)/edit/new/quiz/page.tsx`
  - current Quiz import experience
- `src/app/(app)/sets/new/quiz/page.tsx`
  - legacy redirect to the new quiz route

### Review/edit

- `src/app/(app)/edit/quiz/[id]/page.tsx`
  - quiz review page
- `src/app/(app)/edit/quiz/[id]/layout.tsx`
  - wraps review in `StudySetFlowPageShell`
- `src/app/(app)/sets/[id]/parse/page.tsx`
  - legacy redirect to the edit route after determining `contentKind`

### Practice

- `src/app/(app)/quiz/[id]/page.tsx`
  - quiz play surface
- `src/app/(app)/quiz/[id]/layout.tsx`
  - wraps play view in `StudySetFlowPageShell` with `variant="flush"`
- `src/app/(app)/quiz/[id]/done/page.tsx`
  - post-practice summary
- `src/app/(app)/sets/[id]/practice/page.tsx`
  - legacy redirect to `/quiz/[id]`

### Related but not core to the current product lane

- `src/app/(app)/sets/[id]/source/page.tsx`
  - part of the broader study-set flow, but the current new-quiz experience parses inline on the new import page

---

## 4) Key components and their responsibilities

### Import flow

#### `NewStudySetPdfImportFlow`
File: `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx`

Primary responsibilities:

- ingest the selected PDF
- create the study set in IndexedDB
- keep import and parse in one workbench
- hold `parseContext` for the inline parse stage
- redirect to the post-parse destination on success
- show user-facing ingest and parse failure messages

Important behavior:

- It checks for “usable output” by requiring complete MCQs for quiz mode.
- It surfaces practical user messages for storage failure, PDF failure, and empty parse output.
- It supports cancel/reset by deleting the transient study set when an inline parse is cancelled mid-flow.

#### `QuizNewImportWorkbench`
File: `src/components/edit/new/quiz/QuizNewImportWorkbench.tsx`

Responsibilities:

- provides Quiz-specific page chrome/backdrop
- wraps the new import step context provider
- sets the full-height workspace layout used during import/parsing

#### `UnifiedImportStatusCard`
File: `src/components/edit/new/import/UnifiedImportStatusCard.tsx`

Responsibilities:

- renders the current ingest or parse status banner
- switches between ingest-step chrome and live parse progress
- shows the active file name and product label
- allows cancel during an active parse when supported

#### `ImportQuizLivePanel`
File: `src/components/edit/new/import/ImportQuizLivePanel.tsx`

Responsibilities:

- polls the approved quiz bank during import/parse
- shows imported questions as they appear in IndexedDB
- mixes live question cards with skeleton placeholders
- provides navigator support while parse results stream in
- supports optimistic correct-answer changes during import review

Notable behavior:

- polls every 650 ms
- only runs for `contentKind === "quiz"`
- intentionally tolerates transient IDB read/write errors during polling

### Parse orchestration

#### `AiParseSection`
File: `src/components/ai/AiParseSection.tsx`

This is the main parse orchestrator for both product and developer surfaces. For the Quiz product path, the important current contract is stricter than some older internal paths.

For Quiz in the product flow:

- parse mode is `quiz`
- parse is batch vision only
- OCR is skipped in product mode
- attach-page-image sequential parsing is not used for the main product lane
- successful results are persisted directly to the approved quiz bank

It also:

- writes parse progress into UI state and the `parseProgress` store
- logs per-stage progress lines for the workbench
- supports cancellation with `AbortController`
- reloads approved questions after completion

### Review/edit

#### `ReviewSection`
File: `src/components/review/ReviewSection.tsx`

Responsibilities:

- loads the approved quiz bank
- tracks the active and editing question
- auto-saves edits and correct-index changes back to IndexedDB
- deletes attached media when questions are removed
- blocks final save if any question is incomplete
- marks the study set `ready` on successful final save

Review summary information shown in the UI includes:

- total questions
- incomplete question count
- removed question count
- uncertain page-mapping count

It also shows a warning when page mapping is uncertain or missing.

#### `ReviewList`
File: `src/components/review/ReviewList.tsx`

Responsibilities:

- renders each question card
- wires edit/save/delete/correct-answer actions to `QuestionCard`

#### `QuestionReviewNavigator`
File: `src/components/review/QuestionReviewNavigator.tsx`

Responsibilities:

- shows the question grid for quick navigation
- marks incomplete questions in amber
- optionally renders the final status line and Done button in the same card shell

### Practice

#### `PlaySession`
File: `src/components/quiz/QuizSession.tsx`

This is the main quiz runtime.

Responsibilities:

- loads the approved bank
- filters to `isMcqComplete(q)` questions only
- optionally restricts the session to previously missed questions
- tracks current question, chosen option, score, and wrong IDs
- records completion when the quiz is finished
- redirects to the done page in the stitched product theme

Keyboard behavior:

- `1`–`4` pick answers
- `Enter`, space, or `ArrowRight` move forward after reveal

Supporting pieces in the same file:

- `QuizPlayNavigator` shows question states: upcoming, current, correct, incorrect
- `MediaImage` loads question media from IndexedDB blobs
- result rendering shows per-question correctness once finished

#### `QuizInteractionHints`
File: `src/components/quiz/QuizInteractionHints.tsx`

Responsibilities:

- displays keyboard hint chips for quiz interaction
- emphasizes the keyboard-first nature of the practice flow

---

## 5) AI / vision parse pipeline for Quiz

### 5.1 Current lane contract

The current code clearly separates Quiz and Flashcards as explicit parse lanes.

Relevant files:

- `src/components/ai/AiParseSection.tsx`
- `src/lib/ai/runVisionBatchSequential.ts`
- `src/types/visionParse.ts`

For Quiz specifically:

- `parseOutputMode === "quiz"`
- the model must emit `QuizVisionItem[]`
- each quiz item must be a strict 4-option MCQ
- quiz output must not be mixed with flashcard output

### 5.2 Ingest-side PDF preparation

Before AI parsing begins, the import flow already stores:

- text extracted from the PDF text layer via `extractPdfText()`
- page count via `getPdfPageCount()`
- original PDF bytes in IndexedDB when available

This supports naming, route decisions, and future reference, but the current product quiz parse itself is vision-first.

### 5.3 Rendering PDF pages to images

`AiParseSection` calls `renderPdfPagesToImages()` before running the vision batch parse.

Visible constraints in code:

- rendering is capped by `VISION_MAX_PAGES_DEFAULT`
- the parse progress UI logs rasterized pages as they are produced
- if zero pages render, the run fails with a user-visible error

### 5.4 Product-surface OCR behavior

Although `AiParseSection` contains OCR-related logic and developer-oriented parse modes, the product Quiz lane explicitly skips OCR in this path.

The critical condition is here:

- the product surface passes `forceSkipOcr` for quiz/flashcard runs
- `enableOcrEffective` is additionally disabled on `surface === "product"`

Practical implication:

- the new learner-facing Quiz flow currently depends on vision parsing of rendered pages rather than OCR-assisted product parsing
- OCR support remains in the codebase for non-product/developer scenarios and supporting workflows

### 5.5 Batch vision parse engine

The active engine is `runVisionBatchSequential()` in `src/lib/ai/runVisionBatchSequential.ts`.

Its current behavior:

- prefers the `min_requests` batching preset
- tries to cover as many pages as possible per request
- uses strict JSON/object prompting for OpenAI-compatible multimodal chat
- stages image data before forwarding to the upstream model
- retries per batch up to `MAX_BATCH_ATTEMPTS = 2`
- falls back to `legacy_10_2` windows when a one-shot full-document batch fails and fallback criteria are met

The file-level header documents the intent clearly:

- prefer the fewest requests possible
- fall back to legacy `10 + overlap 2` windows if the single large batch fails

### 5.6 Why staging exists

The quiz batch engine does not directly send local `data:` URLs upstream without preparation. Instead it stages page images through:

- `stageVisionDataUrlsBatch()` client helper
- `POST /api/ai/vision-staging`

`src/app/api/ai/vision-staging/route.ts` supports two modes:

1. **Blob-backed public staging** when `BLOB_READ_WRITE_TOKEN` exists
2. **same-origin in-memory staging** when no blob token exists

Important practical caveat visible in code and surrounding behavior:

- same-origin staging uses local server URLs; this is fine for the app itself but can be unsuitable for remote upstream model providers that cannot fetch local/dev-only origins
- blob-backed staging is the more robust path for remote AI providers

Route safeguards:

- maximum batch size is 20 images
- each image must be a valid base64 data URL
- image bytes must be within `VISION_STAGING_MAX_BYTES`
- batch mode returns partial per-image results rather than failing the whole request format silently

### 5.7 Forward proxy behavior and timeout-related design choices

The app forwards provider requests through:

- `src/app/api/ai/forward/route.ts`

Current safeguards/design choices visible in code:

- only `https` targets are allowed, except `http://localhost` and `http://127.0.0.1`
- OpenAI-compatible and custom providers are authorized with Bearer tokens
- anthropic-style forwarding uses `x-api-key`
- missing `max_tokens` on chat-completions requests is normalized to `16384`

This max-token cap is important because the code comments explicitly say it is meant to reduce runaway completions and long wall times.

`runVisionBatchSequential()` also adds:

- `max_tokens: 16384` to chat completion bodies
- `response_format: { type: "json_object" }` when supported by the path

These are concrete anti-timeout / anti-runaway design choices now present in code.

### 5.8 Batch progress, dedupe, and completion behavior

`AiParseSection` logs and surfaces the parse in distinct phases:

- vision batch plan start
- per-batch extraction progress
- optional legacy-window retry
- `Deduplicating and validating...`
- final persistence/completion

The UI log explicitly includes a legacy fallback line:

- `Retrying vision with legacy windows (..., 10+overlap2)`

That means future debugging should treat fallback behavior as an intentional part of the current design, not an accidental edge case.

### 5.9 What gets converted into quiz questions

The vision parse returns `QuizVisionItem` objects, which are mapped into persisted `Question` records.

Core quiz item fields:

- `question`
- `options: [A, B, C, D]`
- `correctIndex`
- `confidence`
- optional `sourcePages`
- optional `includePageImage`

After mapping, persisted `Question` rows can also carry:

- `sourcePageIndex`
- `sourceImageMediaId`
- `imagePageIndex`
- OCR/page mapping metadata
- `parseConfidence`
- `parseStructureValid`

### 5.10 Persistence target for quiz output

The quiz lane persists to the approved quiz bank in the `approved` object store.

`putApprovedBankForStudySet()` also deletes any flashcard-approved row for the same study set when quiz questions are written, preventing cross-lane state confusion.

---

## 6) Storage and data model relevant to quiz sets

### 6.1 IndexedDB database shape

Defined in `src/types/studySet.ts` and opened in `src/lib/db/studySetDb.ts`.

Current DB constants:

- `DB_NAME = "doc2quiz"`
- `DB_VERSION = 6`

Stores relevant to Quiz:

- `meta`
- `document`
- `draft`
- `approved`
- `media`
- `parseProgress`
- `ocr`
- `quizSessions`
- `studyWrongHistory`

There is also `approvedFlashcards`, but that belongs to the flashcard lane.

### 6.2 `StudySetMeta`

Defined in `src/types/studySet.ts`.

Relevant fields:

- `id`
- `title`
- `subtitle`
- `sourceFileName`
- `pageCount`
- `status: "draft" | "ready"`
- `contentKind?: "quiz" | "flashcards"`
- optional OCR fields

For the Quiz path, `contentKind` is the main lane discriminator used to route or redirect between quiz and flashcard experiences.

### 6.3 `StudySetDocumentRecord`

Stores source-document data:

- `studySetId`
- `extractedText`
- `pdfArrayBuffer?`
- `pdfFileName?`

This is how the app retains the local source artifact after import.

### 6.4 Approved quiz bank

Defined by `ApprovedBank` in `src/types/question.ts`.

Shape:

- `version: 1`
- `savedAt`
- `questions: Question[]`

This approved bank is the main handoff artifact between:

- parse
- review
- practice

### 6.5 Media storage

Question-related media is stored separately in the `media` object store.

Used for:

- page images or question media persisted by ID
- later retrieval in practice/review via `getMediaBlob()`

`ReviewSection` explicitly cleans up media when questions are deleted.

### 6.6 Parse progress storage

`AiParseSection` mirrors parse progress into `parseProgress` so embedded workbench status can survive and be re-read from IndexedDB.

Current tracked fields:

- `running`
- `phase`
- `current`
- `total`
- `updatedAt`

Phases are defined in `src/types/studySet.ts` as:

- `idle`
- `rendering_pdf`
- `text_chunks`
- `ocr_extract`
- `vision_pages`

### 6.7 Quiz activity storage

`src/lib/sets/activityTracking.ts` writes two quiz-specific artifacts:

- `quizSessions`: session score history
- `studyWrongHistory`: most recent wrong-question IDs for that set

This enables:

- the score shown on `/quiz/[id]/done`
- mistake-only practice via `/quiz/[id]?review=mistakes`
- dashboard activity statistics

---

## 7) Review/edit behavior in detail

### Loading and lane protection

`EditQuizReviewPage` first loads the study-set meta. If the set is actually a flashcard set, it redirects to the flashcard edit route instead of rendering the quiz review UI.

This is an explicit safety check against route/content mismatch.

### Autosave editing model

Within `ReviewSection`, these actions update the approved bank immediately:

- save question edits
- set `correctIndex`
- delete a question

After each change, the code also calls `touchStudySetMeta()` to keep the set fresh.

### Completion gating

The review flow only considers the bank saveable when all questions are complete MCQs.

Validation helpers:

- `isMcqComplete`
- `allMcqsComplete`
- from `src/lib/review/validateMcq`

If incomplete questions remain, the UI shows:

- `Some questions are incomplete. Please fix before saving.`

### Current “Done” behavior

`handleDone()` in `ReviewSection` saves the approved bank, touches the meta with `status: "ready"`, and then routes the user to:

- `/dashboard`

So the current quiz review exit path returns to the library, not directly back into practice.

### Mapping awareness

Review also surfaces uncertain source-page mapping counts using `countUncertainMappings()`.

This is relevant because the system keeps provenance-related data on questions, but the code treats some mappings as uncertain and asks the user to inspect them manually.

---

## 8) Practice behavior in detail

### Loading rules

`PlaySession` only makes complete MCQs playable.

It loads:

- `getApprovedBank(studySetId)`
- then filters with `isMcqComplete`

That means incomplete generated questions can exist in storage during editing, but they will not appear in practice.

### Mistake-only mode

The play page reads:

- `searchParams.get("review") === "mistakes"`

When true, `PlaySession` narrows the question list to IDs returned by `getMistakeQuestionIds(studySetId)`.

This provides a lightweight remediation loop without creating a second bank.

### Runtime interaction model

While the session is active:

- choosing an answer sets `picked`
- advancing records correct vs incorrect
- incorrect questions are added to `wrongIdsRef`
- correct answers increment `correctCount`

When finished:

- `recordQuizCompletion()` runs once per session
- the product-themed route redirects to `/quiz/[id]/done`

### Session metrics for surrounding UI

`PlaySession` reports metrics upward so `/quiz/[id]` can render:

- top progress strip
- completion percentage
- `QuizPlayNavigator`

Navigator states are derived from current/finished state and wrong-answer history in the live session.

### Empty and error states

Practice explicitly handles:

- loading state
- load failure state
- no-question state
- no-mistakes-to-review state

This matters for future work because the session component already distinguishes between “bank missing”, “empty playable set”, and “mistake review has nothing to show”.

---

## 9) UX states and key user actions

### New quiz import

Key user actions:

- choose Quiz format
- upload PDF
- wait for local ingest
- observe live generation progress
- cancel parse if needed
- retry if no usable questions were generated

Visible UX states in code:

- upload screen
- ingest-in-progress screen
- parse-preparing screen
- live parse workbench with progress banner
- parse error / retry state
- inline live question preview while results stream in

### Review

Key user actions:

- inspect generated MCQs
- edit question text or options
- set the correct answer
- remove bad questions
- save/finish when all MCQs are complete

Visible UX states:

- loading skeletons
- empty review state with links back to new import or library
- incomplete warning state
- uncertain page-mapping warning state
- sticky navigator for large question sets

### Practice

Key user actions:

- answer with `1`–`4`
- advance with keyboard after reveal
- restart the set
- review only prior mistakes
- open Review from the done screen

Visible UX states:

- loading
- load error
- empty playable bank
- no missed questions to review
- playing
- finished / done summary

---

## 10) Error handling and safeguards visible in code

### Import and storage safeguards

`NewStudySetPdfImportFlow` provides phase-specific error buckets:

- IndexedDB access failure
- PDF opening/extraction failure
- study-set persistence failure

It also validates its own required props so the flow fails loudly in development if post-create/post-parse destinations are misconfigured.

### Parse capability gating

`AiParseSection` disables parse actions when required inputs are missing, including:

- no active PDF file
- no API key
- invalid custom endpoint/model configuration
- blocked forward surface/capability state
- already running parse

### Vision parse failure handling

The vision batch engine explicitly handles:

- invalid JSON from upstream
- empty model content
- HTML returned instead of JSON
- per-batch failures with retries
- fallback from full-document parse to legacy overlapping windows
- aborted runs

### Route/lane mismatch safeguards

There are explicit redirects when route and `contentKind` disagree:

- flashcards opened on quiz edit route redirect away
- legacy parse/practice routes resolve by content kind or redirect to the canonical quiz route

### Review integrity safeguards

Review blocks final save when any MCQ is incomplete.

Practice separately filters to complete MCQs, so incomplete records are prevented from breaking runtime play.

---

## 11) Current constraints and caveats visible in code

### 11.1 Quiz product parse is vision-first, not OCR-first

Even though OCR infrastructure exists, the learner-facing Quiz product lane currently skips OCR and runs the batch multimodal parse on rendered page images.

Implication:

- scanned and text PDFs both go through the same product parse lane here
- OCR-backed parse quality improvements are not currently part of the main new-quiz product path

### 11.2 Product quiz/flashcard lanes are intentionally strict and separate

The current code repeatedly enforces that Quiz and Flashcards are separate parse lanes.

Implication:

- future work should avoid shared output coercion between `Question[]` and flashcard items
- route and storage logic assume this separation

### 11.3 Parse success requires usable complete questions

The new import flow does not treat any raw parse output as success. For quiz mode, it requires at least one complete MCQ.

Implication:

- partially structured or malformed model output may still count as a failed import experience even if some raw items were returned

### 11.4 Current review exit goes back to library

The review Done action currently returns to `/dashboard`, not to quiz play.

Implication:

- the end-to-end product flow is not a single forced chain of import → review → play
- import success goes directly to play, while later review completion returns to library

### 11.5 Live parse preview reads from approved storage

`ImportQuizLivePanel` polls the approved bank during parsing.

Implication:

- parsing and persistence are tightly coupled to the approved bank for quiz import UX
- future refactors should preserve the expectation that live imported questions can surface incrementally

### 11.6 Remote model compatibility depends on forwarding + image staging

The app assumes an OpenAI-compatible multimodal chat endpoint for the quiz product parse path.

Implication:

- incorrect custom endpoints, non-multimodal models, or remote providers that cannot fetch staged URLs will fail in ways that look like parse failure rather than simple UI errors

### 11.7 Page/image limits exist

The batch planner and staging route both encode page/image limits.

Implication:

- very large documents are not treated as infinite-length parse inputs in the current product design
- future work on long-document handling should consider chunking, pagination, and staging cost explicitly

---

## 12) Files most important for future quiz development

### Product flow and routes

- `src/app/(app)/edit/new/page.tsx`
- `src/app/(app)/edit/new/quiz/page.tsx`
- `src/app/(app)/edit/quiz/[id]/page.tsx`
- `src/app/(app)/quiz/[id]/page.tsx`
- `src/app/(app)/quiz/[id]/done/page.tsx`
- `src/lib/routes/studySetPaths.ts`

### Import and parsing

- `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx`
- `src/components/ai/AiParseSection.tsx`
- `src/lib/ai/runVisionBatchSequential.ts`
- `src/app/api/ai/forward/route.ts`
- `src/app/api/ai/vision-staging/route.ts`
- `src/lib/pdf/extractPdfText.ts`

### Review and practice

- `src/components/review/ReviewSection.tsx`
- `src/components/review/ReviewList.tsx`
- `src/components/review/QuestionReviewNavigator.tsx`
- `src/components/quiz/QuizSession.tsx`
- `src/components/quiz/QuizInteractionHints.tsx`

### Storage and types

- `src/lib/db/studySetDb.ts`
- `src/lib/sets/activityTracking.ts`
- `src/types/studySet.ts`
- `src/types/question.ts`
- `src/types/visionParse.ts`

---

## 13) Practical mental model for the current Quiz lane

If you need to reason about the current implementation quickly, the shortest accurate mental model is:

- a Quiz set is a local `StudySetMeta + StudySetDocumentRecord`
- the new product flow creates that set first, then parses inline
- parsing is currently product-facing vision batch generation over rendered page images
- results are written to `approved.questions`
- review edits that approved bank in place
- practice only uses complete MCQs from that bank
- completed sessions write score history and wrong-answer history locally

That is the core product loop the current codebase supports.