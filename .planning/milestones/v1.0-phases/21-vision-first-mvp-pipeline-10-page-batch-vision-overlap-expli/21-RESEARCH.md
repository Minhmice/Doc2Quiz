# Phase 21 — Research notes (lightweight)

**Config:** `workflow.research: false` — không chạy researcher riêng; PRD đầy trong `21-CONTEXT.md`. File này chỉ **neo mã** để planner/executor không lạc path.

## Vision hiện tại (để thay thế / tách)

| File | Vai trò |
|------|---------|
| `src/lib/ai/runVisionSequential.ts` | Single-page attach, single-page, hoặc **pair** `(n-1)` bước `parseVisionPagePair` |
| `src/lib/ai/parseVisionPage.ts` | POST chat/completions, `MCQ_EXTRACTION_SYSTEM_PROMPT`, `questionsFromAssistantContent` |
| `src/lib/ai/prompts/mcq-extraction.prompts.json` | System + vision user templates (sẽ thay bằng `visionPrompts.ts` nén + mode-aware) |
| `src/lib/ai/parseChunk.ts` | `questionsFromAssistantContent` → `validateQuestionsFromJson` — **quiz-only** |
| `src/components/ai/AiParseSection.tsx` | `handleVisionParse`, `runRenderPagesAndOptionalOcr`, OCR prefetch, `finalizeVisionParseResult` |
| `src/lib/pdf/renderPagesToImages.ts` | JPEG data URLs, `VISION_MAX_*` |

## Persistence draft hiện tại

| API | Ghi chú |
|-----|---------|
| `getDraftQuestions` / `putDraftQuestions` | `studySetDb.ts` — một store `Question[]`; flashcard review đang map `Question` (stem/options) |

## Policy / OCR (ra khỏi MVP path)

| File | Ghi chú |
|------|---------|
| `parseRoutePolicy.ts` | Accurate → vision; fast/hybrid → chunk khi OCR on |
| `runOcrSequential.ts`, `ocrAdapter.ts` | Giữ; MVP default không gọi từ product batch path |

## Logging

| File | Ghi chú |
|------|---------|
| `pipelineLogger.ts` | `(domain, stage, level, message, context?)` — cần mở rộng hoặc wrapper object cho stage machine-readable |

## Rủi ro kỹ thuật đã biết

- **10 ảnh / request:** payload lớn — giữ `VISION_MAX_WIDTH_DEFAULT` / JPEG quality; có thể cần giảm thêm khi đo thực tế.
- **SubtleCrypto SHA-1** trong browser cho fingerprint — async; fallback nếu không có crypto.
- **Dedupe overlap:** cần key ổn định (normalized stem / front) trước khi append UI.
