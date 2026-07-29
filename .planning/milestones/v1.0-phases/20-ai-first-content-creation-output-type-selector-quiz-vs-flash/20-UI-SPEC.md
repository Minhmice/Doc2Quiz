# Phase 20 — UI design contract (AI-first create flow)

**Scope:** Entry chooser, typed upload steps, product-facing parse shell copy/visibility, dev OCR surface. Không redesign full dashboard stats.

## 1. Output type selector (`/sets/new`)

**Primary question (heading):** `What do you want to create?` (có thể thêm subtitle một dòng: upload a file — AI drafts content for you to review.)

**Layout:** Hai **card** hoặc hai **large buttons** (grid 1×2 desktop, stack mobile), cùng visual weight.

| Choice | Title | Short description | navigates to |
|--------|-------|-------------------|--------------|
| Quiz | Create Quiz | Multiple-choice questions for practice | `/sets/new/quiz` |
| Flashcards | Create Flashcards | Flip cards for quick review | `/sets/new/flashcards` |

**Không** có: OCR, vision, layout chunks, parse policy, provider jargon trên screen này.

**Back:** Link rõ `← Library` về `/dashboard`.

## 2. Quiz upload (`/sets/new/quiz`)

- **Title:** `Create quiz from file`
- **Subcopy (một dòng):** Upload a PDF (max 10 MB). AI will draft multiple-choice questions — you review before saving.
- **Body:** Reuse/d mirror `UploadBox` patterns từ flow hiện tại; loading + error states giữ tone hiện tại (đỏ nhẹ, không panic copy).
- **Sau success:** `router.push(/sets/${id}/source)` như hiện tại (source vẫn là parse hub nội bộ cho đến khi plan 02 rút gọn UI).

## 3. Flashcards upload (`/sets/new/flashcards`)

- **Title:** `Create flashcards from file`
- **Subcopy:** Upload a PDF. AI will draft card fronts and backs — you review before saving.
- **Sau success:** cùng pattern navigate tới `/sets/[id]/source` **hoặc** route review flashcard nếu plan 02 đã tách — planner chốt; mặc định spec: vẫn `source` trước nếu parse chưa tách route.

## 4. Dashboard & global entry

- **+ Create New Set** (`AppTopBar`), **Import PDF** / empty CTA (`DashboardLibraryClient`), **Command palette** “new set”: tất cả trỏ **`/sets/new`** (selector), **không** `/sets/new` upload trực tiếp nữa.

## 5. Product-facing source page (post–plan 02)

- Ẩn **OcrInspector**, **QuestionMappingDebug** (hoặc chỉ trong dev build / query `?debug=1` — planner chốt một policy).
- Copy user-facing: tránh chữ **OCR**, **layout chunk**, **vision fallback** trong label chính; progress vẫn có thể nói “Reading document…”, “Generating draft…”.
- **Advanced / Estimate** panels: có thể thu gọn behind **Advanced** disclosure hoặc ẩn khi `contentKind` quiz/flashcards product mode — không bắt buộc xóa component.

## 6. Dev OCR page (`/dev/ocr`)

- **Audience:** dev / internal only.
- **Không** liên kết từ dashboard primary CTAs.
- **Tối thiểu:** upload PDF + chạy lại pipeline OCR/parse debug đã có (compose `OcrInspector` + đoạn parse tương tự source); styling functional (không cần polish product).

## Accessibility

- Selector: mỗi card là một control keyboard-focusable (`Link` hoặc `button`); có `aria-label` mô tả đích.
- Upload: giữ `UploadBox` a11y hiện có.

## Non-goals (UI)

- Không thay layout stats cards dashboard.
- Không i18n đầy đủ — tiếng Anh UI string theo codebase hiện tại.
