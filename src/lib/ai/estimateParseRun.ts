/**
 * Phase 17 — deterministic **upper-bound** estimates for BYOK parse (calls, tokens, rough duration).
 * Aligns vision **step counts** with `runVisionSequential` (attach / single page / pair mode).
 * Uses `decideParseRoute` for Fast/Hybrid vs Accurate vs OCR-off (Phase 12).
 *
 * When `pageCount` is null or ≤ 0, `cappedPages` uses **1** as a pessimistic numeric base
 * (documented contract — UI should prefer real `pageCount` from study set meta).
 * When `pageCount` is known and > 0, `cappedPages` is `min(max(pageCount, 1), VISION_MAX_PAGES_DEFAULT)`.
 *
 * Hybrid uses the same execution-family counts as Fast when OCR details are not in this pure input.
 */
import { decideParseRoute } from "@/lib/ai/parseRoutePolicy";
import type { ParseStrategy } from "@/lib/ai/parseLocalStorage";
import { VISION_MAX_PAGES_DEFAULT } from "@/lib/pdf/renderPagesToImages";

/** Rough wall-time for pdf.js render pass once per run (ms). */
export const HEURISTIC_MS_RENDER_ONCE = 2000;
/** Per vision API step (ms) — order-of-magnitude only. */
export const HEURISTIC_MS_PER_VISION_STEP = 8000;
/** Upper bound per chunk parse API call (ms). */
export const HEURISTIC_MS_PER_CHUNK_UPPER = 4000;

/** Rough input tokens per vision step (image + prompt context). */
export const HEURISTIC_VISION_INPUT_TOKENS_PER_STEP = 3500;
/** Rough max output tokens per vision step. */
export const HEURISTIC_VISION_OUTPUT_TOKENS_PER_STEP = 900;
/** Rough input tokens upper bound per chunk parse call. */
export const HEURISTIC_CHUNK_INPUT_TOKENS_UPPER = 8000;
/** Rough output tokens upper bound per chunk parse call. */
export const HEURISTIC_CHUNK_OUTPUT_TOKENS_UPPER = 1200;

export const PARSE_RUN_ESTIMATE_DISCLAIMER =
  "Estimates are not billing guarantees; actual tokens depend on your model and PDF content.";

export type ParseRunEstimateInput = {
  pageCount: number | null;
  extractedTextCharCount: number;
  parseStrategy: ParseStrategy;
  enableOcr: boolean;
  attachPageImage: boolean;
};

export type ParseRunEstimate = {
  cappedPages: number;
  visionApiCalls: number;
  chunkParseApiCallsUpperBound: number;
  visionFallbackApiCallsUpperBound: number;
  estimatedVisionInputTokensUpper: number;
  estimatedVisionOutputTokensUpper: number;
  estimatedChunkInputTokensUpper: number;
  estimatedChunkOutputTokensUpper: number;
  estimatedDurationSecondsMin: number;
  estimatedDurationSecondsMax: number;
  disclaimer: typeof PARSE_RUN_ESTIMATE_DISCLAIMER;
};

function cappedPageCount(pageCount: number | null): number {
  if (pageCount == null || pageCount <= 0) {
    return 1;
  }
  return Math.min(pageCount, VISION_MAX_PAGES_DEFAULT);
}

/**
 * Vision steps for a **full** vision-only run over `pages` pages (after cap), matching
 * `runVisionSequential`: attach → `pages`; one page → 1; else `pages - 1` pairs.
 */
export function visionStepsFullRun(
  attachPageImage: boolean,
  pages: number,
): number {
  if (pages <= 0) {
    return 0;
  }
  if (attachPageImage) {
    return pages;
  }
  if (pages === 1) {
    return 1;
  }
  return pages - 1;
}

function msToSecondsCeil(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

export function estimateParseRun(
  input: ParseRunEstimateInput,
): ParseRunEstimate {
  const {
    pageCount,
    extractedTextCharCount,
    parseStrategy,
    enableOcr,
    attachPageImage,
  } = input;

  const cappedPages = cappedPageCount(pageCount);
  const route = decideParseRoute({
    pageCount,
    extractedTextCharCount,
    parseStrategy,
    enableOcr,
  });

  const fullVisionSteps = visionStepsFullRun(attachPageImage, cappedPages);

  let visionApiCalls = 0;
  let chunkParseApiCallsUpperBound = 0;
  let visionFallbackApiCallsUpperBound = 0;

  const isLayoutFirst =
    (parseStrategy === "fast" || parseStrategy === "hybrid") &&
    enableOcr &&
    route.executionFamily === "layout_chunk";

  if (parseStrategy === "accurate" || !enableOcr) {
    visionApiCalls = fullVisionSteps;
    chunkParseApiCallsUpperBound = 0;
    visionFallbackApiCallsUpperBound = 0;
  } else if (isLayoutFirst) {
    visionApiCalls = 0;
    chunkParseApiCallsUpperBound = Math.min(cappedPages, 60);
    visionFallbackApiCallsUpperBound = fullVisionSteps;
  } else {
    visionApiCalls = fullVisionSteps;
    chunkParseApiCallsUpperBound = 0;
    visionFallbackApiCallsUpperBound = 0;
  }

  const totalVisionSteps = visionApiCalls + visionFallbackApiCallsUpperBound;

  const estimatedVisionInputTokensUpper =
    totalVisionSteps * HEURISTIC_VISION_INPUT_TOKENS_PER_STEP;
  const estimatedVisionOutputTokensUpper =
    totalVisionSteps * HEURISTIC_VISION_OUTPUT_TOKENS_PER_STEP;
  const estimatedChunkInputTokensUpper =
    chunkParseApiCallsUpperBound * HEURISTIC_CHUNK_INPUT_TOKENS_UPPER;
  const estimatedChunkOutputTokensUpper =
    chunkParseApiCallsUpperBound * HEURISTIC_CHUNK_OUTPUT_TOKENS_UPPER;

  const chunkMs =
    chunkParseApiCallsUpperBound * HEURISTIC_MS_PER_CHUNK_UPPER;
  const primaryVisionMs = visionApiCalls * HEURISTIC_MS_PER_VISION_STEP;
  const fallbackVisionMs =
    visionFallbackApiCallsUpperBound * HEURISTIC_MS_PER_VISION_STEP;

  const msMin =
    HEURISTIC_MS_RENDER_ONCE + primaryVisionMs + chunkMs;
  const msMax =
    HEURISTIC_MS_RENDER_ONCE +
    primaryVisionMs +
    chunkMs +
    fallbackVisionMs;

  return {
    cappedPages,
    visionApiCalls,
    chunkParseApiCallsUpperBound,
    visionFallbackApiCallsUpperBound,
    estimatedVisionInputTokensUpper,
    estimatedVisionOutputTokensUpper,
    estimatedChunkInputTokensUpper,
    estimatedChunkOutputTokensUpper,
    estimatedDurationSecondsMin: msToSecondsCeil(msMin * 0.75),
    estimatedDurationSecondsMax: msToSecondsCeil(msMax * 1.15),
    disclaimer: PARSE_RUN_ESTIMATE_DISCLAIMER,
  };
}
