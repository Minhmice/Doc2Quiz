# Generate flow (Backend): Quiz + Flashcards

## Purpose
Document the **current generation pipeline** from **New page upload → ingest → IndexedDB persist → inline AI parse → navigate to play** for both **Quiz** and **Flashcards**, focusing on **backend/data flow** (storage, persistence boundaries, and control flow).

## Scope
- Included: `/edit/new/*` pages, PDF ingest, study set creation in IDB, inline parse, persistence to approved banks, navigation to play route.
- Excluded: edit/review routes and post-play session tracking.

## Primary entrypoints
- New chooser: `src/app/(app)/edit/new/page.tsx`
- Quiz new page: `src/app/(app)/edit/new/quiz/page.tsx`
- Flashcards new page: `src/app/(app)/edit/new/flashcards/page.tsx`
- Shared ingest+parse flow: `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx`
- Parse orchestration + persistence: `src/components/ai/AiParseSection.tsx`
- IndexedDB API: `src/lib/db/studySetDb.ts`

## High-level pipeline (shared skeleton)

```mermaid
flowchart TD
  entry[UserChoosesQuizOrFlashcards] --> upload[UploadBox:onFileSelected]
  upload --> idb[ensureStudySetDb]
  idb --> pdfMeta[getPdfPageCount]
  pdfMeta --> text[extractPdfText]
  text --> naming[generateStudySetTitle]
  naming --> create[createStudySet(meta+document+draft)]
  create --> inline[InlineParse:AiParseSection.runParse]
  inline --> persist[PersistToApprovedBank + touchStudySetMeta(status=ready)]
  persist --> nav[router.push(playRoute)]

  inline -->|ok_but_no_usable_output| parseIssue[parseError]
  inline -->|fatal_or_aborted| parseIssue
  parseIssue --> retry[Retry]
  retry --> inline
  parseIssue --> cancel[CancelDismiss]
  cancel --> cleanup[deleteStudySet + clearParse]
```

## Step-by-step backend flow

### 0) Route selection (Quiz vs Flashcards)
From `src/app/(app)/edit/new/page.tsx`, user picks:
- Quiz → `newQuiz()` → `/edit/new/quiz`
- Flashcards → `newFlashcards()` → `/edit/new/flashcards`

Each format page renders `NewStudySetPdfImportFlow` with:
- `contentKind = "quiz" | "flashcards"`
- `getPostParseHref(id)` returning play routes:
  - quiz: `quizPlay(id)` → `/quiz/[id]`
  - flashcards: `flashcardsPlay(id)` → `/flashcards/[id]`

### 1) Upload + validation
In `NewStudySetPdfImportFlow`, `UploadBox` calls:
- `onValidationError(err)` → sets user-facing error for wrong file type/size.
- `onFileSelected(file)` → `handleFile(file)` kicks off the pipeline below.

### 2) Storage init
`handleFile()` begins at phase `"idb"`:
- `ensureStudySetDb()` opens the IDB and runs any migrations.

**Failure bucket:** `"idb"` → user sees storage error (via `userMessageForImportFailure("idb")`).

### 3) PDF ingest
`handleFile()` transitions to phase `"pdf"`:
- `getPdfPageCount(file)` → stores `pageCount` for UI and downstream parse limits.
- `extractPdfText(file)` → extracts the text layer (may be empty for scanned PDFs).

**Failure bucket:** `"pdf"` → user sees PDF open error message.

### 4) Naming
Still inside `handleFile()`:
- `generateStudySetTitle(extractedText, file.name)` produces `{ title, subtitle }`.
- Optional `titlePrefix` concatenation.

### 5) Create “empty” study set in IDB
`handleFile()` transitions to phase `"persist"` and calls:

- `createStudySet({ title, subtitle, sourceFileName, pageCount, extractedText, pdfFile: file, contentKind })`

In `src/lib/db/studySetDb.ts`, `createStudySet()` writes a single IDB transaction:
- **`meta` store**: `StudySetMeta` (createdAt, updatedAt, title/subtitle, sourceFileName, pageCount, status, contentKind)
  - Note: status is initialized as `"draft"` at create time.
- **`document` store**: `StudySetDocumentRecord` with:
  - `extractedText`
  - `pdfArrayBuffer` from `file.arrayBuffer()` (if provided)
  - `pdfFileName`
- **`draft` store**: initializes `{ questions: [] }` (legacy placeholder; not the source-of-truth for edit/play in this scope)

