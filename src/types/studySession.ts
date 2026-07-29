export type StudyMode = "quiz" | "flashcard";
export type StudyPractice = "standard" | "mistakes";

export type QuizAnswerState = Record<
  string,
  { selectedIndex: number; correct: boolean }
>;

export type FlashcardKnownState = Record<
  string,
  { known: boolean; rating: "again" | "hard" | "good" | "easy" }
>;

export type StudyInteractionState =
  | { mode: "quiz"; answers: QuizAnswerState }
  | { mode: "flashcard"; cards: FlashcardKnownState };

export type StudySession = {
  id: string;
  ownerId: string;
  studySetId: string;
  mode: StudyMode;
  practice: StudyPractice;
  itemIds: string[];
  currentItemId: string | null;
  nextItemId: string | null;
  interaction: StudyInteractionState;
  revision: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type StudySessionDraft = Pick<
  StudySession,
  | "studySetId"
  | "mode"
  | "practice"
  | "itemIds"
  | "currentItemId"
  | "nextItemId"
  | "interaction"
>;

export type StudyMistake = {
  ownerId: string;
  studySetId: string;
  itemId: string;
  mode: StudyMode;
  unresolved: boolean;
  mistakeCount: number;
  firstMistakeAt: string;
  lastMistakeAt: string;
  lastPracticedAt: string;
  resolvedAt: string | null;
};

export type MistakeSetOverview = {
  studySetId: string;
  mode: StudyMode;
  mistakeCount: number;
  lastPracticedAt: string;
};

export type SmartResumeResult =
  | { kind: "session"; session: StudySession }
  | { kind: "picker"; sessions: StudySession[] }
  | { kind: "recent"; studySetId: string; mode: StudyMode }
  | { kind: "empty" };

export const MAX_STUDY_SESSION_ITEMS = 2_000;
export const MAX_STUDY_INTERACTION_ENTRIES = 2_000;
