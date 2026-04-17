# Phase 7: Layout-aware chunk-based parsing (token-optimized) — Context

**Gathered:** 2026-04-08  
**Discussed:** 2026-04-08 (`/gsd-discuss-phase 7` — auto-resolve gray areas; no interactive branch); 2026-04-11 (timing granularity — interactive)  
**Status:** Ready to execute — plans `07-01` / `07-02` + `07-UI-SPEC.md` + `07-VALIDATION.md` aligned (`/gsd-plan-phase 7` complete)

<domain>
## Phase Boundary

Implement **layout-aware, chunk-based MCQ extraction** using **existing OCR results** (`OcrPageResult.blocks[]` with bbox/polygon). Default path becomes **text (+ spatial hints) per chunk**, not **one full-page image per vision call**. **Do not remove** current full-page / pair vision parsing — it remains **fallback** and optional **“Accurate”** mode.

Out of scope unless pulled in later: multi-user cloud, adaptive learning across users.

</domain>

<decisions>
## Implementation Decisions (locked from product brief)

### Pipeline shape
- **D-01:** Target flow: `PDF → OCR (existing) → layout chunk engine → AI per chunk (text-first) → merge/dedupe/validate → reuse mapping (e.g. `applyQuestionPageMapping`) → optional crop path later`.
- **D-02:** **Default** parse path for production cost/accuracy: **chunk + small prompts**; **not** full-page image as default.
- **D-03:** **Fallback:** if chunk parse fails (or retry exhausted) → **existing full-page (or pair) vision** path unchanged.
- **D-04:** Reuse **OCR output** already stored per study set; do not require re-OCR unless blocks missing.

### Chunk engine
- **D-05:** Sort blocks by **reading order**: primary **Y**, then **X** (do not trust raw OCR array order).
- **D-06:** Detect **question boundaries** with patterns such as `Câu n`, `1.`, `Question 1`, etc. (locale-tunable list).
- **D-07:** Target **~1 question per chunk**; if boundary unclear, **fallback group 2–3 adjacent blocks**.
- **D-08:** Chunk type: `{ pageIndex, text, blocks[] }` (blocks carry geometry for hints + debug).

### AI per chunk
- **D-09:** Prompt asks for **exactly one** MCQ; output **JSON only**: `{ question, options, correctIndex }` (4 options); infer answer if model omits but validate downstream.
- **D-10:** Input is **OCR text chunk** + **optional spatial hints** (e.g. bbox summary), **not** full page image for the default path.

### Merge & quality
- **D-11:** Merge: `chunks.map(parse)` then **dedupe by stem** (reuse `dedupeQuestionsByStem` or equivalent), **validate 4 options**, normalize whitespace / strip OCR noise.
- **D-12:** **Retry:** on failure, retry same chunk once with **larger context** (include next block(s)).
- **D-13:** **Confidence** object per question: e.g. `parseScore`, `structureValid`, `optionCount` — surface in review or debug.

### UX / modes (bonus)
- **D-14:** User-selectable modes where feasible: **Fast (chunk)**, **Accurate (full-page vision)**, **Hybrid (auto)** — auto rule: high OCR quality → chunk, else vision (thresholds TBD in plan).

### Debug
- **D-15:** Inspector shows **chunk id → raw model output → parsed Question** for support and tuning.

### the agent's Discretion
- Exact regex lists for Vietnamese/English numbering; tokenizer for dedupe; UI placement of mode toggle (Settings vs parse panel).

---

## Discussion outcomes — gray areas closed (Phase 7)

*Các mục dưới đây bổ sung cho brief gốc; researcher/planner không cần hỏi lại trừ khi product đổi ý.*

### OCR prerequisite & entry
- **D-16:** **Chunk (Fast) path cần dữ liệu OCR** (`getOcrResult` có `pages[]` với blocks). Nếu người dùng chọn Fast/Hybrid-auto→chunk nhưng **chưa có OCR**: **tự chạy `runOcrSequential` một lần** trong cùng phiên parse (giống bước OCR tuỳ chọn hiện tại), rồi chunk. Nếu OCR **toàn bộ fail**: **fallback** sang full-page vision (D-03), không chặn hard.
- **D-17:** **Accurate** = chỉ vision (giữ hành vi `runVisionSequential` hiện tại), không bắt OCR.

