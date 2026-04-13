# Doc2Quiz — inventory frontend cho redesign

Tài liệu này mô tả **layout toàn cục**, **vỏ ứng dụng (shell)**, và **từng route/page** hiện có trong codebase (Next.js App Router), phục vụ redesign từ information architecture đến UI.  
Phần **Screenshot** để trống — bạn tự chèn ảnh khi đã chụp màn hình.

**Công nghệ UI (tóm tắt):** Next.js App Router, Tailwind CSS v4, shadcn-style components (`@/components/ui/*`), theme qua CSS variables (`globals.css`) + `next-themes`, font Google: **DM Sans** (body), **Syne** (display/heading), **Geist** (variable `--font-sans`).

---

## 1. Cấu trúc layout theo tầng

### 1.1 Root (`src/app/layout.tsx`)

- `html[lang="en"]`, `body`: `min-h-screen`, `bg-background`, `text-foreground`, gắn biến font + `dmSans.className`.
- Bọc toàn app: `AppRootProviders` (theme, v.v. — xem `components/providers/app-root-providers.tsx` nếu cần chi tiết).

**Gợi ý redesign:** điểm vào brand (favicon, meta title đã là "Doc2Quiz"), typography scale, dark/light mặc định.

### 1.2 Nhóm `(app)` — layout app chính (`src/app/(app)/layout.tsx`)

- Chỉ render `AppProviders` → đây là **shell học viên** (không áp dụng cho mọi route ngoài `(app)` nếu sau này thêm route khác).

### 1.3 `AppProviders` → `AppShell` (`src/components/layout/AppProviders.tsx`, `AppShell.tsx`)

- **ParseProgressProvider** + **CommandPalette** (global) + **AppShell**.
- **AppShell:**
  - `LibrarySearchProvider` + listener focus search.
  - Cột dọc full-height: `bg-background`.
  - **AppTopBar** (sticky).
  - **ParseProgressStrip** (tiến độ parse AI khi chạy).
  - **`<main>`:** `flex-1`, `overflow-y-auto`, padding `px-3 py-5 sm:px-8 sm:py-8` — toàn bộ nội dung page nằm trong đây.

**Gợi ý redesign:** chiều rộng tối đa của main (hiện không cap ở shell — một số page tự `max-w-*`), hành vi sticky top bar, vị trí / style progress strip, command palette (phím tắt, overlay).

### 1.4 Study set layout (`src/app/(app)/sets/[id]/layout.tsx`)

- Wrapper: `mx-auto`, `max-w-5xl lg:max-w-6xl`, `space-y-6`, padding `px-4 py-6 sm:px-6 sm:py-8`.
- Luôn hiển thị **StepProgressBar** phía trên `children`.

**StepProgressBar** (`StepProgressBar.tsx`): 4 bước cố định cho flow quiz — `1. Source` → `2. Review` → `3. Quiz` → `4. Done`.  
Đường dẫn `/flashcards` và `/practice` được map vào bước **"3. Quiz"** (cùng nhóm với play).

**Gợi ý redesign:** flashcards có flow riêng (`source` → `flashcards/review` → `flashcards`) nhưng thanh bước vẫn là 4 bước quiz — có thể cần **thanh bước theo `contentKind`** hoặc copy khác nhau cho deck flashcard.

### 1.5 Dev OCR (`src/app/(app)/dev/ocr/layout.tsx`)

- Production: `notFound()` trừ khi `NEXT_PUBLIC_ENABLE_DEV_OCR_LAB === "true"`.
- Không bọc thêm shell đặc biệt; vẫn dùng `AppShell` như các page `(app)` khác.

---

## 2. Design tokens & theme (`src/app/globals.css`)

- **Light/dark:** bảng màu shadcn-style (`--background`, `--foreground`, `--primary` indigo ~ `#6366f1`, sidebar tokens, v.v.).
- **Legacy Doc2Quiz:** alias `--d2q-*` (surface, border, accent, radius `0.875rem` / `1rem` / `1.25rem`).
- `@theme inline`: map `d2q-*` sang Tailwind, `--font-sans` = body, `--font-heading` = display.

**Gợi ý redesign:** một nguồn sự thật cho màu/spacing; có thể gom dần `d2q-*` về semantic tokens mới để tránh hai hệ song song.

---

## 3. Thanh điều hướng & chrome chung

### 3.1 `AppTopBar` (`src/components/layout/AppTopBar.tsx`)

