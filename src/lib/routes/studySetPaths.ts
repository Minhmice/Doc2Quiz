/** Canonical study-set URLs (see `next.config.ts` redirects from legacy `/sets/…`). */

export function newRoot(): string {
  return "/new";
}

export function newQuiz(): string {
  return "/new/quiz";
}

export function newFlashcards(): string {
  return "/new/flashcards";
}

export function editQuiz(id: string): string {
  return `/edit/quiz/${id}`;
}

export function editFlashcards(id: string): string {
  return `/edit/flashcards/${id}`;
}

export function quizPlay(id: string): string {
  return `/quiz/${id}`;
}

export function quizDone(id: string): string {
  return `/quiz/${id}/done`;
}

export function flashcardsPlay(id: string): string {
  return `/flashcards/${id}`;
}

export function flashcardsDone(id: string): string {
  return `/flashcards/${id}/done`;
}
