export type PipelineStage =
  | "input"
  | "raw"
  | "canonical"
  | "mode_selected"
  | "quiz"
  | "flashcards";

/** Primary artifact the learner is creating (product flow). */
export type StudyContentKind = "quiz" | "flashcards";

export type StudySetMeta = {
  id: string;
  title: string;
  subtitle?: string;
  createdAt: string;
  updatedAt: string;
  pipelineStage: PipelineStage;
  contentKind?: StudyContentKind;
  /** Optional display label; canonical filename lives in canonical_documents in Phase 3+. */
  sourceFileName?: string;
};

/** @deprecated Canonical detail deferred to Phase 3 — use canonical_documents table. */
export type StudySetDocumentRecord = {
  studySetId: string;
  extractedText: string;
};

export const DB_NAME = "doc2quiz";
export const DB_VERSION = 6;

export const LS_IDB_MIGRATED = "doc2quiz:idb:migrated-from-ls";
