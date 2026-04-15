# Flashcards workflow (strict lane) — Doc2Quiz

**Updated:** 2026-04-14  
**Scope:** chỉ lane Flashcards sau refactor (vision-only + theory-only + storage tách riêng).  
**Non-goals:** quiz/MCQ pipeline, OCR/text chunking, layout chunk parsing.

---

## 0. Invariants (không được phá)

Khi `StudySetMeta.contentKind === "flashcards"` (→ `parseOutputMode === "flashcard"`):

- **Vision-only generation**: chỉ dùng **vision batch** từ ảnh trang PDF. Không OCR, không chunk text, không hybrid.
- **Theory-only cards**: chỉ tạo thẻ khái niệm (concept extraction), không chuyển đổi thành câu hỏi/MCQ/exam.
- **Strict schema**: luôn trả JSON theo schema:

```json
{
  "cards": [
    { "front": "string", "back": "string", "sourcePages": [1] }
  ]
}
```

- **Strict grounding**: mỗi card phải có `sourcePages` **non-empty**, **1-based**, chỉ chứa trang thực sự support card.
- **Storage separation**: flashcards approved được lưu vào IndexedDB store **`approvedFlashcards`**, không “độn” vào `ApprovedBank.questions`.

---

## 1. Types & contracts

- **Content lane switch**
  - `StudySetMeta.contentKind`: `src/types/studySet.ts`
  - `parseOutputModeFromContentKind`: `src/types/visionParse.ts`

- **Flashcard item + approved bank**
  - `FlashcardVisionItem`: `src/types/visionParse.ts`
  - `ApprovedFlashcardBank`: `src/types/visionParse.ts` (deck approved, `items: FlashcardVisionItem[]`)

- **Generation config (UI controls)**
  - `FlashcardGenerationConfig`: `src/types/flashcardGeneration.ts`
  - Normalize + defaults: `normalizeFlashcardGenerationConfig`, clamp target 10–60.

---

## 2. Prompt (theory-first) + controls mapping

**Files:**
- Prompt builder: `src/lib/ai/visionPrompts.ts`

### 2.1 System prompt (flashcard)

`buildVisionSystemPrompt("flashcard", { flashcardGeneration, requirePerItemSourcePages: true })`:

- Mặc định nhấn mạnh:
  - thẻ là **theory study cards** (không Q&A/exam/MCQ)
  - `front` cue/nêu concept, `back` giải thích trung tính
  - JSON only, no fences
  - **bắt buộc** `sourcePages` per card
  - dedupe/merge duplicates trong batch, bỏ fragments, không bịa, giữ ngôn ngữ tài liệu

- **Controls** (FlashcardGenerationConfig) được chèn vào prompt:
  - `targetCount`: `"auto"` hoặc số 10–60
  - `learningDepth`: `quick_recall` / `standard` / `deep`
  - `focusMode`: `definitions` / `key_points` / `formulas` / `processes` / `comparisons` / `mixed`

### 2.2 User prompt (flashcard)

`buildVisionUserPrompt({ mode:"flashcard", startPage, endPage, totalPages, requirePerItemSourcePages:true, flashcardGeneration })`:

- Cho model biết batch covers trang nào trong tổng số trang.
- Nhắc trả `{ "cards": [...] }` đúng schema.

---

## 3. Vision batch runner (Flashcards only)

**File:** `src/lib/ai/runVisionBatchSequential.ts`

Điểm chính:

- `runVisionBatchSequential({ mode: "flashcard", flashcardGeneration: FlashcardGenerationConfig, ... })`
- Flashcard lane luôn **strict `sourcePages`** và **không chạy fallback legacy 10+2** (flashcard phải giữ provenance per-card).
- Cache fingerprint cho batch parse bao gồm cả `flashcardGeneration` (đổi config → cache key khác).

Hình dạng request:
- `messages[0]`: systemText (theory-only + schema + strict sourcePages)
- `messages[1]`: user text + nhiều `image_url`
- `response_format: { type: "json_object" }` (fallback 400 → retry without format vẫn giữ schema)

---

## 4. Parse + validation

**Parse:**
- `parseVisionFlashcardResponse`: `src/lib/ai/parseVisionFlashcardResponse.ts`
  - Dùng `parseJsonFromModelText`
  - Không dùng MCQ parser

