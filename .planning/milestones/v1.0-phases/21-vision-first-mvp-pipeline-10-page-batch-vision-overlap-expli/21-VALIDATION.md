# Phase 21 — Nyquist / UAT validation

**Nyquist:** `workflow.nyquist_validation: true` trong `.planning/config.json`.

## UAT — Quiz path (MVP)

1. Tạo set **Quiz** → `/sets/[id]/source` → parse xong (hoặc từng batch nếu preview bật).
2. Draft chỉ chứa **MCQ** (4 options, `correctIndex`); không có flashcard-only shape bị ép vào `Question`.
3. Mỗi item có **confidence** ∈ [0,1] (hoặc hiển thị tier High / Review).
4. Console / pipeline log có các stage tối thiểu: `parse_start`, `render_pages_done`, `batch_request_done` (hoặc `batch_cache_hit`), `parse_done`, `benchmark_ready`.
5. Parse lại **cùng PDF** không đổi mode → **cache hit** ≥ 1 batch (sau lần parse đầu thành công); benchmark ghi `cacheHits`.

## UAT — Flashcard path (release-blocking)

1. Tạo set **Flashcards** → parse.
2. Output draft là **front/back** (hoặc type discriminated `kind: "flashcard"`), **không** phải MCQ tiếng Anh bịa khi đề là Toán/VN.
3. Reopen set → `contentKind` + draft **vẫn flashcard**, không bị ghi đè thành quiz schema.
4. `putDraft*` / `getDraft*` không trộn mode im lặng.

## UAT — Batch & overlap

1. PDF **≥12 trang:** xác nhận **≥2 batch** (logic 10 + overlap 2); không bỏ sót trang index.
2. Câu nằm **vạch batch** (mock hoặc PDF có MCQ kéo dài 9–11) vẫn xuất hiện **một lần** sau dedupe.

## UAT — Benchmark

1. Sau parse, có **bản ghi benchmark** (console structured + optional copy trong UI dev hoặc `pipelineLog` block đọc được).
2. Có dòng **naive baseline** (số request pair cũ) vs **actualRequests** batch mới; `requestReductionRatio` hợp lý.

## Automated (mỗi wave)

- `npm run lint`
- `npm run build`
- (Khuyến nghị) unit test `buildVisionBatches` — không skip page, overlap cố định.
