import {
  editFlashcards,
  editQuiz,
  flashcardsPlay,
  quizPlay,
} from "@/lib/routes/studySetPaths";
import type { StudySetMeta } from "@/types/studySet";

export function reviewDraftHref(meta: StudySetMeta): string {
  if (meta.contentKind === "flashcards") {
    return editFlashcards(meta.id);
  }
  return editQuiz(meta.id);
}

/**
 * @deprecated Use `reviewDraftHref` — same URL (`/edit/...`), kept so older
 * imports of `sourceHref` from this module keep building.
 */
export function sourceHref(meta: StudySetMeta): string {
  return reviewDraftHref(meta);
}

export function playHref(meta: StudySetMeta): string {
  if (meta.contentKind === "flashcards") {
    return flashcardsPlay(meta.id);
  }
  return quizPlay(meta.id);
}

/** Wrong-answer review in MCQ play mode. Not available for flashcard sets. */
export function reviewMistakesHref(meta: StudySetMeta): string | null {
  if (meta.contentKind === "flashcards") {
    return null;
  }
  return `${quizPlay(meta.id)}?review=mistakes`;
}