- Sticky, `border-b`, `bg-card/95`, blur.
- Trái: logo **D2** + chữ **Doc2Quiz** (ẩn trên màn hình rất nhỏ, hiện `sm+`).
- Giữa (desktop): ô **Search study sets…** (gắn `LibrarySearchContext` — filter thư viện trên dashboard).
- Phải: nút search mobile, **ApiStatusIndicator**, menu user/avatar (dropdown), **theme toggle**.
- Dialog search trên mobile.

**Gợi ý redesign:** hierarchy CTA (ví dụ "Tạo mới" nổi bật), vị trí settings, empty state khi chưa có set.

### 3.2 `CommandPalette`, `ParseProgressStrip`

- Palette: lệnh nhanh toàn app (xem implementation trong `CommandPalette.tsx`).
- Strip: feedback parse bất đồng bộ.

**Screenshot (chrome chung):**  
![Top bar + main padding](screenshots/placeholder-topbar-main.png)

---

## 4. Bảng route → mô tả page

Cột **Đường dẫn** là URL người dùng. Component page tương ứng trong repo.

| Đường dẫn | File | Trong shell `(app)`? | Ghi chú |
|-----------|------|----------------------|---------|
| `/` | `src/app/page.tsx` | Không — root | `redirect("/dashboard")` |
| `/dashboard` | `(app)/dashboard/page.tsx` | Có | Thư viện + stats |
| `/settings` | `(app)/settings/page.tsx` | Có | Form AI provider |
| `/sets/new` | `(app)/sets/new/page.tsx` | Có | Chọn Quiz vs Flashcards |
| `/sets/new/quiz` | `(app)/sets/new/quiz/page.tsx` | Có | Import PDF → quiz |
| `/sets/new/flashcards` | `(app)/sets/new/flashcards/page.tsx` | Có | Import PDF → flashcards |
| `/sets/[id]/source` | `(app)/sets/[id]/source/page.tsx` | Có + **Step bar** | Nguồn + parse AI |
| `/sets/[id]/parse` | `(app)/sets/[id]/parse/page.tsx` | Có + Step bar | **Redirect** → `/source` |
| `/sets/[id]/review` | `(app)/sets/[id]/review/page.tsx` | Có + Step bar | Review câu hỏi quiz |
| `/sets/[id]/play` | `(app)/sets/[id]/play/page.tsx` | Có + Step bar | Làm quiz |
| `/sets/[id]/practice` | `(app)/sets/[id]/practice/page.tsx` | Có + Step bar | **Redirect** → `/play` |
| `/sets/[id]/done` | `(app)/sets/[id]/done/page.tsx` | Có + Step bar | Hoàn thành lưu bank |
| `/sets/[id]/flashcards` | `(app)/sets/[id]/flashcards/page.tsx` | Có + Step bar | Học flashcard |
| `/sets/[id]/flashcards/review` | `(app)/sets/[id]/flashcards/review/page.tsx` | Có + Step bar | Review draft thẻ |
| `/dev/ocr` | `(app)/dev/ocr/page.tsx` | Có | Lab nội bộ |
| `/dev/ocr/[id]` | `(app)/dev/ocr/[id]/page.tsx` | Có | Inspector theo set |

---

## 5. Mô tả chi tiết từng page (cho redesign)

### 5.1 `/` (redirect)

- **Nội dung:** không UI — chuyển thẳng dashboard.
- **Screenshot:** _(không bắt buộc)_

---

### 5.2 `/dashboard` — Library

- **Mục đích:** danh sách study set cục bộ; tìm kiếm (từ top bar); thống kê hoạt động.
- **Khối UI:**
  - `DashboardStatsWidget`: cards thống kê (số set đã có bank approved, streak, biểu đồ/ngày gần đây — xem file đầy đủ).
  - `DashboardLibraryClient`: lưới **Card** theo từng set; gradient accent pseudo-deck (`DECK_ACCENTS`); badge draft/approved; dropdown (rename, delete, …); filter theo `search` từ context.
- **Điều hướng điển hình:** vào `/sets/new`, vào từng `/sets/[id]/…`.
- **Screenshot:**  
![Dashboard](screenshots/dashboard.png)

**Ý redesign:** mật độ thẻ, empty state, primary CTA "Tạo study set", mobile card layout.

---

### 5.3 `/settings` — Settings

