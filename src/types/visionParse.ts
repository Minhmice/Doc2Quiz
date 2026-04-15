/**
 * Vision-first MVP parse types (Phase 21).
 * Quiz vs flashcard are explicit — do not infer from URL alone downstream.
 */

/**
 * Parse output mode — determines which schema to generate and validate.
 *
 * - `"quiz"`: MCQ question extraction (`question`, `options`, `correctIndex`).
 * - `"flashcard"`: theory/concept extraction (`front`, `back`).
 *
 * Modes are mutually exclusive and must not be mixed.
 */
export type ParseOutputMode = "quiz" | "flashcard";

/**
 * Canonical mapping from `StudySetMeta.contentKind` to parse mode.
 *
 * - `"quiz"` -> `"quiz"`
 * - `"flashcards"` -> `"flashcard"`
 */
export function parseOutputModeFromContentKind(
  kind: "quiz" | "flashcards" | undefined,
): ParseOutputMode {
  if (kind === "flashcards") {
    return "flashcard";
  }
  return "quiz";
}

export type PageBatchMeta = {
  batchIndex: number;
  /** Inclusive 1-based page index (first page in batch). */
  startPage: number;
  /** Inclusive 1-based page index (last page in batch). */
  endPage: number;
  /** 1-based indexes in PDF order. */
  pageIndexes: readonly number[];
};

/**
 * Quiz item emitted by the vision parse engine.
 * Strict MCQ shape for the Quiz lane only.
 */
export type QuizVisionItem = {
  /** Discriminant for strict lane routing. */
  kind: "quiz";
  question: string;
  /** Exactly four answer choices [A, B, C, D]. */
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  confidence: number;
  sourcePages?: number[];
  /**
   * When false, do not attach a full-page snapshot for this question (plain-text MCQ).
   * Omitted or true: allow page image attach when the product preference is on.
   */
  includePageImage?: boolean;
};

/**
 * Flashcard item emitted by the vision parse engine.
 * Theory/concept shape for the Flashcard lane only.
 */
export type FlashcardVisionItem = {
  /** Discriminant for strict lane routing. */
  kind: "flashcard";
  /** Stable id for review list / IDB round-trip */
  id?: string;
  front: string;
  back: string;
  confidence: number;
  sourcePages?: number[];
};

/**
 * Approved flashcard deck in IndexedDB — **not** `ApprovedBank` / `Question[]`.
 * Replaces the legacy “MCQ carrier” encoding for flashcard-only study sets.
 */
export type ApprovedFlashcardBank = {
  version: 1;
  savedAt: string;
  items: FlashcardVisionItem[];
};

export type VisionParseItem = QuizVisionItem | FlashcardVisionItem;

export type VisionBatchPerRow = {
  batchIndex: number;
  startPage: number;
  endPage: number;
  itemCount: number;
  latencyMs: number;
  estimatedTokens: number;
  cacheHit: boolean;
};

export type VisionParseBenchmark = {
  mode: ParseOutputMode;
  totalPages: number;
  batchSize: number;
  overlap: number;
  totalBatches: number;
  totalItems: number;
  totalLatencyMs: number;
  /** Sum of per-batch estimates; labeled approximate in formatter. */
  estimatedTotalTokens: number;
  averageBatchTokens: number;
  cacheHits: number;
  cacheMisses: number;
  /** Legacy pair strategy: (totalPages - 1) requests when totalPages >= 2. */
  naiveBaselineRequests: number;
  actualRequests: number;
  requestReductionRatio: number;
  perBatch: VisionBatchPerRow[];
  confidenceSummary: {
    high: number;
    medium: number;
    low: number;
  };
};

export type VisionPipelineStage =
  | "parse_start"
  | "render_pages_start"
  | "render_pages_done"
  | "batch_start"
  | "batch_cache_hit"
  | "batch_staging_complete"
  | "batch_request_start"
  | "batch_request_done"
  | "batch_parse_success"
  | "batch_parse_error"
  | "batch_stream_append"
  | "dedupe_start"
  | "dedupe_done"
  | "persist_start"
  | "persist_done"
  | "parse_done"
  | "benchmark_ready";

export type VisionPipelineEvent = {
  stage: VisionPipelineStage;
  mode?: ParseOutputMode;
  batchIndex?: number;
  startPage?: number;
  endPage?: number;
  attempt?: number;
  latencyMs?: number;
  itemCount?: number;
  cacheHit?: boolean;
  model?: string;
  message?: string;
  error?: string;
};
