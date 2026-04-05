export type StudySetStatus = "draft" | "ready";

export type StudySetMeta = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceFileName?: string;
  pageCount?: number;
  status: StudySetStatus;
};

export type StudySetDocumentRecord = {
  studySetId: string;
  extractedText: string;
  /** Serialized PDF for vision re-parse after reload */
  pdfArrayBuffer?: ArrayBuffer;
  pdfFileName?: string;
};

export const DB_NAME = "doc2quiz";
export const DB_VERSION = 2;

/** Last-known AI parse progress per study set (throttled writes while parsing) */
export type ParseProgressPhase =
  | "idle"
  | "rendering_pdf"
  | "text_chunks"
  | "vision_pages";

export type ParseProgressRecord = {
  studySetId: string;
  updatedAt: string;
  running: boolean;
  phase: ParseProgressPhase;
  current: number;
  total: number;
};

/** localStorage — set after one-time migration from legacy keys */
export const LS_IDB_MIGRATED = "doc2quiz:idb:migrated-from-ls";