- **Mục đích:** cấu hình API key / model AI (toàn thiết bị).
- **Khối UI:**
  - Heading **Syne**: "Settings", mô tả nhỏ.
  - Một **card** bo `rounded-2xl`, border, shadow: bọc `AiProviderForm`.
- **Screenshot:**  
![Settings](screenshots/settings.png)

**Ý redesign:** nhóm theo provider, trạng thái kết nối, nguy cơ lộ key (masking), progressive disclosure.

---

### 5.4 `/sets/new` — Chọn loại nội dung

- **Mục đích:** fork quiz vs flashcards trước khi upload.
- **Khối UI:**
  - Header căn giữa: tiêu đề "What do you want to create?", mô tả, link **← Library**.
  - Grid 1 cột → `sm:grid-cols-2`: hai **Card** full-height là **Link** (`/sets/new/quiz`, `/sets/new/flashcards`), hover border primary.
- **Screenshot:**  
![New chooser](screenshots/sets-new-chooser.png)

**Ý redesign:** illustration, so sánh hai luồng, recommended path.

---

### 5.5 `/sets/new/quiz` và `/sets/new/flashcards` — Import PDF

- **Mục đích:** tạo study set mới + upload PDF; sau tạo redirect `/sets/[id]/source`.
- **Khối UI:** dùng chung `NewStudySetPdfImportFlow` với `contentKind` và copy khác nhau (heading/subcopy).
- **Screenshot:**  
![New quiz import](screenshots/sets-new-quiz.png)  
![New flashcards import](screenshots/sets-new-flashcards.png)

**Ý redesign:** drag-drop zone, bước rõ ràng, giới hạn file, preview thumbnail.

---

### 5.6 `/sets/[id]/source` — Source & parse (trung tâm pipeline)

- **Mục đích:** xem meta set, thông tin PDF, **replace PDF**, chạy **AiParseSection**, overlay tiến độ / kết quả; optional **OcrInspector** + **QuestionMappingDebug** (`?debug=1` hoặc surface developer).
- **Khối UI:**
  - Header: `meta.title`, subtitle, tên file nguồn.
  - `PdfInfoCard`: tên, số trang, ngày upload, replace, preview PDF tab mới.
  - `AiParseSection` (embedded), `ParseProgressOverlay`.
  - Vùng **dashed border** CTA khi chưa parse / không đang parse: nút "Parse with AI" / "Generate flashcards".
  - Sau parse thành công: `ParseResultOverlay` + auto redirect sau ~2s tới review (quiz hoặc flashcards/review).
- **Screenshot:**  
![Source idle](screenshots/set-source-idle.png)  
![Source parsing](screenshots/set-source-parsing.png)

**Ý redesign:** tách "document hub" vs "AI run" wizard; rõ ràng cost/token; trạng thái lỗi/retry.

---

### 5.7 `/sets/[id]/parse`

- **Nội dung:** redirect `/sets/[id]/source` — có thể là link cũ / bookmark.
- **Screenshot:** _(tuỳ chọn)_

---

### 5.8 `/sets/[id]/review` — Review câu hỏi (quiz)

- **Mục đích:** chỉnh sửa draft quiz trước khi approve bank.
- **Khối UI:**
  - Header "Review · {title}", hướng dẫn.
  - `ReviewSection` (toàn bộ logic danh sách câu, edit, done).
  - Footer link **← Back to Source**.
- **Screenshot:**  
![Review quiz](screenshots/set-review.png)

**Ý redesign:** keyboard workflow, bulk actions, sidebar outline câu.

---

### 5.9 `/sets/[id]/play` — Take quiz

- **Mục đích:** làm bài với bank đã duyệt; `?review=mistakes` để ôn câu sai.
- **Khối UI:**
  - Header "Take quiz · {title}", subtitle, source, dòng hướng dẫn phím **1–4**; link **Flashcards**.
  - `PlaySession` — UI session đầy đủ.
- **Screenshot:**  
![Play](screenshots/set-play.png)

**Ý redesign:** full-screen focus mode, timer, progress, celebration.

---

### 5.10 `/sets/[id]/practice`

- **Nội dung:** redirect → `/sets/[id]/play`.

---

### 5.11 `/sets/[id]/done` — Done

- **Mục đích:** xác nhận đã lưu bank; số câu approved.
- **Khối UI:**
  - Header "Done · {title}", copy trạng thái.
  - Callout `rounded-lg` viền/accent: nút **Library**, **Review**.
- **Screenshot:**  
![Done](screenshots/set-done.png)

