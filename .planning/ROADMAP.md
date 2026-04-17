# Doc2Quiz — Roadmap

**Milestone:** v1 — Local Practice Loop
**Goal:** Upload PDF → AI questions → review → practice → score → repeat mistakes. Full loop working locally.
**Granularity:** Standard

---

## Phase 1: PDF Ingestion

**Goal:** User can upload a PDF, extract its text, and see it displayed.

**Status:** Complete (implemented; see `STATE.md`)

**Requirements covered:** PDF-01, PDF-02, PDF-03, PDF-04

**Deliverables:**
- UploadBox component — drag-and-drop + click, PDF-only validation, 10MB limit
- `extractPdfText` / page helpers — pdf.js text extraction and page-aware strings
- RawTextViewer — scrollable display of extracted text
- Loading, error, and empty states (including scanned PDF error)

**Canonical refs:**
- `src/lib/pdf/extractPdfText.ts`
- `src/components/upload/UploadBox.tsx`
- `src/components/viewer/RawTextViewer.tsx`

---

## Phase 2: AI Question Parsing

**Goal:** Given extracted text, use AI to produce a set of structured MCQ questions ready for review.

**Status:** Complete (text/OCR/layout-chunk/vision paths; same-origin forward — see `INTEGRATIONS.md`)

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

**Status:** Complete

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

**Status:** Complete (play, practice, flashcards)

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

**Status:** Complete

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

## Phase 10: Persistent vision staging: object storage or signed URLs (replace in-memory serverless-unsafe store)

**Goal:** Make vision image staging reliable on serverless multi-instance deploys by persisting staged bytes outside process memory (object storage or time-limited signed URLs), keeping current limits (size cap, short-lived access) and URLs that upstream vision providers can fetch over HTTPS.

**Status:** Complete — see `10-01-SUMMARY.md`

**Depends on:** None (cross-cutting infrastructure)

**Requirements:** TBD

**Deliverables (high level):**
- Replace in-memory `visionStagingStore` with a shared backend store (e.g. S3/R2 + presigned URLs, or Vercel Blob) so POST and upstream GET are not tied to one instance.
- POST `/api/ai/vision-staging` returns a fetchable URL; adjust GET/proxy behavior as needed for the chosen backend.
- Environment-based configuration; clear local-dev story (optional in-memory fallback when unset, or documented env).
- Update `stageVisionDataUrl.ts` comments and deployment notes (README or existing ops doc) so production requirements are explicit.

**Canonical refs:**
- `src/lib/ai/visionStagingStore.ts`
- `src/app/api/ai/vision-staging/route.ts`
- `src/app/api/ai/vision-staging/[id]/route.ts`
- `src/lib/ai/stageVisionDataUrl.ts`

**Plans:** 1/1 plans complete

---

## Phase 11: Split AiParseSection — orchestration hook, parse state machine, presenters

**Goal:** Decompose `AiParseSection` (documented as a large client component owning OCR, layout chunks, vision fallback, and progress) into **orchestration hook + parse state machine + presenter components** so the parse UI does not become a god-component.

**Status:** Complete — `11-01-SUMMARY.md`, `11-02-SUMMARY.md` (lib extraction + presenters); optional **11-03** for dedicated orchestration hook + explicit FSM remains backlog if desired.

**Depends on:** Phase 7 (current chunk/vision/OCR flow concentrated in `AiParseSection`); planner may sequence after Phase 6 hardening as needed.

**Requirements:** TBD

**Deliverables (high level):**
- **Orchestration hook** — deferred to optional follow-up; parse pipeline still lives in `AiParseSection` `useCallback` graph.
- **Parse state machine** — not implemented as standalone module this phase (optional 11-03).
- **Presenter components** — `AiParseSectionHeader`, `AiParsePreferenceToggles`, `AiParseParseStrategyPanel`, `AiParseActions`.

**Canonical refs:**
- `src/components/ai/AiParseSection.tsx`
- `.planning/codebase/WORKFLOW-OCR-AI-QUIZ.md` (if present)

**Plans:** 2/2 plans complete

---

## Phase 12: Unified parse engine — text / OCR / vision + document policy

