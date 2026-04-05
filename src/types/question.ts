export type AiProvider = "openai" | "anthropic";

export type Question = {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};

export type ApprovedBank = {
  version: 1;
  savedAt: string;
  questions: Question[];
};

/** localStorage keys — character-for-character per 02-CONTEXT D-04 */
export const LS_PROVIDER = "doc2quiz:ai:provider";
export const LS_OPENAI_KEY = "doc2quiz:ai:openaiKey";
export const LS_ANTHROPIC_KEY = "doc2quiz:ai:anthropicKey";
export const LS_DRAFT_QUESTIONS = "doc2quiz:ai:draftQuestions";
export const LS_APPROVED_BANK = "doc2quiz:bank:approvedSet";
