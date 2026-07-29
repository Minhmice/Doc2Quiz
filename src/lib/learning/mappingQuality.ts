import type { Question } from "@/types/question";

export const UNCERTAIN_MAPPING_CONFIDENCE_THRESHOLD = 0.45;

export type MappingQualityTier = "mapped" | "uncertain" | "unresolved";

export function isUnresolvedMapping(_q: Question): boolean {
  return false;
}

export function isBlanketSinglePageVision(_q: Question): boolean {
  return false;
}

export function isUncertainPageMapping(_q: Question): boolean {
  return false;
}

export function countUncertainMappings(_questions: Question[]): number {
  return 0;
}

export function getMappingQualityTier(_q: Question): MappingQualityTier {
  return "mapped";
}

export function buildMappingQualityTooltip(_q: Question): string {
  return "Page mapping";
}

export function appendUncertainMappingSummaryClause(
  baseSummary: string,
  _questions: Question[],
): { summary: string; uncertainCount: number } {
  return { summary: baseSummary, uncertainCount: 0 };
}