**Goal:** Hợp nhất chiến lược parse text/OCR/vision thành một engine rõ ràng: text pipeline hiện có nhưng chưa nối vào UI parse chính; UI đang nghiêng về vision; cần policy chọn mode phù hợp theo loại tài liệu (native text vs scanned vs hybrid).

**Status:** Complete — `12-01-SUMMARY.md`, `12-02-SUMMARY.md`

**Depends on:** Phase 11 (orchestration/state machine split makes a clean seam for engine + policy).

**Requirements:** TBD

**Deliverables (high level):**
- **Single product-facing parse engine** — one place that owns text → OCR → chunk AI → vision fallback ordering, not parallel silos.
- **Wire text pipeline into primary parse UI** — default path uses extracted/layout text when sufficient; vision is escalation, not the implied default.
- **Document-type / signal-based mode policy** — explicit rules (e.g. empty text layer, OCR confidence, page mix) for choosing best mode; user override remains possible.
- **Telemetry or debug surfacing** — enough signal to verify policy choices in dev/UAT.

**Canonical refs:**
- `src/components/ai/AiParseSection.tsx` (and post–Phase 11 hook/presenters)
- `src/lib/pdf/extractText.ts`, layout/OCR/chunk modules under `src/lib/`

**Plans:** 2/2 plans complete

---

## Phase 13: Monitoring & error reporting (pipeline observability)

**Goal:** Bổ sung **monitoring** và **error reporting** ngoài `pipelineLog` cục bộ — hiện không có remote log shipping, analytics hay Sentry. Với pipeline AI nhiều bước, cần **observability** để biết lỗi nằm ở **render PDF**, **OCR**, **vision**, **mapping**, hay **persistence**, không chỉ thông báo lỗi chung.

**Status:** Complete — `13-01-SUMMARY.md`, `13-02-SUMMARY.md`

**Depends on:** Phase 6 (pipeline logging / verbosity); planner may sequence with Phase 12 or earlier — observability is cross-cutting.

**Requirements:** TBD

**Deliverables (high level):**
- **Structured errors + correlation** — run/step id across stages; never log API keys or raw PDF bytes in remote sinks.
- **Remote sink (choose in plan)** — e.g. Sentry (client/server), OTel, or log drain; env-gated; off by default for offline-first local dev.
- **Stage alignment** — reuse or explicitly map `PipelineDomain` / existing `pipelineLog` stages to spans or Sentry tags.
- **Privacy posture** — opt-in levels: metadata-only vs sampled content; document in README / CONTEXT.

**Canonical refs:**
- `src/lib/logging/pipelineLogger.ts`
- `src/lib/ai/runOcrSequential.ts`, `runVisionSequential.ts`, `runLayoutChunkParse.ts`
- `src/lib/db/studySetDb.ts`, `src/components/ai/AiParseSection.tsx`

**Plans:** 2/2 plans complete

---

## Phase 14: Page mapping & provenance quality

**Goal:** Today page mapping is **best-effort** and callers may **swallow** mapping errors while the **draft still saves**—good short-term UX but produces data that **looks fine** with **wrong or unknown provenance**. This phase makes **quality and uncertainty explicit**: no relying on silent best-effort alone; **elevate warnings**; add **question confidence / quality flags** so users and downstream steps can tell mapped vs uncertain vs failed.

**Status:** Planned — ready to execute

**Depends on:** Phase 7 (mapping + merge surfaces exist today). Phase 13 (observability) can **amplify** attribution in plan/execute but is not a hard prerequisite—confirm in `/gsd-discuss-phase 14` if ordering should change.

**Requirements:** TBD

**Deliverables (high level):**
- **No silent swallow** — mapping failures, partial matches, and heuristic-only attachment must surface as **user-visible warnings** (parse UI, review strip, or draft banner), not only `console` / swallowed `catch` paths.
- **Quality flags / question confidence** — first-class or derived fields (e.g. provenance tier, mapping confidence) distinct from “save succeeded.”
- **Honest drafts** — saving with uncertain page links remains allowed, but **labeled** in UI and persisted representation so it is not indistinguishable from fully mapped sets.
- **Documentation** — align docs that describe “best-effort” mapping with the new contract (visible degradation, not silent accept).

