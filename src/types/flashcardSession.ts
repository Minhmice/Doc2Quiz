import type { Question } from "@/types/question";

/** In-memory flashcard session — read-only snapshot from approved bank at load. */
export type FlashcardSessionState = {
  questions: Question[];
  index: number;
  flipped: boolean;
};
