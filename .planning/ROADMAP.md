# Doc2Quiz — Roadmap

**Milestone:** v1 — Local Practice Loop
**Goal:** Upload PDF → AI questions → review → practice → score → repeat mistakes. Full loop working locally.
**Granularity:** Standard

---

## Phase 1: PDF Ingestion

**Goal:** User can upload a PDF, extract its text, and see it displayed.

**Status:** Pending

**Requirements covered:** PDF-01, PDF-02, PDF-03, PDF-04

**Deliverables:**
- UploadBox component — drag-and-drop + click, PDF-only validation, 10MB limit
- `extractText(file)` — pdf.js text extraction returning `{ text, pageCount }`
- RawTextViewer — scrollable display of extracted text
- Loading, error, and empty states (including scanned PDF error)

**Canonical refs:**
- `src/lib/pdf/extractText.ts`
- `src/components/upload/UploadBox.tsx`
- `src/components/viewer/RawTextViewer.tsx`

---

## Phase 2: AI Question Parsing

**Goal:** Given extracted text, use AI to produce a set of structured MCQ questions ready for review.

**Requirements covered:** AI-01, AI-02, AI-03, AI-04, AI-05

**Deliverables:**
- API key input UI — user enters Claude or OpenAI key, stored in localStorage
- Text chunker — splits extracted text into processable segments
- AI extraction service — sends chunks to AI, receives structured MCQ responses
- Question validator — ensures each parsed item has question + 4 options + valid answer
- Progress feedback UI — shows chunk-by-chunk progress during extraction
- Question data model + localStorage persistence layer

**Acceptance criteria:**
- User can enter and save an API key
- Uploading a typical exam PDF produces ≥10 usable questions
- Malformed AI responses are caught and skipped with a warning
- User sees per-chunk progress, not just a spinner

**Canonical refs:**
- `.planning/REQUIREMENTS.md` §AI Question Parsing
- `src/types/pdf.ts` — extend with Question type

---

## Phase 3: Question Review

**Goal:** User can inspect, edit, and approve AI-parsed questions before they enter the practice bank.

**Requirements covered:** REVIEW-01, REVIEW-02, REVIEW-03, REVIEW-04

**Deliverables:**
- Question list view — shows all parsed questions with question text, options, correct answer
- Inline edit mode — edit question, options, and correct answer selection
- Delete action — remove a question from the set
- Approve & Save action — commits the reviewed set to the question bank
- Question count summary (e.g., "18 questions ready — 2 deleted")

**Acceptance criteria:**
- User can edit any field of any question
- Deleted questions are removed immediately from the list
- Saving persists the approved set to localStorage/IndexedDB
- User cannot start practice without going through review (or explicitly skipping)

**Canonical refs:**
- `.planning/REQUIREMENTS.md` §Question Review
- `.planning/PROJECT.md` §Key Decisions (human-in-the-loop rationale)

---

## Phase 4: Practice Engine

**Goal:** User can drill through a question set using keyboard controls with immediate feedback.

**Requirements covered:** PRAC-01, PRAC-02, PRAC-03, PRAC-04, PRAC-05, PRAC-06

**Deliverables:**
- Practice screen layout — question display + 4 labeled options (A/B/C/D)
- Keyboard handler — 1/2/3/4 keys select options; Enter or auto-advance after answer
- Feedback display — immediate correct/incorrect highlight after selection
- Question navigation — back/forward arrow keys, question map sidebar
- Question map — visual grid showing answered/skipped/current status
- Session state management — tracks current question index and all answers

**Acceptance criteria:**
- 1/2/3/4 keys work from the moment the practice screen loads (no click required)
- Feedback appears within one render cycle of answering
- User can navigate back and change an unanswered question
- Question map updates in real time

**Canonical refs:**
- `.planning/REQUIREMENTS.md` §Practice Engine
- `src/types/` — Question and SessionState types

---

## Phase 5: Score & Repeat

**Goal:** User sees their score at the end of a session and can immediately drill the questions they got wrong.

**Requirements covered:** SCORE-01, SCORE-02, SCORE-03, SCORE-04

**Deliverables:**
- Results screen — score (X/Y correct, percentage), per-question breakdown
- Wrong-answer tracking — marks incorrect questions in the question bank
- "Drill mistakes" action — starts a new session with only wrong-answer questions
- Persistence — question bank with wrong-answer history survives browser refresh (localStorage/IndexedDB)

