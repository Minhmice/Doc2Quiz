# Phase 21 — Plan 21-02 summary

Executed: `handleVisionParse` uses **`runVisionBatchSequential`** when attach-page-image is off (or no study set id); attach path unchanged (`runVisionSequentialWithUi`). **`parseOutputMode`** from `StudySetMeta.contentKind` on source page; **`ParseRunResult.flashcardItems`**; **`finalizeVisionBatchParseResult`** persists quiz vs flashcard drafts; incremental UI via **`onItemsExtracted`** (progress + quiz preview append). **`ParseResultOverlay`** flashcard summary; flashcard review uses **`getDraftFlashcardVisionItems` / `putDraftFlashcardVisionItems`** with legacy fallback from `getDraftQuestions`. Docs: **`docs/WORKFLOW-vision-parse-detailed.md`** §3.1, **`docs/MIGRATION-vision-mvp-draft.md`**.

Verification: `npm run lint`, `npm run build` (2026-04-11).
