export type AiProvider = "openai" | "anthropic" | "custom";

/**
 * Quiz-lane persistence type (MCQ) used by review and practice.
 *
 * Do not use this type for flashcards; flashcards use `FlashcardVisionItem`
 * and `ApprovedFlashcardBank` in their dedicated lane.
 */
export type Question = {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /** Explanation generated from the cited document chunk. */
  explanation?: string;
  /** Stable chunk id from the text-to-MCQ pipeline. */
  sourceChunkId?: string;
  questionImageId?: string;
  optionImageIds?: [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ];
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
export const LS_OPENAI_URL = "doc2quiz:ai:openaiUrl";
export const LS_ANTHROPIC_URL = "doc2quiz:ai:anthropicUrl";
export const LS_CUSTOM_KEY = "doc2quiz:ai:customKey";
export const LS_CUSTOM_URL = "doc2quiz:ai:customUrl";
export const LS_OPENAI_MODEL = "doc2quiz:ai:openaiModel";
export const LS_ANTHROPIC_MODEL = "doc2quiz:ai:anthropicModel";
export const LS_CUSTOM_MODEL = "doc2quiz:ai:customModel";
export const LS_APPROVED_BANK = "doc2quiz:bank:approvedSet";

/** Phase 19 — single OpenAI-compatible forward client (replaces multi-tab BYOK). */
export const LS_FORWARD_BASE_URL = "doc2quiz:ai:forwardBaseUrl";
export const LS_FORWARD_API_KEY = "doc2quiz:ai:forwardApiKey";
export const LS_FORWARD_MODEL_ID = "doc2quiz:ai:forwardModelId";
export const LS_FORWARD_MIGRATED_V1 = "doc2quiz:ai:forwardMigratedV1";