**Canonical refs:**
- `src/lib/ai/mapQuestionsToPages.ts` and call sites (OCR / vision / chunk merge, `AiParseSection`)
- `src/lib/db/studySetDb.ts`, `src/types/question.ts`, review / parse UI
- `.planning/codebase/WORKFLOW-OCR-AI-QUIZ.md` (or equivalent) where mapping semantics are described

**Plans:** 2 — `14-01-PLAN.md` (mappingQuality + MAPPING log + AiParseSection: no silent swallow, aggregate warnings, OCR load visibility, build), `14-02-PLAN.md` (review + parse preview badges, WORKFLOW doc, build). See `14-CONTEXT.md`, `14-UI-SPEC.md`.

---

## Phase 15: Server-side heavy jobs — PDF render & parse queue (scale mode)

**Goal:** Chuyển các job nặng khỏi client khi scale: hiện app client-heavy (pdf.js canvas, IndexedDB, settings local, OCR/vision orchestration trong browser). File lớn / máy yếu dễ làm UX hụt. Cần **server hoặc background worker mode** cho PDF render (page images) và **parse queue** (tách khỏi main thread UX), vẫn tôn trọng offline-first / opt-in khi plan chi tiết.

**Status:** Complete — `15-01-SUMMARY.md`, `15-02-SUMMARY.md`

**Depends on:** Phase 10 (durable staging / object storage cho bytes handoff); Phase 13 (observability cho job/step correlation). Phase 14 không chặn worker — planner có thể xếp song song slice infra nếu hợp lý.

**Requirements:** TBD

**Deliverables (high level):**
- **Execution plane** — API hoặc worker process chạy pdf render (hoặc headless pipeline tương đương), enqueue parse steps, trả job id + progress channel (SSE / poll / websocket — chọn khi plan).
- **Client thin mode** — upload + subscribe progress + nhận kết quả; không giữ toàn bộ canvas render + parse state machine trên máy yếu khi mode bật.
- **Queue semantics** — retry, cancel, fairness, giới hạn kích thước; rõ ràng privacy (payload nào ở server, TTL).
- **Compatibility** — local-only path vẫn hoạt động khi không cấu hình server (feature flag / env).

**Canonical refs:**
- `docs/SCALE-MODE-parse-queue.md`, `src/lib/serverParse/env.ts`, `src/types/parseJob.ts`
- `src/app/api/parse-jobs/route.ts`, `src/app/api/parse-jobs/[id]/route.ts`
- `src/lib/pdf/renderPagesToImages.ts`, `src/components/ai/AiParseSection.tsx`
- `src/app/api/ai/**`, vision staging routes
- `src/lib/db/studySetDb.ts` (sync model với server draft nếu có)

**Plans:** 2/2 plans complete

---

## Phase 16: Learning domain vs document-parse domain (boundary)

**Goal:** Tách rõ "domain học tập" ra khỏi "domain parse tài liệu". Hiện codebase có review/play/practice/flashcards khá đầy đủ, nhưng parse pipeline vẫn là trung tâm chính. Về lâu dài nên có boundary rõ: ingestion/parsing và learning/session analytics. Như vậy feature học tập sẽ không bị dính quá chặt vào logic OCR/vision.

**Status:** Complete — 2026-04-11

**Depends on:** Phase 15 (boundary work may proceed incrementally — not a hard code gate; see plan `16-01`)

**Requirements:** TBD

**Deliverables (high level):**
- `docs/ARCHITECTURE-domain-boundaries.md` — parse vs learning domains, dependency direction, forbidden imports, ESLint strategy (documented future unless flat-config extended).
- `src/lib/learning/**` — stable barrel + thin facade for review-facing helpers (e.g. mapping quality re-exports); `npm run lint` + `npm run build` green.

**Plans:** 2/2 plans complete

Plans:
- [x] `16-01-PLAN.md` — Boundary definition: architecture doc + `@/lib/ai` inventory appendix (`16-01-SUMMARY.md`).
- [x] `16-02-PLAN.md` — Incremental alignment: `@/lib/learning` facade; review components off deep `@/lib/ai/mappingQuality`; lint + build (`16-02-SUMMARY.md`).

---

## Phase 17: BYOK parse preview — estimated calls, tokens, and time

