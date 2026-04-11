import type { Question } from "@/types/question";

/** Below this confidence (when set), page mapping is treated as uncertain for UI / summaries. */
export const UNCERTAIN_MAPPING_CONFIDENCE_THRESHOLD = 0.45;

export function isUnresolvedMapping(q: Question): boolean {
  return q.mappingMethod === "unresolved";
}

/** Full-doc single-page vision: weak provenance for multi-page exams — show as Uncertain tier. */
export function isBlanketSinglePageVision(q: Question): boolean {
  return q.mappingMethod === "vision_single_page";
}

export function isUncertainPageMapping(q: Question): boolean {
  if (isUnresolvedMapping(q)) {
    return true;
  }
  if (isBlanketSinglePageVision(q)) {
    return true;
  }
  if (
    q.mappingConfidence !== undefined &&
    q.mappingConfidence < UNCERTAIN_MAPPING_CONFIDENCE_THRESHOLD
  ) {
    return true;
  }
  return false;
}

export function countUncertainMappings(questions: Question[]): number {
  let n = 0;
  for (const q of questions) {
    if (isUncertainPageMapping(q)) {
      n += 1;
    }
  }
  return n;
}

export type MappingQualityTier = "mapped" | "uncertain" | "unresolved";

/** Badge tier for review / preview (UI-SPEC): unresolved → uncertain → mapped. */
export function getMappingQualityTier(q: Question): MappingQualityTier {
  if (isUnresolvedMapping(q)) {
    return "unresolved";
  }
  if (isBlanketSinglePageVision(q)) {
    return "uncertain";
  }
  if (
    q.mappingConfidence !== undefined &&
    q.mappingConfidence < UNCERTAIN_MAPPING_CONFIDENCE_THRESHOLD
  ) {
    return "uncertain";
  }
  if (q.mappingMethod && q.mappingMethod !== "unresolved") {
    return "mapped";
  }
  return "uncertain";
}

const TOOLTIP_REASON_MAX = 160;

export function buildMappingQualityTooltip(q: Question): string {
  const parts: string[] = [];
  if (q.mappingReason?.trim()) {
    const r = q.mappingReason.trim();
    parts.push(
      r.length > TOOLTIP_REASON_MAX
        ? `${r.slice(0, TOOLTIP_REASON_MAX - 1)}…`
        : r,
    );
  }
  if (q.mappingConfidence !== undefined) {
    parts.push(`Confidence: ${q.mappingConfidence}`);
  }
  if (q.sourcePageIndex !== undefined) {
    parts.push(`Source page: ${q.sourcePageIndex}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Page mapping";
}

/** Append uncertain-mapping clause after a successful parse summary sentence. */
export function appendUncertainMappingSummaryClause(
  baseSummary: string,
  questions: Question[],
): { summary: string; uncertainCount: number } {
  const uncertainCount = countUncertainMappings(questions);
  if (uncertainCount <= 0) {
    return { summary: baseSummary, uncertainCount: 0 };
  }
  const trimmed = baseSummary.replace(/\s*\.\s*$/, "");
  const extra = ` · ${uncertainCount} question${uncertainCount === 1 ? "" : "s"} with uncertain page mapping — check Review.`;
  return {
    summary: `${trimmed}.${extra}`,
    uncertainCount,
  };
}

/** Re-exports: full parseScore dimensions (`docs/PARSE-SCORE-contract.md`) — badge tier logic above is unchanged. */
export {
  buildParseScoreReviewDto,
  emptyParseRetryHistory,
  ocrPageQualityFromOcrPageResult,
  ocrRunQualityFromOcrRunResult,
  parseRetryHistoryFromProgress,
  questionParseQualityFromQuestion,
} from "./deriveParseScores";
export type { ParseScoreReviewDto } from "./deriveParseScores";