**Validate:**
- `validateVisionFlashcardItems`: `src/lib/ai/validateVisionFlashcardItems.ts`
  - Nhận `cards` (và legacy alias `flashcards`)
  - Bắt buộc `front/back` non-empty
  - Khi `requireSourcePages: true`: bắt buộc `sourcePages` hợp lệ + đúng `pageBounds`

**Post-process:**
- Confidence heuristic: `src/lib/ai/visionConfidence.ts` (`computeFlashcardConfidence`)
- Dedupe: `src/lib/ai/visionDedupe.ts` (key = normalized `front||back`)

---

## 5. Orchestration (UI) — loại bỏ ambiguity với Quiz

**File:** `src/components/ai/AiParseSection.tsx`

Flashcard lane:
- `parseOutputMode === "flashcard"` → **bắt buộc vision batch** (không `runVisionSequentialWithUi`)
- Prep render pages có `forceSkipOcr: true` (không gọi OCR trong flashcard lane)
- Guard: nếu code cố chạy layout chunk/hybrid → ném `FatalParseError`

Persist sau parse:
- Approved: `putApprovedFlashcardBankForStudySet(studySetId, bank)` → ghi vào `approvedFlashcards` và clear `approved.questions`.
- Draft: `putDraftFlashcardVisionItems(studySetId, items, flashcardGenerationConfig)` để resume.

---

## 6. Persistence (IndexedDB)

**File:** `src/lib/db/studySetDb.ts`  
**DB_VERSION:** 6 (`src/types/studySet.ts`)

Stores liên quan:
- `approved`: quiz lane (`ApprovedBank` → `questions: Question[]`)
- `approvedFlashcards`: flashcard lane (`ApprovedFlashcardBank` → `items: FlashcardVisionItem[]`)
- `draft`: chứa `flashcardVisionItems` và `flashcardGenerationConfig`

API:
- `getApprovedFlashcardBank`, `putApprovedFlashcardBankForStudySet`
- `getDraftFlashcardVisionItems`, `putDraftFlashcardVisionItems`

### 6.1 Migration từ legacy “MCQ carrier”

Nếu gặp set `contentKind === "flashcards"` nhưng flashcards từng được lưu dạng “MCQ giả” trong `approved.questions`:
- `getApprovedFlashcardBank` sẽ gọi `migrateLegacyFlashcardCarrierToApprovedFlashcards` (chỉ khi mọi row match pattern carrier), rồi đọc lại từ `approvedFlashcards`.

---

## 7. Review + Study routes

**Review (edit):**
- Route: `src/app/(app)/edit/flashcards/[id]/page.tsx`
- Ưu tiên load approved deck từ `approvedFlashcards`, fallback sang draft.
- Save: ghi `approvedFlashcards` + draft; cập nhật meta status.

**Study (play):**
- Component: `src/components/flashcards/FlashcardSession.tsx`
- Data source: `getApprovedFlashcardBank(studySetId)` → `items`.

**Done page:**
- `src/app/(app)/flashcards/[id]/done/page.tsx` đếm từ `approvedFlashcards.items.length`.

**Dashboard counts:**
- `src/hooks/useDashboardHome.ts` đếm approved theo `contentKind`:
  - quiz → `approved.questions.length`
  - flashcards → `approvedFlashcards.items.length`

---

## 8. Quick reference (files)

| Area | File |
|------|------|
| Prompt + schema | `src/lib/ai/visionPrompts.ts` |
| Vision batch runner | `src/lib/ai/runVisionBatchSequential.ts` |
| Flashcard parse | `src/lib/ai/parseVisionFlashcardResponse.ts` |
| Flashcard validate | `src/lib/ai/validateVisionFlashcardItems.ts` |
| Lane types | `src/types/visionParse.ts`, `src/types/studySet.ts` |
| Generation config | `src/types/flashcardGeneration.ts` |
| Orchestration | `src/components/ai/AiParseSection.tsx` |
| IDB | `src/lib/db/studySetDb.ts` |
| Generation controls UI | `src/components/edit/new/flashcards/FlashcardsGenerationControls.tsx` |
| Review page | `src/app/(app)/edit/flashcards/[id]/page.tsx` |
| Study session | `src/components/flashcards/FlashcardSession.tsx` |
