import type {
  CanonicalSourceUnit,
  GenerationCoverageReport,
} from "@/types/canonicalSource";

const LOW_ITEM_CONFIDENCE = 0.6;

export function computeGenerationCoverage(input: {
  units: CanonicalSourceUnit[];
  /** Per-item list of canonical unit ids cited (after validation). */
  itemsSourceUnitIds: string[][];
  /** Per-item confidence 0..1 */
  itemConfidences: number[];
}): GenerationCoverageReport {
  const unitIds = new Set(input.units.map((u) => u.id));
  const referenced = new Set<string>();
  for (const ids of input.itemsSourceUnitIds) {
    for (const id of ids) {
      if (unitIds.has(id)) {
        referenced.add(id);
      }
    }
  }

  const unusedUnitIds = input.units.map((u) => u.id).filter((id) => !referenced.has(id));
  const totalUnits = input.units.length;
  const usedUnits = referenced.size;
  const coverageRatio = totalUnits > 0 ? usedUnits / totalUnits : 0;

  const lowConfidenceCount = input.itemConfidences.filter(
    (c) => c < LOW_ITEM_CONFIDENCE,
  ).length;

  return {
    totalUnits,
    usedUnits,
    coverageRatio,
    unusedUnitIds,
    lowConfidenceCount,
  };
}

export function coverageWarnings(report: GenerationCoverageReport): string[] {
  const w: string[] = [];
  if (report.totalUnits > 0 && report.coverageRatio < 0.25) {
    w.push("Low coverage: many canonical units were not used in generated items.");
  }
  if (report.totalUnits > 0 && report.coverageRatio < 0.5) {
    w.push("Coverage below half of canonical units — review suggested.");
  }
  return w;
}
