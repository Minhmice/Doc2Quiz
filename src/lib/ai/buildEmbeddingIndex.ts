/**
 * Phase 33 — embed document chunks and semantic search (browser-local IDB).
 *
 * **Chunk unit:** `chunkText()` from extracted plain text (same as MCQ sequential parse).
 */

import {
  EMBEDDING_INDEX_MODEL_KEY,
  embedText,
} from "@/lib/ai/openAiEmbedding";
import { runEmbeddingIndexJob } from "@/lib/ai/embeddingIndexJob";
import { EMBEDDING_INDEX_SCHEMA_VERSION } from "@/lib/ai/embeddingIndexTypes";
import { rankByCosineSimilarity } from "@/lib/ai/cosineSimilarity";
import {
  embeddingIndexListByStudySet,
  embeddingIndexTouch,
} from "@/lib/db/embeddingIndexDb";

export {
  DEFAULT_EMBEDDING_MODEL,
  embedText,
  parseOpenAiEmbeddingResponse,
} from "@/lib/ai/openAiEmbedding";

export type BuildEmbeddingIndexResult = {
  chunksIndexed: number;
  error?: string;
};

/**
 * Rebuilds the entire embedding index for a study set from plain extracted text.
 * Delegates to {@link runEmbeddingIndexJob} (Phase 34 async queue).
 */
export async function buildEmbeddingIndexFromPlainText(options: {
  studySetId: string;
  fullText: string;
  signal?: AbortSignal;
}): Promise<BuildEmbeddingIndexResult> {
  const r = await runEmbeddingIndexJob({
    ...options,
    concurrency: 2,
  });
  return {
    chunksIndexed: r.chunksIndexed,
    error: r.error,
  };
}

export type SearchHit = {
  id: string;
  text: string;
  score: number;
  sourceLabel?: string;
};

export async function searchSimilarChunks(options: {
  studySetId: string;
  query: string;
  topK?: number;
  signal?: AbortSignal;
}): Promise<SearchHit[]> {
  const { studySetId, query, signal } = options;
  const topK = options.topK ?? 8;
  const q = query.trim();
  if (q.length === 0) {
    return [];
  }

  const rows = await embeddingIndexListByStudySet(studySetId);
  if (rows.length === 0) {
    return [];
  }

  const model = EMBEDDING_INDEX_MODEL_KEY;
  const compatible = rows.filter(
    (r) =>
      r.embeddingModel === model &&
      r.indexVersion === EMBEDDING_INDEX_SCHEMA_VERSION,
  );
  if (compatible.length === 0) {
    return [];
  }

  const { vector: queryVec } = await embedText({
    text: q,
    signal,
  });

  const ranked = rankByCosineSimilarity(queryVec, compatible, topK);
  const out: SearchHit[] = [];
  for (const r of ranked) {
    await embeddingIndexTouch(r.id);
    out.push({
      id: r.id,
      text: r.text,
      score: r.score,
      sourceLabel: r.sourceLabel,
    });
  }
  return out;
}
