# Luồng từ tài liệu PDF đến quiz (OCR, AI vision, lưu trữ)

**Mục đích:** Mô tả **end-to-end** trong codebase hiện tại — từ upload PDF đến câu hỏi trắc nghiệm trong draft/review — tập trung **OCR**, **AI (vision)**, và các bước **scan/lưu** liên quan.

**Phạm vi:** Đọc từ `src/` (Next.js App Router, client-heavy). Không thay thế `REQUIREMENT.md` / roadmap; đây là bản đồ kỹ thuật để onboard và debug.

---

## 1. Tổng quan pipeline

```
PDF (File)
  → [Tạo study set] extract text (pdf.js) + lưu PDF + text vào IndexedDB
  → [Trang source] Người dùng bấm parse (vision)
  → Raster hóa từng trang (canvas/jpeg data URL, giới hạn số trang)
  → (Tuỳ chọn) OCR từng trang qua cùng API chat multimodal → lưu OCR vào IndexedDB
  → Vision: gửi ảnh trang (hoặc cặp trang) tới model → JSON câu hỏi MCQ
  → Ánh xạ câu hỏi ↔ trang (OCR overlap / provenance từ vision)
  → Lưu draft questions + tiến độ parse vào IndexedDB
  → Review → Approve → Practice (ngoài phạm vi chi tiết file này)
```

**Điểm quan trọng:** `AiParseSection` chọn lộ trình qua **`decideParseRoute` / `parseRoutePolicy`** và tuỳ chọn người dùng (**parse strategy** + OCR): khi text layer đủ mạnh có thể đi **text/chunk** (`runSequentialParse`, `parseChunk`); khi cần có **OCR** → **layout chunks** (`layoutChunksFromOcr`, `runLayoutChunkParse`) và **vision fallback** (`runVisionSequential`). Không chỉ còn một đường vision cứng.

---

## 2. Giai đoạn A — Đưa PDF vào study set (chưa AI parse câu hỏi)

| Bước | File / hàm | Việc xảy ra |
|------|------------|-------------|
| Chọn file | `src/app/(app)/sets/new/page.tsx`, `UploadBox` | Validate PDF (loại, 10MB). |
| Mở PDF & đếm trang | `getPdfPageCount` (`src/lib/pdf/getPdfPageCount.ts`) | pdf.js `getDocument`, đọc `numPages`. |
| Extract text (text layer) | `extractPdfText` (`src/lib/pdf/extractPdfText.ts`) | pdf.js đọc text từng trang; **không** ném lỗi (trả `""` nếu fail). |
| Tên study set | `generateStudySetTitle` | Gợi ý title từ excerpt + tên file; có fallback nếu không gọi AI. |
| Lưu DB | `createStudySet` (`src/lib/db/studySetDb.ts`) | Tạo `StudySetMeta`, `document` (text + optional `pdfArrayBuffer`), `draft` rỗng. |

**Lưu ý:** Text đã extract được dùng cho **title**, **policy route**, và nhánh **text/hybrid**; nhánh scan nặng dùng **ảnh trang** + OCR/vision như mô tả dưới.

---

## 3. Giai đoạn B — Chuẩn bị ảnh cho OCR + vision

**Trigger:** `AiParseSection` → `handleVisionParse` (`src/components/ai/AiParseSection.tsx`).

| Bước | File / hàm | Việc xảy ra |
|------|------------|-------------|
| Raster PDF | `renderPdfPagesToImages` (`src/lib/pdf/renderPagesToImages.ts`) | pdf.js render từng trang lên canvas → **JPEG data URL**; có `maxPages` (mặc định ~20), `maxWidth`, quality. |
| Worker | `ensurePdfWorker` / `pdfWorker.ts` | Cấu hình worker pdf.js cho trình duyệt. |

Mọi bước OCR và vision **dùng chung** mảng `PageImageResult[]` (`pageIndex`, `dataUrl`).

---

## 4. Giai đoạn C — OCR (tuỳ chọn)

**Bật khi:** `enableOcr` trong UI + có `studySetId` + BYOK forward (**API key** + tuỳ chọn **base URL** / **model id**) cho phép surface `ocr_forward` theo `parseCapabilities.ts` (Phase 19).

| Bước | File / hàm | Việc xảy ra |
|------|------------|-------------|
| Tuần tự theo trang | `runOcrSequential` (`src/lib/ai/runOcrSequential.ts`) | Với mỗi trang: `runOcrPage` (có **retry** transient quanh `pipelineStageRetry` / `ocr_page`) → chuẩn hoá block/bbox/polygon. |
| Gọi model | `ocrAdapter.ts` → `forwardAiPost` (`sameOriginForward`) | Prompt hệ thống yêu cầu JSON: full page `text` + `blocks` (bbox/polygon **tọa độ tương đối 0..1**). |
| Validate | `ocrValidate.ts`, `ocrRegionVerify.ts` | Lọc block xấu; `regionVerification` / crop-ready cho debug. |
| Lưu | `putOcrResult` (`ocrDb.ts`) | IndexedDB store `ocr` theo `studySetId`. |
| Meta | `touchStudySetMeta` | `ocrStatus`, `ocrProvider`. |

**Mục đích OCR trong app:** Lưu **text + hình học block** để **inspector**, **ánh xạ câu hỏi ↔ trang** (overlap text), và chuẩn bị dữ liệu cho **crop** trong tương lai — **không** thay thế bước vision tạo MCQ.