**Goal:** Hiển thị ước lượng **cost/time** (và độ tin cậy của ước lượng) **trước khi** người dùng bấm chạy parse. App **BYOK** — người dùng cần thấy rõ **số call API ước lượng**, **token/page hoặc token/chunk** (theo strategy), và **thời gian wall-clock tham chiếu** (range hoặc upper bound) để quyết định có chạy hay đổi strategy/provider.

**Status:** Complete — `17-01-SUMMARY.md`, `17-02-SUMMARY.md`

**Depends on:** Phase 7 (đường parse Fast/Hybrid/Accurate, chunk vs vision); Phase 12 (tín hiệu tài liệu + `parseRoutePolicy`). Phase 16 không chặn — chỉ ảnh hưởng vị trí UI nếu tách module.

**Requirements:** TBD

**Deliverables (high level):**
- **Ước lượng deterministic từ metadata** — `pageCount`, strategy (`fast` / `accurate` / `hybrid`), OCR on/off, text-layer signal (từ Phase 12), giới hạn vision pages hiện có — công thức versioned trong code + doc ngắn.
- **UI parse** — panel hoặc banner trên nút Parse: hiển thị ~N vision steps, ~M chunk calls, cảnh báo “ước lượng, thực tế có thể khác” (model pricing không nằm trong app — chỉ hint token/call).
- **Không gọi API** để ước lượng — tránh tốn key; có thể đọc model id từ settings chỉ để copy “bạn đang dùng model X”.
- **A11y** — estimate không chỉ màu; có text + `aria-live` polite khi đổi strategy.

**Canonical refs:**
- `src/components/ai/AiParseSection.tsx`, `AiParseActions.tsx`, `AiParseParseStrategyPanel.tsx`
- `src/lib/ai/parseRoutePolicy.ts`, `src/lib/pdf/renderPagesToImages.ts` (page cap constants)
- `src/lib/ai/runLayoutChunkParse.ts`, `src/lib/ai/runVisionSequential.ts` (step shapes for counting)

**Plans:** 2/2 plans complete

Plans:
- [x] `17-01-PLAN.md` — Pure `estimateParseRun` + `docs/BYOK-parse-estimate.md` (`17-01-SUMMARY.md`).
- [x] `17-02-PLAN.md` — `AiParseEstimatePanel` + `AiParseSection` wiring, `aria-live` (`17-02-SUMMARY.md`).

---

## Phase 18: parseScore — official contract (ocrQuality vs questionQuality)

**Goal:** Định nghĩa `parseScore` thành contract chính thức — không chỉ badge: schema rõ cho **structure quality**, **provenance quality**, **OCR confidence**, **retry history**. Tách **`ocrQuality`** (theo trang / pipeline OCR) và **`questionQuality`** (MCQ sau parse); một trang OCR tốt không suy ra câu hỏi tốt — hai score không gộp làm một.

**Status:** Complete — 2026-04-11 — `18-01-SUMMARY.md`, `18-02-SUMMARY.md`

**Depends on:** Phase 17 (BYOK estimate). Schema + pure derivations do **not** require Phase 17 code; any UI next to the estimate panel waits for Phase 17.

**Requirements:** TBD

**Deliverables (high level):**
- **`docs/PARSE-SCORE-contract.md`** — versioned contract, non-goals, field mapping, OCR vs question separation.
- **`src/types/parseScore.ts`** — `parseScoreSchemaVersion`, `OcrPageQuality` / run-level OCR aggregates, `QuestionParseQuality` (structure + provenance), `ParseRetryHistory`.
- **`src/lib/ai/deriveParseScores.ts`** — deterministic derivation + display DTO helper; optional thin bridge in `mappingQuality.ts` without breaking review badges.

**Plans:** 2/2 plans complete

Plans:
- [x] `18-01-PLAN.md` — Contract doc + `parseScore` types (`18-01-SUMMARY.md`).
- [x] `18-02-PLAN.md` — `deriveParseScores` + `mappingQuality` re-exports; lint + build (`18-02-SUMMARY.md`).

---

## Phase 19: Stage-specific retries, capability matrix, minimal BYOK (3 fields)