**Failure bucket:** `"persist"` → user sees “Could not save your study set…” message.

### 6) Inline parse (AI)
After create succeeds:
- If `runAiParseOnNewPage === true` (default), `NewStudySetPdfImportFlow` sets:
  - `parseContext = { studySetId, file, pageCount }`
  - `importPhase = "ai"`
  - renders embedded `AiParseSection` with:
    - `studySetId`
    - `activePdfFile = file`
    - `pageCount`
    - `surface="product"`
    - `parseOutputMode = parseOutputModeFromContentKind(contentKind)`

The user then clicks **Parse** → `AiParseSection.runParse()` executes the unified parse route (vision / OCR / chunk strategy).

### 7) Persist parse results to “approved bank”
Persistence happens **inside `AiParseSection`**:

#### 7a) Quiz lane (`parseOutputMode === "quiz"`)
`persistQuestions(qs)`:
- builds `ApprovedBank { version: 1, savedAt, questions: qs }`
- `putApprovedBankForStudySet(studySetId, bank)` → writes to **`approved`** store.
- `touchStudySetMeta(studySetId, { status: "ready" })`

#### 7b) Flashcards lane (`parseOutputMode === "flashcard"`)
`persistFlashcardVisionItemsForImmediateUse(items, generationConfig)`:
- normalizes/filters items (requires non-empty `front` and `back`, ensures each has an `id`)
- writes **`approvedFlashcards`** store via:
  - `putApprovedFlashcardBankForStudySet(studySetId, { version: 1, savedAt, items })`
- additionally writes to **`draft`** store via:
  - `putDraftFlashcardVisionItems(studySetId, items, generationConfig)`
- `touchStudySetMeta(studySetId, { status: "ready" })`

### 8) Decide “usable output” and navigate to play
Back in `NewStudySetPdfImportFlow.handleParseFinished(r)`:
- If parse run is `ok` **and** `parseRunHasUsableOutput(r, contentKind)`:
  - `clearParse(studySetId)`
  - `router.push(getPostParseHref(studySetId))`

Usable output rules:
- Flashcards: at least 1 item with both `front` and `back` non-empty.
- Quiz: at least 1 MCQ where `isMcqComplete(question)` is true.

If not usable or parse failed:
- `parseError` is set with one of:
  - fatalError from parse
  - “No usable items…” for ok-but-empty
  - “Parse did not finish…” for other failures

### 9) Cancel / cleanup semantics (important for UX)
`resetAfterInlineParse()` (used by Cancel or Dismiss):
- cancels running parse (`parseRef.current?.cancel()`)
- if an ID exists, attempts `deleteStudySet(id)` to remove all related data (meta/document/approved/approvedFlashcards/draft/media/ocr/parseProgress/etc)
- clears progress (`clearParse(id)` or `clearParse()`)
- resets component state to initial (upload step)

## IndexedDB stores touched in this flow
From `src/lib/db/studySetDb.ts`:
- **`meta`**: created in `createStudySet`; patched in `touchStudySetMeta`.
- **`document`**: created in `createStudySet` (stores extractedText + pdf buffer).
- **`draft`**: initialized in `createStudySet`; used for flashcard items mirror via `putDraftFlashcardVisionItems` (quiz lane should rely on approved bank).
- **`approved`**: quiz “approved bank” via `putApprovedBankForStudySet`.
- **`approvedFlashcards`**: flashcards “approved bank” via `putApprovedFlashcardBankForStudySet`.
- **`parseProgress`**: parse live progress (read/write via `useParseProgress` + `AiParseSection`).
- **`ocr`**: optional OCR snapshots used for page mapping.
- **`media`**: optional attached images (page images / option images), dependent on parse settings.

## Key deltas: Quiz vs Flashcards
- **Output lane**:\n  - Quiz persists `Question[]` to `approved`.\n  - Flashcards persists `FlashcardVisionItem[]` to `approvedFlashcards` (and mirrors to draft for immediate usage).\n- **Parse path**:\n  - Flashcards is “vision batch only” lane (theory/concept card generation).\n  - Quiz can use OCR/chunk/hybrid strategies and may attach page images to questions.\n- **Usable output check** differs (MCQ complete vs non-empty front/back cards).\n- **UI live preview polling** (backend-wise, reads approved bank): quiz has a panel that polls `getApprovedBank(studySetId)` while parsing.\n+
