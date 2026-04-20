/**
 * Phase 34 — browser-local full-document embedding index jobs.
 *
 * **Execution plane:** runs on the **main thread** (same JS realm as the document).
 * `POST /api/ai/embed` is same-origin and may rely on **Supabase session cookies**; keeping
 * fetch here avoids Web Worker `credentials` / cookie edge cases until explicitly tested.
 */

import { chunkText } from "@/lib/ai/chunkText";
import {
  DEFAULT_EMBEDDING_MODEL,
  embedText,
} from "@/lib/ai/openAiEmbedding";
import {
  EMBEDDING_INDEX_SCHEMA_VERSION,
  type EmbeddingChunkRecord,
  type EmbeddingIndexBuildMetaRecord,
  type EmbeddingIndexJobProgress,
  type EmbeddingIndexJobResult,
} from "@/lib/ai/embeddingIndexTypes";
import {
  embeddingIndexClearStudySet,
  embeddingIndexGetBuildMeta,
  embeddingIndexListByStudySet,
  embeddingIndexPut,
  embeddingIndexPutBuildMeta,
  newEmbeddingChunkId,
} from "@/lib/db/embeddingIndexDb";
import { sha256Utf8Hex } from "@/lib/db/parseCacheDb";
import { pipelineLog } from "@/lib/logging/pipelineLogger";

const MAX_CHUNK_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableEmbeddingError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") {
    return false;
  }
  if (e instanceof TypeError) {
    return true;
  }
  if (e instanceof Error) {
    const m = e.message;
    if (m.includes("Too many requests")) {
      return true;
    }
    if (/502|503|504|network|fetch/i.test(m)) {
      return true;
    }
  }
  return false;
}

