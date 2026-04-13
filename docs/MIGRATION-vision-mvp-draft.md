# Migration: Vision MVP draft storage (Phase 21)

## Quiz sets

Unchanged: draft multiple-choice rows live in IndexedDB `draft` store as **`questions: Question[]`** via `putDraftQuestions` / `getDraftQuestions`.

## Flashcard sets

New path: **`flashcardVisionItems: FlashcardVisionItem[]`** via `putDraftFlashcardVisionItems` / `getDraftFlashcardVisionItems`. Each item has **`front`**, **`back`**, optional **`sourcePages`**, and a stable **`id`** (assigned on persist if missing).

Saving quiz drafts with **`putDraftQuestions`** sets **`flashcardVisionItems: undefined`**, clearing any prior flashcard draft for that study set.

## Flashcards review page

`/sets/[id]/flashcards/review` prefers **`getDraftFlashcardVisionItems`**. If that list is empty but legacy **`getDraftQuestions`** returns rows (older flow that stored stem + correct option as pseudo-MCQ), the UI maps them once for editing; saving writes **`putDraftFlashcardVisionItems`**.

## Replace PDF

Calling **`putDraftQuestions(id, [])`** on replace still clears MCQ draft and, because of the field above, clears flashcard vision items as well.
