import type {
  ParseOutputMode,
  VisionBatchPerRow,
  VisionParseBenchmark,
} from "@/types/visionParse";

const BATCH_SIZE = 10;
const OVERLAP = 2;

export type VisionBenchmarkAccumulator = {
  recordBatch: (row: Omit<VisionBatchPerRow, "batchIndex"> & { batchIndex: number }) => void;
  finalize: (params: {
    mode: ParseOutputMode;
    totalPages: number;
    totalItems: number;
    totalLatencyMs: number;
    confidenceSummary: VisionParseBenchmark["confidenceSummary"];
    batchSize?: number;
    overlap?: number;
  }) => VisionParseBenchmark;
};

export function createVisionBenchmarkAccumulator(): VisionBenchmarkAccumulator {
  const perBatch: VisionBatchPerRow[] = [];
  let cacheHits = 0;
  let cacheMisses = 0;

  return {
    recordBatch(row) {
      perBatch.push({
        batchIndex: row.batchIndex,
        startPage: row.startPage,
        endPage: row.endPage,
        itemCount: row.itemCount,
        latencyMs: row.latencyMs,
        estimatedTokens: row.estimatedTokens,
        cacheHit: row.cacheHit,
      });
      if (row.cacheHit) {
        cacheHits += 1;
      } else {
        cacheMisses += 1;
      }
    },
    finalize({
      mode,
      totalPages,
      totalItems,
      totalLatencyMs,
      confidenceSummary,
      batchSize: batchSizeParam,
      overlap: overlapParam,
    }: {
      mode: ParseOutputMode;
      totalPages: number;
      totalItems: number;
      totalLatencyMs: number;
      confidenceSummary: VisionParseBenchmark["confidenceSummary"];
      /** Reported batch window (defaults to legacy 10/2 for backward compat). */
      batchSize?: number;
      overlap?: number;
    }) {
      const totalBatches = perBatch.length;
      const estimatedTotalTokens = perBatch.reduce(
        (a, r) => a + r.estimatedTokens,
        0,
      );
      const naiveBaselineRequests =
        totalPages <= 1 ? 0 : Math.max(0, totalPages - 1);
      const actualRequests = totalBatches;
      const requestReductionRatio =
        naiveBaselineRequests > 0 && actualRequests > 0
          ? naiveBaselineRequests / actualRequests
          : 1;

      const batchSize = batchSizeParam ?? BATCH_SIZE;
      const overlap = overlapParam ?? OVERLAP;

      return {
        mode,
        totalPages,
        batchSize,
        overlap,
        totalBatches,
        totalItems,
        totalLatencyMs,
        estimatedTotalTokens,
        averageBatchTokens:
          totalBatches > 0 ? estimatedTotalTokens / totalBatches : 0,
        cacheHits,
        cacheMisses,
        naiveBaselineRequests,
        actualRequests,
        requestReductionRatio,
        perBatch,
        confidenceSummary,
      };
    },
  };
}

export function summarizeConfidenceBuckets(items: {
  confidence: number;
}[]): VisionParseBenchmark["confidenceSummary"] {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const it of items) {
    if (it.confidence >= 0.75) {
      high += 1;
    } else if (it.confidence >= 0.45) {
      medium += 1;
    } else {
      low += 1;
    }
  }
  return { high, medium, low };
}

/** Human-readable benchmark block (tokens are estimates unless wired to usage API). */
export function formatVisionBenchmarkReport(b: VisionParseBenchmark): string {
  const lines = [
    "vision parse benchmark",
    "──────────────────────────────────────────────────",
    `  Mode:            ${b.mode}`,
    `  PDF pages:       ${b.totalPages}`,
    `  Batch strategy:  ${b.batchSize} pages with ${b.overlap}-page overlap`,
    `  Total batches:   ${b.totalBatches}`,
    "",
    `  Corpus:          ${b.totalPages} rendered pages`,
    `  Total items:     ${b.totalItems}`,
    `  Cache hits:      ${b.cacheHits}/${b.totalBatches}`,
    `  Total latency:   ${(b.totalLatencyMs / 1000).toFixed(2)}s`,
    `  Total tokens:    ~${Math.round(b.estimatedTotalTokens)} (estimated)`,
    `  Avg batch cost:  ~${Math.round(b.averageBatchTokens)} tokens (estimated)`,
    "",
    `  Naive baseline:  ${b.naiveBaselineRequests} pair-parse requests`,
    `  Current design:  ${b.actualRequests} batch requests`,
    `  Request reduction: ${b.requestReductionRatio.toFixed(1)}x vs pair baseline`,
    "",
    "  Per batch:",
    ...b.perBatch.map(
      (r) =>
        `    [batch ${r.batchIndex + 1}] pages ${r.startPage}-${r.endPage} | items ${r.itemCount} | ~${Math.round(r.estimatedTokens)} tok | ${(r.latencyMs / 1000).toFixed(2)}s | ${r.cacheHit ? "cache hit" : "cache miss"}`,
    ),
    "",
    "  Output quality:",
    `    High confidence:   ${b.confidenceSummary.high}`,
    `    Review suggested:  ${b.confidenceSummary.medium}`,
    `    Low:               ${b.confidenceSummary.low}`,
  ];
  return lines.join("\n");
}
