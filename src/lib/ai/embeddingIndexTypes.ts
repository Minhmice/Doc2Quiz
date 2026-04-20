/**
 * Phase 33 — browser-local embedding index metadata (vectors stored in IDB).
 */

/** Bump when on-disk shape or semantic contract changes (RAG-33-03). */
export const EMBEDDING_INDEX_SCHEMA_VERSION = 1;

export type EmbeddingChunkRecord = {
  id: string;
  studySetId: string;
  /** Original chunk text (for display / injection). */
  text: string;
  /** L2-normalized optional — store raw from API. */
  vector: number[];
  contentHash: string;
  embeddingModel: string;
  dimensions: number;
  indexVersion: number;
  createdAt: string;
  lastAccessedAt: string;
  /** Optional label, e.g. "chunk 3/40". */
  sourceLabel?: string;
};

/** Phase 34 — one row per study set for idempotency / fast skip (IndexedDB `buildMeta` store). */
export type EmbeddingIndexBuildMetaRecord = {
  studySetId: string;
  /** `sha256Utf8Hex` of trimmed full document text. */
  sourceTextSha256: string;
  embeddingModel: string;
  /** Copy of `EMBEDDING_INDEX_SCHEMA_VERSION` at build time. */
  indexVersion: number;
  chunkCount: number;
  updatedAt: string;
};

/** Phase 34 — progress from `runEmbeddingIndexJob`. */
export type EmbeddingIndexJobProgress = {
  phase: "indexing";
  current: number;
  total: number;
};

export type EmbeddingIndexJobResult = {
  chunksIndexed: number;
  cancelled?: boolean;
  error?: string;
};
