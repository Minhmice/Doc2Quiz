# Phase 20 — Context (PRD)

Source: `/gsd-add-phase` product brief (2026-04-11).

---

## 1. Mục tiêu sản phẩm

Refactor luồng tạo nội dung theo hướng **AI-first**, ít ma sát, ít lựa chọn kỹ thuật, UX-centric.

**Phiên bản mới:**

- User vào web từ **dashboard/library** hiện tại → bấm **tạo mới**.
- Thay vì đi thẳng vào “Create New Set” kiểu cũ: hệ thống đưa user qua bước **chọn loại đầu ra**: **Create Quiz** | **Create Flashcards**.
- Sau khi chọn loại: user **chỉ upload file** → hệ thống **AI parse** trực tiếp cho đầu ra tương ứng.
- **OCR không xuất hiện trong main flow** nữa. OCR **không xóa** khỏi project — tách sang **page/dev surface** riêng (vd. `/dev/ocr`, `/ocr-lab`) phục vụ dev nội bộ.

**Flow mục tiêu:** `Dashboard → chọn output type → upload → AI parse → review → save/use`

Không bắt user suy nghĩ về OCR, parse mode, policy route, toggle kỹ thuật ngay từ đầu; các thành phần đó vẫn trong parse domain. **Không phá** domain boundary parse vs learning (Phase 16). Đơn giản hóa **product-facing flow**, không phá boundary.

---

## 2. Product direction

### 2.1 Triết lý

Từ: “upload PDF rồi chọn parse strategy / OCR / vision / text path”  
Sang: **“tôi muốn tạo quiz hay flashcards từ file này?”**  
Mental model: **đầu ra học tập**, không phải **công nghệ parse**.

### 2.2 OCR giai đoạn này

- Không toggle OCR trên flow chính; không OCR inspector trong flow bình thường; không bắt chọn OCR; không đẩy OCR làm lựa chọn đầu.
- **Giữ code OCR**; không refactor phá hủy; **route dev** với upload PDF, chạy OCR/dev parse, hiển thị Q&A hoặc blocks/debug; có thể guard (menu dev, settings, không link từ dashboard chính).
- **Tái dùng** module parse domain — không nhân đôi pipeline.

---

## 3. Workflow mới

### 3.1 Dashboard/library

- Giữ dashboard landing.
- **Create New Set** / **Import PDF** → **không** nhảy thẳng form upload cũ → qua **Step 1: chọn loại** (Quiz / Flashcards).
- UI: 2 card/button lớn, mô tả ngắn, CTA rõ.

### 3.2 Flow Quiz

Chọn Create Quiz → upload → AI parse → draft questions → **review** (bắt buộc/khuyến nghị mạnh) → approve/save → play/practice như hiện có.  
**Không** hiện OCR toggle, terminology OCR/layout chunks/vision fallback/parse route policy trên UI chính. Engine bên dưới có thể giữ pipeline hiện tại.

### 3.3 Flow Flashcards

Chọn Flashcards → upload → AI parse → flashcards → **review flashcards** (front/back, skim, delete, approve all/selected) → save → session route hiện có hoặc entry mới.  
Output: **front / back / optional tags/provenance** — **không** ép flashcard = MCQ giả. Nếu codebase nghiêng `Question[]`, thiết kế abstraction **study content type** gọn.

### 3.4 OCR dev page

Route riêng (`/dev/ocr`, `/lab/ocr`, …): upload, chạy OCR flow, optional parse → Q&A hoặc debug; dev tool, không polish production; **không** expose trên dashboard chính.

---

## 4. UX/UI cụ thể

- Dashboard: giữ sạch; Create / Import → flow chọn type (hoặc chooser nhỏ trước upload nếu one-click).
- Page chọn type: ví dụ `/create` hoặc `/sets/new/select-type` — title kiểu “What do you want to create?”; note ngắn về upload + AI draft; **không** giải thích dài OCR/text/vision.
- Upload pages: wording “Create Quiz from File” / flashcards tương tự; dropzone; trạng thái rõ; cảm giác “AI làm việc cho mình”.
- Ẩn OCR toggle, OCR inspector, wording OCR trên **source page product-facing**.

---

## 5. Kiến trúc / implementation

- **Không phá** boundary parse vs learning.
- **Không phá** parse engine (text/OCR/layout/vision/policy) — product gọi **entrypoint đơn giản**, complexity ẩn.
- **`contentType`**: `quiz` | `flashcards`** qua params/state/upload/orchestration/review/save/CTA tiếp theo.
- **Reuse** dashboard, create infra, review routes, flashcards session, parse modules.

---

## 6. Thay đổi so với flow hiện tại

- `sets/new/page.tsx`: create entry cần **select type** trước upload.
- `sets/[id]/source/page.tsx`: parse hub — **giảm surface kỹ thuật** nếu vẫn user-facing; OCR inspector ẩn khỏi main.
- Flashcards: đưa lên **lựa chọn tạo mới** ngang quiz.

---

## 7. Route behavior (gợi ý)

**Option A:** `/dashboard` → `/create` → `/create/quiz` | `/create/flashcards` → sau parse tạo set → `/sets/[id]/review` (quiz) hoặc flashcard review path.

**Option B:** `/sets/new` = chọn type; `/sets/new/quiz`, `/sets/new/flashcards`.

Ưu tiên route **tách rõ content type** để code/agent dễ reason.

---

## 8. AI parsing

Main flow: AI parse first-class; ít bước; time-to-first-draft nhanh; fallback nội bộ không lộ ma trận tùy chọn.

---

## 9. Acceptance criteria

1. Từ dashboard, flow mới có bước chọn **Quiz** / **Flashcards**.
2. Quiz: upload + AI parse + review quiz hoàn chỉnh.
3. Flashcards: upload + AI parse + review/save flashcards hoàn chỉnh.
4. OCR không còn lựa chọn/panel nổi bật trong main flow.
5. OCR vẫn trong codebase + **route/page dev** để upload PDF và chạy OCR/dev parse.
6. Main flow không yêu cầu hiểu OCR, parse route policy, vision fallback, layout chunks.
7. Không phá domain boundary; reuse routes/components/storage tối đa.
8. Sau parse: quiz → review/play pipeline; flashcards → flashcard review/session pipeline.
9. Dashboard + create flow gọn hơn, ít toggle kỹ thuật.

---

## 10. Non-goals (đợt này)

- Không xóa OCR modules, `parseRoutePolicy`, unified engine.
- Không redesign toàn dashboard; không cloud sync/auth/backend mới; không rewrite storage toàn phần.
- Không polish OCR dev page như production.
- Không giải quyết toàn bộ math/OCR hard case trong vòng này.
