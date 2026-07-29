# Debug: StudySetNewImportStepProvider missing on create routes

**Status:** resolved  
**Routes:** `/quiz/create`, `/flashcard/create`  
**Symptom:** `useStudySetNewImportStep must be used within StudySetNewImportStepProvider`

## Root cause

`UnifiedInputZone` calls `useStudySetNewImportStep()` to drive ingest step state (`upload` → `read` → `generate`).

`/edit/new/quiz` and `/edit/new/flashcards` wrap content in `QuizNewImportWorkbench` / `FlashcardsImportWorkbench`, which include `StudySetNewImportStepProvider`.

`/quiz/create` and `/flashcard/create` render `StudySetCreateWizard` → `UnifiedInputZone` **without** the provider.

## Fix

Wrap `UnifiedInputZone` in `StudySetNewImportStepProvider` inside `StudySetCreateWizard.tsx`.

## Verify

1. Open `/quiz/create` — page loads, no runtime error.
2. Open `/flashcard/create` — same.
3. Start convert — step context updates during ingest (`setStep("read")`, etc.).