**Goal:** Thiết kế **retry policy theo stage** — lỗi OCR, parse (LLM), validation cấu trúc MCQ, mapping trang, và persistence (IDB) **không** dùng chung một kiểu backoff/retry; mỗi stage có chính sách rõ (idempotent, user-prompt, abandon, v.v.). Làm rõ hành vi khi **provider không hỗ trợ** một mode (vision multimodal, chunk forward, v.v.). Thay cảnh báo muộn trong doc bằng **capability matrix** (mode × provider) hiển thị/disable sớm trong UI. **Đơn giản hóa BYOK:** bỏ nhánh GPT / Anthropic / Custom; chỉ **ba ô nhập** (một đường OpenAI-compatible: ví dụ base URL + API key + model id — planner chốt nhãn và migration từ `parseLocalStorage` / settings hiện tại).

**Status:** Complete — `19-01-SUMMARY.md`, `19-02-SUMMARY.md`

**Depends on:** Phase 13 (stage-tagged observability); Phase 14 (mapping failure surfaces); Phase 17 (estimate UI có thể tái dùng copy/layout); Phase 18 (parseScore / retry history nếu cần nối contract). Phase 12 không chặn nhưng policy route nên đọc `parseRoutePolicy`.

**Requirements:** See `19-CONTEXT.md` (D-01–D-08).

**Deliverables (high level):** `forwardSettings` + migration; `parseCapabilities`; `pipelineStageRetry`; settings + parse + estimate wired; OCR/parse/IDB retries; docs.

**Plans:** 2/2 complete

Plans:
- [x] `19-01-PLAN.md` — Forward BYOK module, migration, declarative `parseCapabilities`, `docs/BYOK-forward-only.md` (`19-01-SUMMARY.md`).
- [x] `19-02-PLAN.md` — `pipelineStageRetry`, OCR/parse/IDB wiring, settings UI 3-field, `AiParseSection` + capability gating, WORKFLOW doc (`19-02-SUMMARY.md`).

---

## Phase 20: AI-first content creation — quiz vs flashcards selector, simplified create flow, OCR dev-only surface

**Goal:** Refactor **product-facing** create flow theo hướng **AI-first**, ít ma sát: Dashboard → **chọn loại đầu ra** (Quiz / Flashcards) → upload file → **AI parse** (implementation có thể tái dùng engine hiện tại) → review → save/use. **Không** để OCR / parse policy / layout jargon trong main UX; **OCR không xóa** — chuyển sang **route dev** (ví dụ `/dev/ocr`) tái dùng module parse domain. Giữ **boundary** Phase 16 (parse vs learning); mở rộng abstraction **`contentType`: quiz | flashcards** cho route/state/upload/review/save.

**Status:** Complete — `20-01-SUMMARY.md`, `20-02-SUMMARY.md` (2026-04-11)

**Depends on:** Phase 16 (domain boundary); Phase 12/19 (parse engine + capabilities — gọi qua entrypoint đơn giản, không phá policy nội bộ); Phase 8 (flashcards backlog — nối flow tạo mới).

**Requirements:** See `20-CONTEXT.md` (PRD đầy đủ + acceptance criteria).

**Deliverables (high level):** Bước chọn type (`/sets/new`); `/sets/new/quiz` + `/sets/new/flashcards`; `StudySetMeta.contentKind`; ẩn OCR/parse chrome trên source cho product sets; `/dev/ocr` lab; flashcards review v1 + doc.

**Plans:** 2 plans, 2 waves

Plans:
- [x] `20-01-PLAN.md` — funnel routes + `contentKind` persistence + global links (`20-01-SUMMARY.md`).
- [x] `20-02-PLAN.md` — `AiParseSection` surface + source wiring + `/dev/ocr` + flashcards review stub + architecture note (`20-02-SUMMARY.md`).

---

## Phase 21: Vision-first MVP pipeline — batch vision, quiz vs flashcard correctness, cache & benchmark

**Goal:** Refactor parse **MVP** thành **vision-first**: batch **10 trang**, **overlap 2**; tách rõ **`ParseOutputMode`** (quiz vs flashcard) xuyên suốt prompt → parse → validate → persist → UI (**release-blocking**: flashcard không còn sinh quiz); preview **tăng dần theo batch**; **confidence** heuristic từng item; **log có cấu trúc**; **fingerprint cache** theo batch+mode; **benchmark** sau mỗi lần parse; dedupe có ý thức overlap; prompt **nén**; hook **ensemble** (flag, không bật mặc định). **OCR / layout-chunk / hybrid OCR** ra khỏi **default runtime** MVP (code OCR giữ lại, dev-only).

