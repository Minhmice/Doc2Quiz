# Requirements: Doc2Quiz

**Defined:** 2026-04-05
**Core Value:** The practice loop must feel faster and more effective than reading the PDF directly.

## v1 Requirements

### PDF Ingestion

- [x] **PDF-01**: User can upload a PDF file (.pdf only, max 10MB)
- [x] **PDF-02**: System extracts text from text-based PDFs via pdf.js
- [x] **PDF-03**: System displays extracted text in scrollable viewer
- [x] **PDF-04**: System shows clear error for scanned/empty PDFs ("This PDF may be scanned. Text extraction failed.")

### AI Question Parsing

- [x] **AI-01**: User can enter and save their AI API key (stored in localStorage; forwarded per request via same-origin route, not stored server-side)
- [x] **AI-02**: System chunks extracted text into segments suitable for AI processing
- [x] **AI-03**: AI converts chunks into structured MCQ format: question + 4 options + correct answer index
- [x] **AI-04**: System validates parsed question structure (has question, exactly 4 options, valid answer index)
- [x] **AI-05**: User sees progress feedback during AI extraction ("Parsing questions... 3/8 chunks done")

### Question Review

- [x] **REVIEW-01**: User can view all AI-parsed questions before saving
- [x] **REVIEW-02**: User can edit question text, any option text, and the correct answer
- [x] **REVIEW-03**: User can delete any question from the set
- [x] **REVIEW-04**: User can approve the set and save it to the question bank

### Practice Engine

- [x] **PRAC-01**: User can start a practice session from a saved question set
- [x] **PRAC-02**: User answers with keyboard keys 1/2/3/4 (maps to A/B/C/D)
- [x] **PRAC-03**: System shows immediate correct/incorrect feedback after each answer
- [x] **PRAC-04**: System advances to next question automatically after answering
- [x] **PRAC-05**: User can navigate back to a previous question (arrow keys or on-screen nav)
- [x] **PRAC-06**: User sees a question map showing answered/unanswered status

### Score & Repeat

- [x] **SCORE-01**: System displays score at end of session (X/Y correct, percentage)
- [x] **SCORE-02**: System tracks which questions were answered incorrectly
- [x] **SCORE-03**: User can start a drill session with only wrong-answer questions
- [x] **SCORE-04**: Question bank (questions + wrong-answer history) persists in localStorage/IndexedDB across browser sessions

## v2 Requirements

### Multi-Document Bank

- **BANK-01**: User can import multiple PDFs into a merged question bank
- **BANK-02**: User can tag questions by document source
- **BANK-03**: User can filter practice sessions by tag/source

### Practice Modes

- **MODE-01**: Timed mode — countdown per question or per session
- **MODE-02**: Exam simulation — fixed question count, no feedback until end
- **MODE-03**: Spaced repetition weighting based on wrong-answer history

### Export / Share

- **EXPORT-01**: User can export question set as JSON
- **EXPORT-02**: User can import a JSON question set from another user

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud sync / own backend | No server in v1; adds deployment complexity with no v1 benefit |
| User accounts / auth | Single-user local tool; no accounts needed |
| Local Tesseract-style OCR | Not bundled; scanned PDFs use optional multimodal OCR/vision via user API instead |
| Teacher/institution features | v1 is student-only; institutional tooling is a different product |
| Analytics dashboards | Score + wrong-answer loop is sufficient for v1 learning signal |
| Real-time collaboration | Single-user tool |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PDF-01 | Phase 1 | Complete |
| PDF-02 | Phase 1 | Complete |
| PDF-03 | Phase 1 | Complete |
| PDF-04 | Phase 1 | Complete |
| AI-01 | Phase 2 | Complete |
| AI-02 | Phase 2 | Complete |
| AI-03 | Phase 2 | Complete |
| AI-04 | Phase 2 | Complete |
| AI-05 | Phase 2 | Complete |
| REVIEW-01 | Phase 3 | Complete |
| REVIEW-02 | Phase 3 | Complete |
| REVIEW-03 | Phase 3 | Complete |
| REVIEW-04 | Phase 3 | Complete |
| PRAC-01 | Phase 4 | Complete |
| PRAC-02 | Phase 4 | Complete |
| PRAC-03 | Phase 4 | Complete |
| PRAC-04 | Phase 4 | Complete |
| PRAC-05 | Phase 4 | Complete |
| PRAC-06 | Phase 4 | Complete |
| SCORE-01 | Phase 5 | Complete |
| SCORE-02 | Phase 5 | Complete |
| SCORE-03 | Phase 5 | Complete |
| SCORE-04 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-11 — checkboxes and traceability aligned with shipped v1 (`src/`, `STATE.md`)*
