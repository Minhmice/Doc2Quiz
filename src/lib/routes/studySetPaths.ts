function quizPath(setId: string, action?: string): string {
  return `/quiz/${setId}${action ? `/${action}` : ""}`;
}

function flashcardPath(setId: string, action?: string): string {
  return `/flashcard/${setId}${action ? `/${action}` : ""}`;
}

export function createStudySet(): string {
  return "/create";
}

export function createQuiz(): string {
  return "/quiz/create";
}

export function createFlashcard(): string {
  return "/flashcard/create";
}

export function quizOverview(setId: string): string {
  return quizPath(setId);
}

export function quizReview(setId: string): string {
  return quizPath(setId, "review");
}

export function quizEdit(setId: string): string {
  return quizPath(setId, "edit");
}

export function quizPlay(setId: string): string {
  return quizPath(setId, "play");
}

export function quizResults(setId: string): string {
  return quizPath(setId, "results");
}

export function quizDrillMistakes(setId: string): string {
  return quizPath(setId, "drill-mistake");
}

export function flashcardOverview(setId: string): string {
  return flashcardPath(setId);
}

export function flashcardReview(setId: string): string {
  return flashcardPath(setId, "review");
}

export function flashcardEdit(setId: string): string {
  return flashcardPath(setId, "edit");
}

export function flashcardPlay(setId: string): string {
  return flashcardPath(setId, "play");
}

export function flashcardResults(setId: string): string {
  return flashcardPath(setId, "results");
}

export function flashcardDrillMistakes(setId: string): string {
  return flashcardPath(setId, "drill-mistake");
}
