export type StudySetStatus = "draft" | "ready";

/** Primary artifact the learner is creating (product flow). Legacy sets omit this. */
export type StudyContentKind = "quiz" | "flashcards";

export type StudySetMeta = {
  id: string;
  title: string;
  subtitle?: string;
  createdAt: string;
  updatedAt: string;
  sourceFileName?: string;
  pageCount?: number;
  status: StudySetStatus;
  /** Set at creation from `/new/quiz` vs `/new/flashcards`; drives product vs developer parse chrome. */
  contentKind?: StudyContentKind;
  /** OCR extraction provider used, or undefined when OCR has not run for this set */
  ocrProvider?: string;
  ocrStatus?: "running" | "done";
};

export type StudySetDocumentRecord = {
  studySetId: string;
  extractedText: string;
  pdfArrayBuffer?: ArrayBuffer;
  pdfFileName?: string;
};

export const DB_NAME = "doc2quiz";
export const DB_VERSION = 6;

export type ParseProgressPhase =
  | "idle"
  | "rendering_pdf"
  | "text_chunks"
  | "ocr_extract"
  | "vision_pages";

export type ParseProgressRecord = {
  studySetId: string;
  updatedAt: string;
  running: boolean;
  phase: ParseProgressPhase;
  current: number;
  total: number;
};

export const LS_IDB_MIGRATED = "doc2quiz:idb:migrated-from-ls";