**Acceptance criteria:**
- Score is correct and shown immediately after last question
- "Drill mistakes" session contains only questions answered incorrectly in the previous session
- Reloading the browser preserves the question bank and wrong-answer history
- Wrong-answer count resets when a previously-wrong question is answered correctly

**Canonical refs:**
- `.planning/REQUIREMENTS.md` §Score & Repeat

---

## Phase 6: Pipeline Hardening & Observability

**Goal:** Reliable client IDs, structured pipeline logging, accurate import error surfacing, safe upgrade posture for pdf.js/Next.js, and OCR inspector UX fixes — without changing the v1 feature checklist of Phases 1–5.

**Status:** In progress (context locked; implementation incremental)

**Canonical refs:**
- `.planning/phases/06-pipeline-hardening/06-CONTEXT.md` — decisions from product/chat handoff

**Deferred (see CONTEXT):** Per-question image crops from OCR geometry; major framework/pdf.js bump until SSR isolation is designed.

---

## Phase 7: Layout-aware chunk-based parsing (token-optimized)

**Goal:** Replace default “full page image → one big vision JSON” with **OCR layout → semantic chunks → one small AI call per chunk → merge**, cutting tokens and improving accuracy. Keep **existing full-page vision as fallback** when chunk/OCR path fails or user chooses “accurate / full page” mode.

**Status:** Not planned yet

**Depends on:** Phase 6 (OCR output + observability); reuses `mapQuestionsToPages`, media attach patterns where applicable.

**Deliverables (high level):**
- **Chunk engine:** reading order `(y, x)`, question-boundary heuristics (e.g. `Câu 1`, `1.`), `Chunk { pageIndex, text, blocks[] }`, fallback 2–3 blocks if boundary unclear.
- **AI parse (text-first per chunk):** minimal prompt — exactly **one** MCQ JSON (`question`, `options`, `correctIndex`); optional spatial hints from bbox.
- **Merge engine:** dedupe by stem, validate 4 options, normalize text; integrate with existing `Question` model + draft persist.
- **Token hygiene:** trim noise, whitespace; optional pre-clean of OCR text.
- **Smart retry:** on chunk failure, retry with expanded chunk (next block(s)).
- **Confidence:** per-question scores (`parseScore`, structure validity, option count) for review UI / filtering.
- **Debug:** inspector (or overlay) shows **chunk → raw AI output → parsed question**.
- **Hybrid UX (bonus):** modes Fast (chunk) / Accurate (full-page vision) / Hybrid (auto: high OCR quality → chunk, else vision).

**Canonical refs:**
- `.planning/phases/07-layout-aware-chunk-based-parsing-token-optimized/07-CONTEXT.md` — product brief + **discuss outcomes (D-16–D-26)** + code integration notes
- `.planning/codebase/WORKFLOW-OCR-AI-QUIZ.md` — current pipeline
- `src/types/ocr.ts`, `src/lib/ai/runOcrSequential.ts`, `src/lib/ai/ocrAdapter.ts`
- `src/lib/ai/runVisionSequential.ts`, `src/components/ai/AiParseSection.tsx`

**Plans:** 2 — `07-01-PLAN.md` (chunk engine + single-MCQ parse), `07-02-PLAN.md` (orchestration, UI modes, fallback, debug). Execute wave 1 then wave 2.

---

## Phase 8: Flashcards mode

**Goal:** Add a dedicated **flashcard** study mode alongside MCQ play: flip front/back with keyboard, advance through cards, reusing **study sets** and **IndexedDB** (`StudySetMeta`, approved bank, media) — per `docs/BACKLOG-flashcards.md`.

**Status:** Context gathering (discuss-phase)

**Requirements covered:** (backlog — extend REQUIREMENTS when promoted) PRAC-adjacent study UX; no new cloud dependency.

**Deliverables (v1 scope):**
- **Data:** Derive card faces from existing **`Question`**: front = stem (+ optional `questionImageId`); back = correct option text (+ optional image on correct index) — **no** new persisted `Flashcard` type in v1.
- **UI:** Entry from set play flow — **either** segmented **Quiz | Flashcards** on `/sets/[id]/play` **or** dedicated **`/sets/[id]/flashcards`** under the same set layout (exact choice in phase CONTEXT).
- **Keyboard:** **Space** to flip; **ArrowLeft / ArrowRight** (or Up/Down) to previous/next card; focus management so keys work without a prior click (align with Phase 4 keyboard-first intent).
- **Session:** Card index + flipped state; optional thin progress (reuse patterns from `PlaySession` / set shell).