Nếu OCR lỗi một phần: toast cảnh báo, **vision vẫn chạy tiếp**.

---

## 5. Giai đoạn D — AI vision: tạo câu hỏi MCQ

**Orchestrator:** `runVisionSequential` (`src/lib/ai/runVisionSequential.ts`).

### 5.1 Chế độ theo số trang và “attach ảnh”

| Tình huống | Hành vi |
|------------|---------|
| **Attach page image** bật + có `studySetId` | Mỗi trang: `parseVisionPage` một lần; ảnh trang được đưa vào **blob** → `putMediaBlob` → gán `questionImageId` / `sourceImageMediaId` cho mọi câu lấy được từ trang đó (`tryAssignQuestionImageIds`). |
| **1 trang** (không attach hoặc không có study set) | Một lần `parseVisionPage`. |
| **≥ 2 trang**, không attach | **Cặp trang lệch pha:** `(1,2), (2,3), …` — `parseVisionPagePair` với **hai** data URL; tổng số bước = `pages.length - 1`. |

**Gọi API thấp tầng:** `parseVisionPage` / `parseVisionPagePair` (`parseVisionPage.ts`) — build payload multimodal (ảnh), gọi OpenAI-compatible chat, parse JSON → `Question[]`, validate cơ bản.

**Hậu xử lý:** `dedupeQuestionsByStem` tránh trùng stem; lỗi nặng (`FatalParseError`) có thể dừng sớm với `fatalError`.

---

## 6. Giai đoạn E — Ánh xạ câu hỏi ↔ trang (sau vision)

**Hàm:** `applyQuestionPageMapping` (`src/lib/ai/mapQuestionsToPages.ts`).

- **`parseMode`:** `attach_single` | `single` | `pair` — ảnh hưởng **provenance** (`mappingMethod`, `mappingConfidence`, lý do).
- **OCR:** Nếu có snapshot OCR, có nhánh **overlap token** giữa text câu hỏi + options với text từng trang để gợi ý `sourcePageIndex` / `imagePageIndex` khi thiếu hoặc cần tin cậy hơn (ngưỡng trong file).

**Best-effort nhưng không im lặng:** lỗi `getOcrResult` / `applyQuestionPageMapping` được ghi **`pipelineLog`** (domain **`MAPPING`** cho bước ánh xạ), có **toast** cảnh báo/lỗi; draft vẫn lưu khi mapping throw. Chất lượng ánh xạ (ngưỡng `mappingQuality.ts`, chip Mapped / Uncertain / Unresolved) hiển thị ở **Review** và parse preview; tóm tắt parse có thể nối thêm câu về số câu **uncertain mapping**.

---

## 7. Giai đoạn F — Lưu draft & tiến độ

Trong `AiParseSection`, sau khi vision xong (không fatal / không abort):

- `persistQuestions` → `putDraftQuestions` (retry **IDB** transient qua `pipelineStageRetry` / `idb_put`), có thể kèm `putParseProgressRecord`, v.v. (`studySetDb.ts`).
- UI: `QuestionPreviewList`, overlay log, progress.

Người dùng sau đó vào **review** để sửa / approve — dữ liệu chấm điểm nằm ở các phase khác của roadmap.

---

## 8. Ràng buộc & điều kiện (tóm tắt)

| Điều kiện | Hệ quả |
|-----------|--------|
| BYOK thiếu key / base URL không hợp lệ / thiếu model khi có custom URL | `parseCapabilities` chặn surface; UI hiển thị lý do trước khi chạy (Phase 19). |
| Không API key / thiếu model khi đã nhập base URL | Không chạy vision / OCR forward. |
| PDF không render được | Dừng trước OCR/vision, thông báo lỗi. |
| Attach ảnh | Ảnh lưu là **cả trang** đã raster, **không** cắt theo bbox câu hỏi trong pipeline hiện tại. |

---

## 9. File tham chiếu nhanh

| Vùng | File |
|------|------|
| UI parse | `src/components/ai/AiParseSection.tsx` |
| Raster | `src/lib/pdf/renderPagesToImages.ts`, `renderSinglePdfPageToDataUrl` |
| OCR chạy | `src/lib/ai/runOcrSequential.ts`, `ocrAdapter.ts` |
| OCR lưu | `src/lib/ai/ocrDb.ts` |
| Vision chạy | `src/lib/ai/runVisionSequential.ts`, `parseVisionPage.ts` |
| Map trang | `src/lib/ai/mapQuestionsToPages.ts`, `src/lib/ai/mappingQuality.ts` |
| DB study set | `src/lib/db/studySetDb.ts` |
| Forward API | `src/lib/ai/sameOriginForward.ts` |
| BYOK 3-field + migration | `src/lib/ai/forwardSettings.ts`, `docs/BYOK-forward-only.md` |
| Capability matrix (declarative) | `src/lib/ai/parseCapabilities.ts`, `src/lib/ai/parseCapabilityMessages.ts` |
| Retry theo stage | `src/lib/ai/pipelineStageRetry.ts` |
| Log pipeline | `src/lib/logging/pipelineLogger.ts` |
| Inspector OCR | `src/components/ai/OcrInspector.tsx` |

---

## 10. Ghi chú “gsd-scan”

Tài liệu này được tạo theo tinh thần **`/gsd-scan`** — một bản đồ **một vùng** (ingestion → OCR → vision → quiz draft) trong `.planning/codebase/`, thay vì full `ARCHITECTURE.md` bốn agent.

*Nguồn: quét codebase `src/` — 2026-04-08.*
