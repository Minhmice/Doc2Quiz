# Requirements: Doc2Quiz

**Defined:** 2026-04-05
**Core Value:** The practice loop must feel faster and more effective than reading the PDF directly.

## v1 Requirements

### PDF Ingestion

- [x] **PDF-01**: User can upload a PDF file (.pdf only, max 10MB)
- [x] **PDF-02**: System extracts text from text-based PDFs via pdf.js
- [x] **PDF-03**: System displays extracted text in scrollable viewer
- [x] **PDF-04**: System shows clear error for scanned/empty PDFs ("This PDF may be scanned. Text extraction failed.")

### v1+ Enhancements (Optimizations)

- [x] **PDFOPT-01**: System computes a document-level **native text-layer signal** using sampling (chars/page + non-empty page ratio) to detect born-digital PDFs.
- [x] **PDFOPT-02**: When strong text is detected, quiz parsing auto-routes to **text-first** and **skips page rasterization**; Accurate remains vision-first.
- [x] **PDFOPT-03**: Text-first parsing uses a deterministic **quality gate** and can automatically fallback to vision when results are weak (e.g. <5 questions and/or low validity summary).
- [x] **PDFOPT-04**: Routing + fallback emit stable **reason codes** and short user-visible messages (overlay log + light toast on fallback).

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

## v1+ Requirements (Phases 26+)

### Direct multipart/resumable upload to object storage (Phase 26)

- [x] **UPLOAD-01**: Env-gated optional object-storage upload path; when not configured, local-only behavior is unchanged. (D-01)
- [x] **UPLOAD-02**: Direct upload of original PDF bytes supports resumable/multipart semantics through an adapter contract. (D-04, D-08)
- [x] **UPLOAD-03**: Upload uses presigned URLs with short TTL and requires a server finalize step; finalize failure is user-visible. (D-09, D-10, D-11)
- [x] **UPLOAD-04**: Upload UX supports bytes-based progress, cancel, and same-session auto-retry/resume on network drops. (D-07, D-13, D-14, D-15)
- [x] **UPLOAD-05**: Object keys are random uploadId + sanitized suffix; do not embed original filename/PII. (D-03)
- [x] **UPLOAD-06**: Storage retention uses short TTL and has a documented expiry/cleanup story (provider-agnostic). (D-05)

### Preview-first parsing while upload continues (Phase 27)

- [ ] **PREVIEW-01**: Parse starts immediately after PDF file selection, without waiting for any background upload to complete.
- [ ] **PREVIEW-02**: Preview is incremental streaming: quiz questions / flashcards appear as they are produced (no “wait until finished” gate).
- [ ] **PREVIEW-03**: Preview-first applies to both Quiz and Flashcards create flows.
- [ ] **PREVIEW-04**: Preview prioritizes the first 3–5 pages (aligned with PDF sampling budget) to minimize time-to-first-results.
- [ ] **PREVIEW-05**: UI shows a sticky top progress strip combining parse progress and (when enabled) background upload byte progress.
- [ ] **PREVIEW-06**: User can Cancel-all to cancel parse + upload and clean up the in-progress set (no “trash sets” left behind).
- [ ] **PREVIEW-07**: Entering study/play is blocked until background upload completes when direct-upload is enabled.
- [ ] **PREVIEW-08**: When background upload completes, UI shows a light toast “Upload complete” (or equivalent short copy).
- [ ] **PREVIEW-09**: Study set metadata (and `studySetId`) is created/persisted first so preview is not blocked by full PDF bytes persistence.
- [ ] **PREVIEW-10**: Preview parsing always runs from the local `File` via pdf.js; it does not depend on remote upload URLs.
- [ ] **PREVIEW-11**: If upload capability is not configured/available, upload UI is hidden and the flow behaves as local-only (no cloud messaging).
- [ ] **PREVIEW-12**: If upload fails with a non-retryable/finalize error, the flow cancels everything and returns to start (no continuing into study).
- [ ] **PREVIEW-13**: If parse fails or produces no usable output while upload is OK, the user can retry parse / adjust settings (consistent with existing parse UX).
- [ ] **PREVIEW-14**: Refresh/close mid-flow is not resumable; user returns to upload step on reload.

### Image preprocessing in Web Workers (Phase 28)

- [x] **PERF-28-01**: JPEG resize + encode happens in a Web Worker when available; single sequential worker; keep `dataUrl: string` output contract (`data:image/jpeg;base64,...`).
- [x] **PERF-28-02**: Auto-fallback to existing main-thread preprocessing when worker/image APIs are unavailable or worker fails; no new UI controls; AbortSignal cancellation remains correct.

### Route by page type (Phase 29)

- [x] **ROUTE-29-01**: Compute per-page **text-layer signals** (numeric-only) using pdf.js text content sampling/scan.
- [x] **ROUTE-29-02**: Classify pages as **text vs bitmap** using deterministic thresholds derived from existing text-layer signals (chars/page + non-empty ratio), without requiring OCR in product create flows.
- [x] **ROUTE-29-03**: Build a serializable **page routing plan** that preserves existing caps: preview-first 3–5 pages; vision max pages default 20; routing must not increase vision workload beyond these caps.
- [x] **ROUTE-29-04**: Routing emits stable **reason codes** to pipeline logs; no new UI controls.

### Layout-aware chunking from pdf.js text layer + geometry (Phase 30)

- [x] **LAYOUT-30-01**: Layout chunk source uses **pdf.js text layer + geometry** in product flow (no OCR dependency).
- [x] **LAYOUT-30-02**: Chunk granularity is deterministic **layout blocks** (paragraph-ish), targeting ~1–2 MCQs per chunk.
- [x] **LAYOUT-30-03**: Layout chunking applies only to Phase 29 `text` pages; bitmap pages remain vision.
- [x] **LAYOUT-30-04**: Preserve preview-first (3–5 pages) and allow **per-page and/or per-chunk** fallback to vision without falling back the whole document.