**Ý redesign:** next steps (play, share export nếu có sau này).

---

### 5.12 `/sets/[id]/flashcards` — Study flashcards

- **Mục đích:** học thẻ; phím Space / mũi tên (mô tả trong header).
- **Khối UI:**
  - Header nhỏ hơn play một bậc ở mobile (`text-xl` → `sm:text-3xl`); link **Take quiz**, **Review questions**.
  - `FlashcardSession`.
- **Screenshot:**  
![Flashcards study](screenshots/set-flashcards.png)

**Ý redesign:** swipe mobile, SRS metadata, deck progress.

---

### 5.13 `/sets/[id]/flashcards/review` — Review draft flashcards

- **Mục đích:** sửa front/back từng thẻ draft; Save draft; đi source / study.
- **Khối UI:**
  - Header + row links + **Save draft** (disabled khi không dirty).
  - List **Card** per item: `Textarea` front/back, nút Remove.
- **Screenshot:**  
![Flashcards review](screenshots/set-flashcards-review.png)

**Ý redesign:** split view, keyboard reorder, AI suggest rewrite.

---

### 5.14 `/dev/ocr` — OCR lab (dev)

- **Mục đích:** tạo set dev để debug OCR/parse.
- **Khối UI:** banner amber cảnh báo **Internal OCR lab** + `NewStudySetPdfImportFlow` (title prefix `[Dev OCR]`).
- **Screenshot:**  
![Dev OCR home](screenshots/dev-ocr.png)

---

### 5.15 `/dev/ocr/[id]` — OCR lab theo set

- **Mục đích:** `OcrInspector` đầy đủ cho một study set; link về lab và `/sets/[id]/source`.
- **Screenshot:**  
![Dev OCR set](screenshots/dev-ocr-id.png)

---

## 6. Thư mục component đáng chú ý (ngoài page)

| Khu vực | Đường dẫn gợi ý | Vai trò UI |
|---------|-----------------|------------|
| AI / parse | `src/components/ai/*` | Parse section, overlay, OCR inspector |
| Play | `src/components/play/*` | Session quiz |
| Flashcards | `src/components/flashcards/*` | Session thẻ |
| Review | `src/components/review/*` | Editor bank draft |
| Upload | `src/components/upload/*` | PDF info card |
| Dashboard | `src/components/dashboard/*` | Thư viện, rename dialog, stats |
| Settings | `src/components/settings/*` | Form provider |
| Layout | `src/components/layout/*` | Shell, top bar, step bar, search context |
| UI primitives | `src/components/ui/*` | Button, Card, Dialog, … (shadcn-style) |

---

## 7. Luồng người dùng tóm tắt (để IA redesign)

**Quiz (happy path):**  
Dashboard → New → Quiz → upload → `/sets/[id]/source` (parse) → `/sets/[id]/review` → (approve) → `/sets/[id]/play` → `/sets/[id]/done`.

**Flashcards:**  
Dashboard → New → Flashcards → upload → `/sets/[id]/source` → `/sets/[id]/flashcards/review` → `/sets/[id]/flashcards`.

**Ghi chú UX:** thanh bước hiện tại vẫn nhãn quiz 4 bước khi đang ở flashcards — cân nhắc redesign thanh tiến độ theo **contentKind**.

---

## 8. Phase 23 — layout lab & traceability mock

| Route production | Mock `example/` | Ghi chú |
|------------------|-----------------|---------|
| `/sets/[id]/play` | `doc2quiz_immersive_quiz_play_mode/` | **Phase 23** — port chrome/layout (không đổi phím 1–4). So sánh HTML tĩnh trong lab **`/develop`** (tab Play → Immersive quiz). |

Lab **`/develop`**: shadcn (`Tabs`, `Card`, `Select`, `Sheet`, …) + iframe → `GET /api/develop/mock/[slug]` (allowlist + gate `development` / `ALLOW_DEVELOP_MOCKS=1`).

---

## 9. Scan GSD liên quan

- Workflow **`/gsd-scan`** (focus mặc định `tech+arch`) ghi vào `.planning/codebase/` (STACK, ARCHITECTURE, …). Repo đã có bản cũ; **không overwrite** trong phiên này.
- Nếu cần đồng bộ lại scan kỹ thuật: chạy scan/map-codebase và xác nhận overwrite khi được hỏi.

---

*Tạo từ inventory codebase — cập nhật khi thêm/xoá route hoặc đổi shell.*
