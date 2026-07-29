import {
  flashcardDrillMistakes,
  flashcardEdit,
  flashcardOverview,
  flashcardPlay,
  flashcardResults,
  flashcardReview,
  quizDrillMistakes,
  quizEdit,
  quizOverview,
  quizPlay,
  quizResults,
  quizReview,
} from "@/lib/routes/studySetPaths";
import type { StudySetMeta } from "@/types/studySet";

type StudySetDestination = Readonly<{
  quiz: (setId: string) => string;
  flashcards: (setId: string) => string;
}>;

function destinationHref(meta: StudySetMeta, destination: StudySetDestination): string {
  return meta.contentKind === "flashcards"
    ? destination.flashcards(meta.id)
    : destination.quiz(meta.id);
}

export function openOverviewHref(meta: StudySetMeta): string {
  return destinationHref(meta, {
    quiz: quizOverview,
    flashcards: flashcardOverview,
  });
}

export function reviewHref(meta: StudySetMeta): string {
  return destinationHref(meta, {
    quiz: quizReview,
    flashcards: flashcardReview,
  });
}

export function editHref(meta: StudySetMeta): string {
  return destinationHref(meta, {
    quiz: quizEdit,
    flashcards: flashcardEdit,
  });
}

export function playHref(meta: StudySetMeta): string {
  return destinationHref(meta, {
    quiz: quizPlay,
    flashcards: flashcardPlay,
  });
}

export function resultsHref(meta: StudySetMeta): string {
  return destinationHref(meta, {
    quiz: quizResults,
    flashcards: flashcardResults,
  });
}

export function drillMistakesHref(meta: StudySetMeta): string {
  return destinationHref(meta, {
    quiz: quizDrillMistakes,
    flashcards: flashcardDrillMistakes,
  });
}

export const openEditorHref = editHref;
export const reviewMistakesHref = drillMistakesHref;