### Parse cache: content hashes + prompt/model/provider keys (Phase 31)

- [x] **CACHE-31-01**: Parse caches are **browser-local only** (IndexedDB and optional in-memory fallback); no server-side or cross-user shared cache. (D-01)
- [x] **CACHE-31-02**: Cache keys include **content fingerprint** (SHA-256 via `crypto.subtle` when available, else deterministic fallback), **resolved model id**, **`openai` vs `custom` forward provider**, and **prompt identity** so incompatible configurations never share entries. (D-02, D-03, D-07)
- [x] **CACHE-31-03**: **Same cache contract** (lane enum, value shape, key derivation) for **vision batch**, **sequential multi-MCQ text** (`parseChunkOnce`), and **single-MCQ layout/OCR text** (`parseChunkSingleMcqOnce`). (D-08)
- [x] **CACHE-31-04**: **Unified prompt versioning:** `mcq-extraction.prompts.json` **`version`** is the bundle revision; keys include identity derived from **hash of the exact system prompt string** used for that call (vision: API `systemText`; text: `MCQ_*` constants). `VISION_BATCH_PROMPT_V` is not the sole authority. (D-03)
- [x] **CACHE-31-05**: Vision batch cache is **durable** in IndexedDB with **in-memory fallback** when IDB is unavailable; **no cross-configuration false hits** (prompt/model/provider/content). (D-04, D-06)
- [x] **CACHE-31-06**: `runSequentialParse` and layout-driven parsing benefit via **`parseChunk*`** cache integration without breaking progress/abort contracts. (D-08)
- [x] **CACHE-31-07**: **Bounded caches:** per-store **max 400 entries** and **~15 MiB** estimated payload budget; **LRU by `lastAccessedAt`** on read/write. (D-06)
- [x] **CACHE-31-08**: **No embedding storage** and **no RAG product UI** in Phase 31 (deferred to Phase 33+). (D-05)

### Draft pass + validator pass (Phase 32)

- [ ] **DRAFT-32-01**: **Per-chunk contract:** after draft MCQ extraction from a text/layout chunk, run validation before merging into the accumulated question list (matches `32-CONTEXT` D-01).
- [ ] **DRAFT-32-02**: **Hybrid validator:** deterministic/schema repair first; **LLM-based validator/rewrite only when** local repair cannot produce a valid item set; emit **stable reason codes** in pipeline logs (D-02).
- [ ] **DRAFT-32-03**: **Always run** the validator stage on the success path when a draft completes (user accepts extra token cost); do not silently skip for savings (D-03).
- [ ] **DRAFT-32-04**: **Quiz and Flashcards** share the same two-pass policy **where** the pipeline uses chunk/batch text extraction (vision-only flashcard flows document any exception in code comments) (D-04).
- [ ] **DRAFT-32-05**: **User-visible toast** when the validator pass runs (short copy; may throttle across chunks) (D-05).
- [ ] **DRAFT-32-06**: **Cache compatibility:** validator LLM calls use **distinct prompt identity** in Phase 31 cache keys (separate system prompt / lane metadata) so draft hits never mask validator misses (extends CACHE-31-03..04).

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
| UPLOAD-01 | Phase 26 | Complete |
| UPLOAD-02 | Phase 26 | Complete |
| UPLOAD-03 | Phase 26 | Complete |
| UPLOAD-04 | Phase 26 | Complete |
| UPLOAD-05 | Phase 26 | Complete |
| UPLOAD-06 | Phase 26 | Complete |
| PREVIEW-01 | Phase 27 | Planned |
| PREVIEW-02 | Phase 27 | Planned |
| PREVIEW-03 | Phase 27 | Planned |
| PREVIEW-04 | Phase 27 | Planned |
| PREVIEW-05 | Phase 27 | Planned |
| PREVIEW-06 | Phase 27 | Planned |
| PREVIEW-07 | Phase 27 | Planned |
| PREVIEW-08 | Phase 27 | Planned |
| PREVIEW-09 | Phase 27 | Planned |
| PREVIEW-10 | Phase 27 | Planned |
| PREVIEW-11 | Phase 27 | Planned |
| PREVIEW-12 | Phase 27 | Planned |
| PREVIEW-13 | Phase 27 | Planned |
| PREVIEW-14 | Phase 27 | Planned |
| PERF-28-01 | Phase 28 | Completed |
| PERF-28-02 | Phase 28 | Completed |
| CACHE-31-01 | Phase 31 | Complete |
| CACHE-31-02 | Phase 31 | Complete |
| CACHE-31-03 | Phase 31 | Complete |
| CACHE-31-04 | Phase 31 | Complete |
| CACHE-31-05 | Phase 31 | Complete |
| CACHE-31-06 | Phase 31 | Complete |
| CACHE-31-07 | Phase 31 | Complete |
| CACHE-31-08 | Phase 31 | Complete |
| DRAFT-32-01 | Phase 32 | Planned |
| DRAFT-32-02 | Phase 32 | Planned |
| DRAFT-32-03 | Phase 32 | Planned |
| DRAFT-32-04 | Phase 32 | Planned |
| DRAFT-32-05 | Phase 32 | Planned |
| DRAFT-32-06 | Phase 32 | Planned |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓
- Phase 32 (draft+validator): 6 requirements (`DRAFT-32-01`..`06`); status Planned

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-18 — Phase 32 draft+validator IDs (DRAFT-32-01..06); Phase 31 parse-cache (CACHE-31-01..08)*