**Status:** Complete — executed 2026-04-11 (`21-01-SUMMARY.md`, `21-02-SUMMARY.md`)

**Depends on:** Phase 20 (`contentKind`, funnel); Phase 16 (boundaries); Phase 19 (retry/capabilities — tái dùng cho batch).

**Requirements:** PRD trong `21-CONTEXT.md`; UAT trong `21-VALIDATION.md`.

**Deliverables (high level):** `buildVisionBatches`; `runVisionBatchSequential`; `visionPrompts`; quiz/flashcard parsers + validators + confidence; cache; benchmark + structured logs; `AiParseSection` + persistence + flashcard review; `docs/WORKFLOW-vision-parse-detailed.md` + `docs/MIGRATION-vision-mvp-draft.md`.

**Plans:** 2 plans (wave 1 lib, wave 2 integration)

Plans:
- [x] `21-01-PLAN.md` — Types, batching, prompts, parsers/validators, confidence, cache, benchmark, structured log hook (`21-01-SUMMARY.md` after execute).
- [x] `21-02-PLAN.md` — `runVisionBatchSequential`, IDB mode-aware drafts, `AiParseSection` + source, flashcard review, workflow + migration docs (`21-02-SUMMARY.md` after execute).

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
| 10 | Persistent vision staging (object storage / signed URLs) | Complete |
| 11 | Split `AiParseSection` (lib + presenters; hook/FSM optional) | Complete |
| 12 | Unified parse engine (text/OCR/vision + document-type policy) | Complete |
| 13 | Monitoring & error reporting (pipeline observability) | Complete |
| 14 | Page mapping & provenance quality (confidence, visible uncertainty, no silent swallow) | Planned |
| 15 | Server-side heavy jobs (PDF render + parse queue, scale mode) | Complete |
| 16 | Learning vs parse domain boundary | Complete |
| 17 | BYOK parse preview (calls / tokens / time before run) | Complete |
| 18 | parseScore contract (ocrQuality vs questionQuality) | Complete |
| 19 | Stage retries + capability matrix + minimal BYOK (3 fields) | Complete |
| 20 | AI-first create flow, content type, OCR dev surface (`20-CONTEXT.md`) | Complete |
| 21 | Vision-first MVP: batch vision, quiz/flashcard split, cache, benchmark (`21-CONTEXT.md`) | Complete |
| 22 | Mint UI/UX from `example/` — tokens, shell, page parity (`22-CONTEXT.md`) | Complete |
| 23 | Full app layout from `example/` — port HTML/CSS/shell into Next (`23-CONTEXT.md`) | Complete |
| 24 | Vision parse: fewer API round-trips (`24-CONTEXT.md`) | Complete |

v1 requirements covered: 23 / 23 ✓

Phase 24 is an incremental enhancement beyond the original v1 requirement rows 1–23.

### Phase 22: Implement example Mint UI/UX into main app (dashboard shell, tokens, components)

**Goal:** Đưa palette **Mint / blueprint**, typography (**Manrope** + **Space Grotesk**), và chrome shell (top bar, canvas, step bar) từ `example/` vào app Next; tiếp tục page-level parity (dashboard, settings, review, play…) qua plan.

**Status:** Complete — `22-RESEARCH.md`, `22-UI-SPEC.md`, `22-01-PLAN.md`, `22-02-PLAN.md` → `22-01-SUMMARY.md`, `22-02-SUMMARY.md`

**Requirements:** See `22-CONTEXT.md`

**Depends on:** Phase 21 (không đổi pipeline); design refs trong `example/`.

**Plans:** 2 plans, 2 waves

Plans:
- [x] `22-01-PLAN.md` — Dashboard library + stats + spacing (`22-UI-SPEC` §1).
- [x] `22-02-PLAN.md` — Settings shell + `AiProviderForm` underline fields + source/review headers (`22-UI-SPEC` §2–3).

### Phase 23: Replace entire app layout with code ported from example/ (full layout parity)

