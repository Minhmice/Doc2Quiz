# Doc2Quiz — Roadmap

**Milestone:** v1 — Local Practice Loop
**Goal:** Upload PDF → AI questions → review → practice → score → repeat mistakes. Full loop working locally.
**Granularity:** Standard

---

## Phase 1: PDF Ingestion ✓

**Goal:** User can upload a PDF, extract its text, and see it displayed.

**Status:** Complete

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

## Coverage Check

| Phase | Requirements | Status |
|-------|-------------|--------|
| 1 | PDF-01–04 | ✓ Complete |
| 2 | AI-01–05 | Pending |
| 3 | REVIEW-01–04 | Pending |
| 4 | PRAC-01–06 | Pending |
| 5 | SCORE-01–04 | Pending |

v1 requirements covered: 23 / 23 ✓

---

*Roadmap created: 2026-04-05*
*Milestone: v1 — Local Practice Loop*
