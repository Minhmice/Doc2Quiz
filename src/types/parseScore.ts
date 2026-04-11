/**
 * Official **parseScore** contract types — see `docs/PARSE-SCORE-contract.md`.
 *
 * **OCR** (page/run) and **question** (MCQ post-parse) dimensions must not be collapsed
 * into one scalar quality score. Use `OcrRunQuality` / `OcrPageQuality` vs `QuestionParseQuality`.
 */

import type { OcrPageStatus, OcrRunStats } from "./ocr";
import type { QuestionPageMappingMethod } from "./question";
import type { ParseProgressPhase } from "./studySet";

/** Bump when breaking exported contract shapes (see doc). */
export const PARSE_SCORE_SCHEMA_VERSION = 1 as const;

/** Optional extension phases for retry events not yet in `ParseProgressPhase`. */
export type ParseRetryPhase = ParseProgressPhase | "mapping" | "validation";

export type ParseRetryReasonCode =
  | "ocr_page_failed"
  | "structure_validation_failed"
  | "mapping_uncertain"
  | "user_cancelled"
  | "vision_fallback"
  | "idb_write_failed"
  | (string & {});

export type ParseRetryEvent = {
  phase: ParseRetryPhase;
  reasonCode: ParseRetryReasonCode;
  at?: string;
  detail?: string;
};

export type ParseRetryHistory = {
  readonly events: readonly ParseRetryEvent[];
};

/** Per-page OCR pipeline view — no question stem quality. */
export type OcrPageQuality = {
  pageIndex: number;
  status: OcrPageStatus;
  blockCount: number;
  blockConfidenceMin?: number;
  blockConfidenceMax?: number;
  blockConfidenceMean?: number;
  invalidBlockCount?: number;
  regionCropReadyCount?: number;
  regionPageUsableForCrop?: boolean;
};

/** Run-level OCR aggregates — separate from `QuestionParseQuality`. */
export type OcrRunQuality = {
  schemaVersion: typeof PARSE_SCORE_SCHEMA_VERSION;
  pages: OcrPageQuality[];
  stats?: OcrRunStats;
};

/** MCQ structure facets (post-parse). */
export type QuestionStructureQuality = {
  parseStructureValid?: boolean;
  hasFourOptions?: boolean;
  correctIndexInRange?: boolean;
};

/** Page / pipeline linkage for the question — not OCR block lists. */
export type QuestionProvenanceQuality = {
  mappingMethod?: QuestionPageMappingMethod;
  mappingConfidence?: number;
  mappingReason?: string;
  verifiedRegionAvailable?: boolean;
  sourcePageIndex?: number;
  ocrPageIndex?: number;
  layoutChunkId?: string;
};

/** Question-side parse quality — structure + provenance; optional LLM parse confidence (not OCR). */
export type QuestionParseQuality = {
  structure: QuestionStructureQuality;
  provenance: QuestionProvenanceQuality;
  /** LLM / extraction confidence — not OCR block confidence. */
  modelParseConfidence?: number;
};