async function embedTextWithRetries(params: {
  apiKey: string;
  forwardBaseUrl: string;
  text: string;
  model: string;
  signal?: AbortSignal;
}): Promise<{ vector: number[]; dimensions: number; model: string }> {
  let last: unknown;
  for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
    if (params.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    try {
      return await embedText(params);
    } catch (e) {
      last = e;
      if (!isRetryableEmbeddingError(e) || attempt === MAX_CHUNK_RETRIES - 1) {
        throw e;
      }
      await sleep(300 * 2 ** attempt);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function needsClearForIncompatibleRows(
  studySetId: string,
  resolvedModel: string,
): Promise<boolean> {
  const rows = await embeddingIndexListByStudySet(studySetId);
  if (rows.length === 0) {
    return false;
  }
  return rows.some(
    (r) =>
      r.embeddingModel !== resolvedModel ||
      r.indexVersion !== EMBEDDING_INDEX_SCHEMA_VERSION,
  );
}

export async function runEmbeddingIndexJob(options: {
  studySetId: string;
  fullText: string;
  apiKey: string;
  forwardBaseUrl: string;
  embeddingModel?: string;
  signal?: AbortSignal;
  /** Default 2 — bounded parallel embed calls. */
  concurrency?: number;
  onProgress?: (p: EmbeddingIndexJobProgress) => void;
}): Promise<EmbeddingIndexJobResult> {
  const {
    studySetId,
    fullText,
    apiKey,
    forwardBaseUrl,
    embeddingModel,
    signal,
    onProgress,
  } = options;
  const concurrency = Math.max(1, options.concurrency ?? 2);

  const modelResolved =
    (embeddingModel ?? DEFAULT_EMBEDDING_MODEL).trim() || DEFAULT_EMBEDDING_MODEL;
  const trimmed = fullText.trim();

  if (trimmed.length === 0) {
    return { chunksIndexed: 0, error: "No text to index." };
  }

  const chunks = chunkText(trimmed);
  if (chunks.length === 0) {
    return { chunksIndexed: 0, error: "No chunks produced." };
  }

  const textSha = await sha256Utf8Hex(trimmed);

  if (await needsClearForIncompatibleRows(studySetId, modelResolved)) {
    await embeddingIndexClearStudySet(studySetId);
    pipelineLog("PARSE", "embedding-rank", "info", "index_job_invalidate", {
      studySetId,
      reason: "model_or_schema_mismatch",
    });
  }

  const meta = await embeddingIndexGetBuildMeta(studySetId);
  const existingRows = await embeddingIndexListByStudySet(studySetId);

  if (
    meta &&
    meta.sourceTextSha256 === textSha &&
    meta.embeddingModel === modelResolved &&
    meta.indexVersion === EMBEDDING_INDEX_SCHEMA_VERSION &&
    meta.chunkCount === chunks.length &&
    existingRows.length === chunks.length &&
    chunks.length > 0
  ) {
    pipelineLog("PARSE", "embedding-rank", "info", "index_job_skip_fresh", {
      studySetId,
      chunkCount: chunks.length,
    });
    return { chunksIndexed: chunks.length };
  }

  if (signal?.aborted) {
    return { chunksIndexed: 0, cancelled: true };
  }

  await embeddingIndexClearStudySet(studySetId);

  pipelineLog("PARSE", "embedding-rank", "info", "index_job_start", {
    studySetId,
    chunkCount: chunks.length,
    concurrency,
  });

  const total = chunks.length;
  let completed = 0;
  let lastError: string | undefined;
  let aborted = false;

  const runOne = async (i: number): Promise<void> => {
    if (signal?.aborted) {
      aborted = true;
      throw new DOMException("Aborted", "AbortError");
    }
    const piece = chunks[i]!;
    const { vector, dimensions, model } = await embedTextWithRetries({
      apiKey,
      forwardBaseUrl,
      text: piece,
      model: modelResolved,
      signal,
    });
    const contentHash = await sha256Utf8Hex(piece);
    const now = new Date().toISOString();
    const row: EmbeddingChunkRecord = {
      id: newEmbeddingChunkId(),
      studySetId,
      text: piece,
      vector,
      contentHash,
      embeddingModel: model,
      dimensions,
      indexVersion: EMBEDDING_INDEX_SCHEMA_VERSION,
      createdAt: now,
      lastAccessedAt: now,
      sourceLabel: `chunk ${i + 1}/${total}`,
    };
    await embeddingIndexPut(row);
    completed += 1;
    onProgress?.({ phase: "indexing", current: completed, total });
    pipelineLog("PARSE", "embedding-rank", "info", "index_job_chunk", {
      studySetId,
      current: completed,
      total,
    });
  };

  let nextIndex = 0;
  let failure: Error | null = null;

  async function worker(): Promise<void> {
    while (nextIndex < total && !failure) {
      if (signal?.aborted) {
        aborted = true;
        failure = new DOMException("Aborted", "AbortError");
        return;
      }
      const i = nextIndex;
      nextIndex += 1;
      try {
        await runOne(i);
      } catch (e) {
        failure = e instanceof Error ? e : new Error(String(e));
        if (e instanceof DOMException && e.name === "AbortError") {
          aborted = true;
        }
        return;
      }
    }
  }

  const poolSize = Math.min(concurrency, total);
  onProgress?.({ phase: "indexing", current: 0, total });

  try {
    await Promise.all(Array.from({ length: poolSize }, () => worker()));
  } catch (e) {
    failure = e instanceof Error ? e : new Error(String(e));
  }

  if (failure) {
    lastError = failure.message;
  }

  if (aborted || signal?.aborted) {
    pipelineLog("PARSE", "embedding-rank", "info", "index_job_aborted", {
      studySetId,
      chunksIndexed: completed,
    });
    return {
      chunksIndexed: completed,
      cancelled: true,
      error: lastError,
    };
  }

  if (failure && completed < total) {
    pipelineLog("PARSE", "embedding-rank", "warn", "index_job_failed", {
      studySetId,
      chunksIndexed: completed,
      message: lastError,
    });
    return { chunksIndexed: completed, error: lastError };
  }

  const nowIso = new Date().toISOString();
  const buildMeta: EmbeddingIndexBuildMetaRecord = {
    studySetId,
    sourceTextSha256: textSha,
    embeddingModel: modelResolved,
    indexVersion: EMBEDDING_INDEX_SCHEMA_VERSION,
    chunkCount: total,
    updatedAt: nowIso,
  };
  await embeddingIndexPutBuildMeta(buildMeta);

  pipelineLog("PARSE", "embedding-rank", "info", "index_job_done", {
    studySetId,
    chunksIndexed: completed,
  });

  return { chunksIndexed: completed };
}
