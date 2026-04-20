/**
 * Cosine similarity for dense embedding vectors (Phase 33).
 */

import { pipelineLog } from "@/lib/logging/pipelineLogger";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return -1;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) {
    return -1;
  }
  return dot / denom;
}

export type RankedEmbedding<T extends { vector: number[] }> = T & {
  score: number;
};

/**
 * Higher score = more similar. Filters rows with dimension mismatch (logs once per batch).
 */
export function rankByCosineSimilarity<T extends { vector: number[] }>(
  queryVec: number[],
  rows: T[],
  topK: number,
): RankedEmbedding<T>[] {
  const scored: RankedEmbedding<T>[] = [];
  for (const row of rows) {
    if (row.vector.length !== queryVec.length) {
      pipelineLog("PARSE", "embedding-rank", "warn", "dimension_mismatch", {
        expected: queryVec.length,
        got: row.vector.length,
      });
      continue;
    }
    const score = cosineSimilarity(queryVec, row.vector);
    if (score < 0) {
      continue;
    }
    scored.push({ ...row, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, topK));
}
