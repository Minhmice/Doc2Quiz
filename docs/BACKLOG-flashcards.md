# Flashcards mode — backlog

Deferred feature: add a dedicated **flashcard** study mode alongside multiple-choice practice.

## Goals

- Let learners flip cards (front → back) with keyboard (e.g. Space to flip, arrows to advance).
- Reuse **study sets** and **IndexedDB** storage already used for MCQ (`StudySetMeta`, drafts, approved bank).

## Data model options

1. **Derive from `Question`** (minimal schema change)  
   - Front: `question` text (+ optional `questionImageId`).  
   - Back: the correct option string (+ optional `optionImageIds[correctIndex]`).  
   - Pros: no migration; cons: back side is always “correct answer” shaped, not freeform.

2. **`Flashcard` type** (separate store or embedded array on study set)  
   - Fields: `id`, `frontText`, `backText`, optional `frontImageId`, `backImageId`.  
   - Pros: clean UX for true flashcards; cons: new persistence, optional AI prompt to generate pairs.

Recommendation: start with **(1)** for a fast v1 toggle; add **(2)** if users need independent front/back content.

## UI / routes

- New tab or toggle on `/sets/[id]/practice`: **Quiz** vs **Flashcards**.
- Or route `/sets/[id]/flashcards` with shared shell (`SetSubNav` entry).

## AI

- Optional phase: prompt model to emit `{ flashcards: [{ front, back }] }` or map MCQ → flashcard pairs in the client.

## Dependencies

- Stable per-set storage (done).  
- Optional: image blobs on card faces (same `media` store + `StoredImage` pattern as MCQ).

## Suggested order of implementation

1. Practice shell: mode toggle + flashcard view reading approved `Question[]`.  
2. Keyboard UX + session progress (reuse patterns from `usePracticeSession`).  
3. Optional: dedicated `Flashcard` type + editor + AI parse.  
4. Optional: spaced repetition / mistake deck (ties to future scoring work).
