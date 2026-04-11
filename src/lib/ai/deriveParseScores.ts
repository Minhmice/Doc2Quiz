/**
 * Deterministic **parseScore** derivations — see `docs/PARSE-SCORE-contract.md`.
 *
 * Badge tiers in `mappingQuality.ts` remain the compact UX; use this module for full
 * `parseScore` dimensions (OCR vs question kept separate).
 */

import type { OcrBlock, OcrPageResult, OcrRunResult } from "@/types/ocr";
import {
  PARSE_SCORE_SCHEMA_VERSION,
  type OcrPageQuality,
  type OcrRunQuality,
  type ParseRetryHistory,
  type QuestionParseQuality,
} from "@/types/parseScore";
import type { Question } from "@/types/question";
import type { ParseProgressRecord } from "@/types/studySet";

function rollupBlockConfidences(blocks: readonly OcrBlock[]): {
  min?: number;
  max?: number;
  mean?: number;
} {
  const vals = blocks
    .map((b) => b.confidence)
    .filter((c): c is number => typeof c === "number" && Number.isFinite(c));
  if (vals.length === 0) {
    return {};
  }
  let min = vals[0]!;
  let max = vals[0]!;
  let sum = 0;
  for (const v of vals) {
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += v;
  }
  return { min, max, mean: sum / vals.length };
}

/**
 * Default `status` when `page.status` is missing:
 * - `"partial"` if there are no blocks
 * - `"success"` otherwise (legacy v1 pages often omit `status` when text exists)
 */
export function ocrPageQualityFromOcrPageResult(page: OcrPageResult): OcrPageQuality {
  const blockCount = page.blocks?.length ?? 0;
  const roll = rollupBlockConfidences(page.blocks ?? []);
  const status =
    page.status ??
    (blockCount === 0 ? ("partial" as const) : ("success" as const));

  const rv = page.regionVerification;
  return {
    pageIndex: page.pageIndex,
    status,
    blockCount,
    blockConfidenceMin: roll.min,
    blockConfidenceMax: roll.max,
    blockConfidenceMean: roll.mean,
    invalidBlockCount: page.invalidBlockCount,
    regionCropReadyCount: rv?.cropReadyBlockCount,
    regionPageUsableForCrop: rv?.pageUsableForCrop,
  };
}

export function ocrRunQualityFromOcrRunResult(run: OcrRunResult): OcrRunQuality {
  return {
    schemaVersion: PARSE_SCORE_SCHEMA_VERSION,
    pages: run.pages.map(ocrPageQualityFromOcrPageResult),
    stats: run.stats,
  };
}

function structureFromQuestion(q: Question): QuestionParseQuality["structure"] {
  const opts = q.options;
  const hasFourOptions = Array.isArray(opts) && opts.length === 4;
  const correctIndexInRange =
    typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex <= 3;
  return {
    parseStructureValid: q.parseStructureValid,
    hasFourOptions: hasFourOptions ? true : undefined,
    correctIndexInRange: hasFourOptions ? correctIndexInRange : undefined,
  };
}

function provenanceFromQuestion(q: Question): QuestionParseQuality["provenance"] {
  return {
    mappingMethod: q.mappingMethod,
    mappingConfidence: q.mappingConfidence,
    mappingReason: q.mappingReason,
    verifiedRegionAvailable: q.verifiedRegionAvailable,
    sourcePageIndex: q.sourcePageIndex,
    ocrPageIndex: q.ocrPageIndex,
    layoutChunkId: q.layoutChunkId,
  };
}

export function questionParseQualityFromQuestion(q: Question): QuestionParseQuality {
  return {
    structure: structureFromQuestion(q),
    provenance: provenanceFromQuestion(q),
    modelParseConfidence: q.parseConfidence,
  };
}

export function emptyParseRetryHistory(): ParseRetryHistory {
  return { events: [] };
}

/**
 * Placeholder: `ParseProgressRecord` only stores the **latest** phase — no append-only log yet.
 * Always returns empty `events` until Phase 19+ persists retry streams.
 */
export function parseRetryHistoryFromProgress(
  record: ParseProgressRecord,
): ParseRetryHistory {
  void record;
  return emptyParseRetryHistory();
}

export type ParseScoreReviewDto = {
  questionParseQuality: QuestionParseQuality;
  retryHistory: ParseRetryHistory;
  ocrPageQuality?: OcrPageQuality;
};

export function buildParseScoreReviewDto(
  q: Question,
  ctx?: { ocrPage?: OcrPageResult },
): ParseScoreReviewDto {
  return {
    questionParseQuality: questionParseQualityFromQuestion(q),
    retryHistory: emptyParseRetryHistory(),
    ocrPageQuality: ctx?.ocrPage
      ? ocrPageQualityFromOcrPageResult(ctx.ocrPage)
      : undefined,
  };
}