**Goal:** Port **full layouts** from `example/` mocks into the Next app (shell, dashboard, set flows, play/review) while preserving routes, data, and keyboard UX. Includes **`/develop`** lab: shadcn chrome + iframe wrapper for `example/*/code.html` (gated API), then incremental production ports. See `23-CONTEXT.md`, `23-UI-SPEC.md`.

**Requirements:** TBD (`/gsd-plan-phase 23`)

**Depends on:** Phase 22

**Status:** Complete — `23-01-PLAN.md`, `23-02-PLAN.md` → `23-01-SUMMARY.md`, `23-02-SUMMARY.md`

**Plans:** 2 plans, 2 waves

Plans:
- [x] `23-01-PLAN.md` — `/develop` + allowlist API + shadcn `Sheet` + Command Palette (dev).
- [x] `23-02-PLAN.md` — Inventory row + play page outer chrome vs immersive mock (`depends_on: ["23-01"]`).

### Phase 24: Vision parse: fewer round-trips — single request or max-window batches when within provider limits

**Goal:** When `VISION_MAX_PAGES_DEFAULT` (and real provider limits) allow, send **all rasterized page images in one chat completion** (or the **minimum number of requests**: e.g. one batch of size N, overlap 0). Preserve today’s **fallback** to smaller windows if payload/model rejects. Improve **progress UX** so rasterize completes before implying “many API hops.” Reuse Phase 21 batch JSON + cache; extend prompts so every item carries **`sourcePages` / page provenance** without relying on overlap dedupe.

**Requirements:** TBD in `REQUIREMENTS.md` (optional follow-up)

**Depends on:** Phase 21 (batch vision + prompts + cache)

**Status:** Complete — `24-01-SUMMARY.md`, `24-02-SUMMARY.md`

**Plans:** 2 plans, 2 waves

Plans:
- [x] `24-01-PLAN.md` — Policy + `planVisionBatches` / `runVisionBatchSequential` (`min_requests` + legacy fallback); strict `sourcePages`; `VISION_BATCH_PROMPT_V` in cache hash.
- [x] `24-02-PLAN.md` — `AiParseSection` + `onBatchPlanResolved`; overlay copy; `npm run lint` + `npm run build`.

### Phase 25: Skip rasterization for born-digital PDFs; extract text layer first

**Goal:** When parsing **Quiz** from a PDF, if the document has a **strong native text layer**, the app should **avoid rasterizing pages to images** and run a **text-first** parse path. Vision rasterization remains the fallback for scanned/weak-text PDFs, and can also be used as an automatic fallback when the text-first output quality is too low. (Document-level only; per-page routing deferred to Phase 29.)
**Requirements**: PDFOPT-01, PDFOPT-02, PDFOPT-03, PDFOPT-04
**Depends on:** Phase 24
**Plans:** 2/2 plans complete

Plans:
- [ ] `25-01-PLAN.md` — Add sampled text-layer signal + update route policy reason codes and roadmap requirements.
- [ ] `25-02-PLAN.md` — Wire quiz text-first lane in `AiParseSection` with quality-gated automatic vision fallback + short UX messaging.

### Phase 26: Direct multipart/resumable upload to object storage

**Goal:** Add an **optional (env-gated)** direct-to-object-storage upload path for the **original PDF bytes** with a stable init → part/chunk → complete → finalize contract, while keeping the app **local-first by default**.

**Requirements**: UPLOAD-01, UPLOAD-02, UPLOAD-03, UPLOAD-04, UPLOAD-05, UPLOAD-06
**Depends on:** Phase 25
**Plans:** 1/2 plans executed

Plans:
- [x] `26-01-PLAN.md` — Define requirements + ship provider-agnostic upload contracts, client helper, and env-gated API route stubs with finalize validations.
- [ ] `26-02-PLAN.md` — Wire optional upload into `NewStudySetPdfImportFlow` + `UploadBox` with bytes-based progress, cancel, and same-session retry/resume (local-only default preserved).

### Phase 27: Preview-first parsing while full upload continues