### Provider & HTTP stack
- **D-18:** Parse từng chunk dùng **cùng stack** `forwardAiPost` / `parseChunk.ts` pattern: hỗ trợ **OpenAI, Custom, Anthropic** (text-only), không giới hạn chỉ OpenAI. Thêm **system prompt mới** (một MCQ / một JSON object), không tái dùng `MCQ_EXTRACTION_SYSTEM_PROMPT` đa-câu nguyên bản cho chunk nhỏ.
- **D-19:** JSON chunk: model trả **một object** `{ question, options, correctIndex }` (đúng 4 options). Adapter chuyển thành `Question` + `validateQuestions` / validator hiện có; có thể bọc thành `{ questions: [ one ] }` nội bộ nếu giảm code fork (ưu tiên ít nhánh).

### Reading order & geometry
- **D-20:** Sort block theo **tâm bbox** `(cx, cy)` trong không gian `relative` (0..1): `cy` trước, `cx` sau; block không bbox đưa cuối trang theo thứ tự mảng gốc.
- **D-21:** Gợi ý không gian trong prompt: **một dòng** tóm tượng (vd. bbox min/max của chunk) hoặc bỏ qua nếu token quá tăng — mặc định **có** tóm tắt 1 dòng khi có ≥1 block có bbox.

### Hybrid (auto) threshold
- **D-22:** **Hybrid → chunk** khi sau OCR `stats.successPages / stats.totalPages >= 0.85` và `stats.failedPages === 0`. Ngược lại → **vision**. (Có thể tinh chỉnh sau khi có metric thực tế.)

### Fallback & retry (document-level)
- **D-23:** Sau khi xử lý hết chunk: nếu **số chunk fail / tổng chunk > 0.5** **hoặc** **0 câu hỏi hợp lệ** → **một lần** gọi full-page vision pipeline hiện có (merge kết quả: **union + dedupe by stem**, ưu tiên chunk-parse nếu trùng stem — planner chi tiết).
- **D-24:** Retry **per-chunk** (D-12): tối đa **1** lần mở rộng context (thêm block kế); không vòng lặp vô hạn.

### Confidence & type shape
- **D-25:** Thêm field **tuỳ chọn** trên `Question` (hoặc namespace một object optional): ví dụ `layoutChunkId?: string`, `parseConfidence?: number` (0..1), `parseStructureValid?: boolean`. Raw model text **không** lưu vào `Question` (chỉ trong debug UI / session state / overlay).

### Debug UI
- **D-26:** **Chunk → AI output** hiển thị trong **mở rộng OcrInspector** hoặc panel debug cạnh parse (cùng study set); không chặn happy path nếu user không mở.

### Parse timing (discuss 2026-04-11)
- **D-27:** Đo và hiển thị **wall-clock từng chunk** cho **một vòng gọi AI text-MCQ trên một layout chunk** (monotonic `performance.now()` hoặc tương đương bọc quanh `parseChunkSingleMcqOnce` / lời gọi tương đương). Đây là **mức chi tiết chính** để so sánh chunk chậm, retry, hay model.
- **D-28:** Hiển thị thêm **một số tổng** — thời gian **cả một lần parse** từ lúc user bắt đầu parse đến trạng thái terminal (draft + UI xong / dừng lỗi). **Không bắt buộc** tách nhỏ OCR / raster PDF / từng bước IDB trong lock này; có thể bổ sung sau nếu metric vẫn thiếu.
- **D-29:** Bảng/danh sách **per-chunk duration** đi cùng kênh debug **D-26**; dòng **tổng (D-28)** có thể nằm ở vùng tóm tắt parse chính nếu planner/UI giữ gọn, không che happy path. Logging `pipelineLog` `info` theo cờ **06-CONTEXT D-05** (chỉ dev / `NEXT_PUBLIC_D2Q_PIPELINE_DEBUG`) — không bắt buộc schema IDB mới trừ khi plan sau thêm tùy chọn.

</decisions>

<specifics>
## Agent implementation brief (single prompt)

Implement layout-aware chunk-based parsing using existing OCR results.

