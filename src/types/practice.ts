import type { Question } from "@/types/question";

/** idle → no session; active → answering; complete → last question answered */
export type PracticeSessionStatus = "idle" | "active" | "complete";

export type PracticeAnswerRecord = {
  choiceIndex: 0 | 1 | 2 | 3;
};

/**
 * In-memory session snapshot: `questions` is an ordered copy of the approved
 * bank taken when the session starts.
 */
export type PracticeSessionSnapshot = {
  status: PracticeSessionStatus;
  questions: Question[];
  currentIndex: number;
  answersByQuestionId: Record<string, PracticeAnswerRecord>;
};