**Goal:** Enable preview-first parsing: begin AI parsing immediately on file selection and stream preview results while an optional env-gated background upload continues in parallel, without breaking local-first persistence.
**Requirements**: PREVIEW-01, PREVIEW-02, PREVIEW-03, PREVIEW-04, PREVIEW-05, PREVIEW-06, PREVIEW-07, PREVIEW-08, PREVIEW-09, PREVIEW-10, PREVIEW-11, PREVIEW-12, PREVIEW-13, PREVIEW-14
**Depends on:** Phase 26
**Plans:** 3/3 plans complete

Plans:
- [x] `27-01-PLAN.md` — Start parse immediately + preview scheduling (first 3–5 pages) + persist set meta first.
- [x] `27-02-PLAN.md` — Sticky combined progress strip + cancel controls + upload-complete toast + local-only hiding.
- [x] `27-03-PLAN.md` — Navigation gating until upload complete + failure policies (upload vs parse) + no-resume-on-refresh contract.

### Phase 28: Move image preprocessing into Web Workers

**Goal:** Move CPU-heavy image preprocessing (resize + JPEG encode for vision/OCR) into a single sequential Web Worker with safe auto-fallback, keeping PDF render on the main thread and preserving existing dataUrl + AbortSignal semantics.
**Requirements**: PERF-28-01, PERF-28-02
**Depends on:** Phase 27
**Plans:** 2/2 plans complete

Plans:
- [x] `28-01-PLAN.md` — Single sequential resize+JPEG encode worker + client helper; Phase 28 requirements + roadmap entries.
 (completed 2026-04-17)
- [x] `28-02-PLAN.md` — Integrate worker helper into the vision raster pipeline (auto-detect + safe fallback; no UI surface).
 (completed 2026-04-17)

### Phase 29: Route by page type: text page vs bitmap page vs rich layout page

**Goal:** Add **per-page routing** for mixed PDFs so text-heavy pages can be parsed via text-first lanes **without rasterizing** them, while bitmap/scanned pages continue through the existing vision lane — preserving current caps and preview-first behavior.
**Requirements**: ROUTE-29-01, ROUTE-29-02, ROUTE-29-03, ROUTE-29-04
**Depends on:** Phase 28
**Plans:** 3/3 plans complete

Plans:
- [x] `29-01-PLAN.md` — Define Phase 29 goal/req IDs; add per-page classification + routing-plan data structures (no UI wiring). (completed 2026-04-17)
- [ ] `29-02-PLAN.md` — Integrate per-page routing into `AiParseSection` **before rasterization**; route text pages to text-first, bitmap pages to vision (no new UI controls).
- [ ] `29-03-PLAN.md` — Observability + safety: reason-code logging, bounded work + abort handling, and cap enforcement so routing never increases vision workload.

### Phase 30: Replace page-level chunking with layout-aware chunking

**Goal:** TBD
**Requirements**: TBD
**Depends on:** Phase 29
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 30 to break down)

### Phase 31: Cache prompt prefixes, embeddings, and content hashes

**Goal:** TBD
**Requirements**: TBD
**Depends on:** Phase 30
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 31 to break down)

### Phase 32: Use draft-pass generation plus validator-pass rewrite

**Goal:** TBD
**Requirements**: TBD
**Depends on:** Phase 31
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 32 to break down)

### Phase 33: Adopt a vector store matched to your scale

**Goal:** TBD
**Requirements**: TBD
**Depends on:** Phase 32
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 33 to break down)

### Phase 34: Add async workers / task queue for full indexing

**Goal:** TBD
**Requirements**: TBD
**Depends on:** Phase 33
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 34 to break down)

### Phase 35: Tune OCR preprocessing: thresholding, downsample huge pages, 300-DPI target

**Goal:** TBD
**Requirements**: TBD
**Depends on:** Phase 34
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 35 to break down)

### Phase 36: Queue-based fallback to high-accuracy pipeline only on uncertain docs

**Goal:** TBD
**Requirements**: TBD
**Depends on:** Phase 35
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 36 to break down)

### Phase 37: Global transfer acceleration / edge ingress

**Goal:** TBD
**Requirements**: TBD
**Depends on:** Phase 36
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 37 to break down)

### Phase 38: Full fine-tuning or distillation for quiz style

**Goal:** TBD
**Requirements**: TBD
**Depends on:** Phase 37
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 38 to break down)

---

*Roadmap created: 2026-04-05*
*Milestone: v1 — Local Practice Loop*