**Explicitly out of v1 (Phase 8):** standalone `Flashcard` schema + editor; AI emit flashcard JSON; spaced repetition / mistake deck (defer to later phases or backlog).

**Canonical refs:**
- `docs/BACKLOG-flashcards.md`
- `src/components/play/PlaySession.tsx` — MCQ session, bank load, media, results patterns
- `src/app/(app)/sets/[id]/play/page.tsx` — set play shell
- `src/lib/db/studySetDb.ts` — `getApprovedBank`, media
- `src/types/question.ts` — `Question`

---

## Phase 9: Math & notation preview (LaTeX-first, subject-ready)

**Goal:** Render **mathematical notation** in MCQ stems and options so quizzes work for **math-heavy material** first, with a **preview** of symbols/layout (fractions, roots, subscripts, Greek letters, etc.) — not “prettier plain text.” Lay groundwork so **other subjects** (physics, chemistry, …) can reuse the same **notation layer** later; **v1 of this phase focuses on math** (inline/display TeX-style delimiters from PDF/AI).

**Requirements:** TBD (promote from backlog when CONTEXT locked) — aligns with offline-first, no new cloud dependency for rendering.

**Depends on:** Phase 8 (or parallel if flashcards land later; confirm in discuss)

**Non-goals (defer):** Full subject-specific parsers (chem SMILES, circuit diagrams), new AI prompt formats solely for notation, spaced repetition.

**Deliverables (v1 scope — refine in `/gsd-discuss-phase 9`):**
- **Shared renderer:** One component (e.g. `MathText` / `RichQuestionText`) used everywhere stems/options surface — review, practice, previews (`QuestionCard`, `McqOptionsPreview`, `QuestionEditor`, play shell).
- **Math first:** Correct layout for typical exam LaTeX: `$...$`, `$$...$$`, `\frac`, `\sqrt`, subscripts/superscripts, Greek; graceful **fallback** when input is invalid TeX (show raw or error chip — decide in CONTEXT).
- **Preview:** User can **see rendered math** while editing/reviewing (WYSIWYG-ish), not only after save.
- **Safety:** Untrusted strings from AI/user — no raw `dangerouslySetInnerHTML` from delimiters alone; pin **KaTeX ≥ 0.16.21** (or chosen stack) and avoid risky `trust` / `\htmlData`-class vectors; sanitize or use library APIs only.
- **Stack choice (for discuss):** Default research lean — **KaTeX** (bundle size, sync render, App Router + CSS import); **MathJax 3** if CONTEXT locks “max LaTeX compatibility / accessibility”; note **MathML-native** path only if product wants native browser math (narrow support tradeoffs).

**Research summary (for planner; cite upstream docs in RESEARCH):**
- KaTeX: fast, smaller bundle, good for `$...$` MCQ text; security: keep current patch level, untrusted input discipline.
- MathJax 3: broader TeX, heavier; better a11y story in some setups; async `typeset` integration cost in React.
- Alternatives to skim in discuss: **Temml** (MathML-oriented fork of KaTeX ecosystem), **markdown pipeline** (`remark-math` + `rehype-katex`) if stems become mini-markdown — only if CONTEXT says yes.

**Canonical refs:**
- `docs/NOTES-latex-math-rendering.md` — problem statement, delimiter strategy, integration touchpoints (Vietnamese notes + implementation checklist).
- `src/types/question.ts` — `Question` text fields to wrap.
- Practice/review surfaces (grep `question` / `options` in `src/components` during plan).

**Plans:** 2 — `09-01-PLAN.md` (MathJax + `splitMathSegments` + `MathText`), `09-02-PLAN.md` (wire review / AI / play / flashcards). Execute wave 1 then wave 2.

---

## Coverage Check

| Phase | Requirements | Status |
|-------|-------------|--------|
| 1 | PDF-01–04 | Pending |
| 2 | AI-01–05 | Pending |
| 3 | REVIEW-01–04 | Pending |
| 4 | PRAC-01–06 | Pending |
| 5 | SCORE-01–04 | Pending |
| 6 | (hardening — see 06-CONTEXT) | In progress |
| 7 | (layout-aware parse — see 07-CONTEXT, 07-01/02 PLAN) | Complete |
| 8 | (flashcards — see `docs/BACKLOG-flashcards.md`, 08-CONTEXT) | Discuss |
| 9 | Math / LaTeX notation in stems & options (`docs/NOTES-latex-math-rendering.md`) | Not planned yet |

v1 requirements covered: 23 / 23 ✓

---

*Roadmap created: 2026-04-05*
*Milestone: v1 — Local Practice Loop*