**Do NOT** parse full pages as the default path anymore.

**Goal:** Reduce token usage and improve accuracy by parsing **one question per chunk**.

**Steps:**

1. **Chunk engine** from OCR blocks: sort by `(y, x)`; detect question boundaries (numbering patterns); group into chunks (~1 question per chunk).
2. **For each chunk:** call AI with **minimal** prompt; extract **exactly one** MCQ.
3. **Merge:** dedupe by stem; validate 4 options; normalize output to existing `Question` shape.
4. **Fallback:** if chunk parsing fails → **existing full-page vision** parsing.
5. **Confidence:** mark weak parses.
6. **Debug:** show **chunk → AI output** mapping in inspector, plus **per-chunk** and **run total** timings (**D-27–D-29**).

**Constraints:**

- Reuse existing OCR output.
- Do not break current flow; do not remove vision parsing (fallback only).
- Optimize for token usage.

**References (external ideas, not repo deps):**

- Document AI layout / chunking concepts (industry pattern): layout blocks → semantic chunks → LLM per chunk.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/codebase/WORKFLOW-OCR-AI-QUIZ.md` — current OCR → vision → draft flow
- `.planning/phases/06-pipeline-hardening/06-CONTEXT.md` — logging, IDs, upgrade constraints
- `src/types/ocr.ts` — `OcrPageResult`, `OcrBlock`, bbox/polygon
- `src/lib/ai/runOcrSequential.ts`, `ocrAdapter.ts`, `ocrDb.ts`
- `src/lib/ai/parseVisionPage.ts`, `runVisionSequential.ts`
- `src/lib/ai/mapQuestionsToPages.ts`
- `src/lib/ai/dedupeQuestions.ts`, `validateQuestions.ts`
- `src/components/ai/AiParseSection.tsx`, `OcrInspector.tsx`

</canonical_refs>

<code_context>
## Existing Code Insights (for planner)

### Reusable assets
- **`parseChunkOnce`** (`parseChunk.ts`) — auth, Anthropic/OpenAI/custom, `FatalParseError`, JSON từ model; thêm variant prompt **single MCQ**.
- **`validateQuestionsFromJson` / `validateQuestions.ts`** — chuẩn hoá 4 options + `correctIndex`.
- **`dedupeQuestionsByStem`** — merge sau multi-source.
- **`runOcrSequential` + `putOcrResult` + `getOcrResult`** — đã có; Fast path piggyback.
- **`runVisionSequential` + `handleVisionParse`** — fallback & Accurate mode.
- **`applyQuestionPageMapping`** — sau merge, với `parseMode` mới có thể thêm `"layout_chunk"` (hoặc reuse `ocr_text_overlap` / provenance — planner quyết định tên enum).

### Established patterns
- MCQ system prompt từ **`mcq-extraction.prompts.json`** — thêm key mới `mcqSingleChunk.system` (hoặc file prompt riêng) để không phá chunk đa-câu cũ nếu vẫn dùng nơi khác.
- Pipeline log: `pipelineLog` cho từng chunk fail/success.

### Integration points
- **`AiParseSection`**: nhánh mode (Fast / Accurate / Hybrid), orchestration OCR→chunk→merge→fallback vision.
- **`runLayoutChunkParse` (07-02):** accumulator **chunkId → durationMs** + **runStartedAt/runFinishedAt** (hoặc tương đương) để UI/debug (**D-27–D-28**).
- **IndexedDB**: draft questions unchanged; optional **parse debug** chỉ trong memory hoặc `parseProgress` record nếu đã có schema.

</code_context>

<deferred>
## Deferred Ideas

- **Đo chi tiết từng bước pipeline** (từng trang OCR, rasterize, merge/dedupe riêng, IDB) — không lock trong discuss 2026-04-11; làm sau nếu chỉ D-27–D-28 chưa đủ để tối ưu.
- Per-question **image crop** from bbox (may overlap Phase 6 deferred work; coordinate when implementing).
- **Adaptive learning** (weak-topic quiz selection) — future phase.
- Full **multi-user cloud** architecture — future milestone.

</deferred>

---

*Phase: 07-layout-aware-chunk-based-parsing-token-optimized*
