import type { Question } from "@/types/question";
import type { VisionParseItem } from "@/types/visionParse";

/**
 * Parse-cache lane — encoded in `ParseCacheKeyParts.lane` and hashed into the store key.
 *
 * Phase 32: `text_*_validator` lanes store the **validator LLM** output for a draft chunk.
 * Keys use `buildValidatorContentFingerprint` (chunk + normalized draft question digest)
 * so draft hits never collide with validator entries (DRAFT-32-06).
 */
export type ParseCacheLane =
  | "vision_batch"
  | "text_multi_mcq"
  | "text_single_mcq"
  | "text_multi_mcq_validator"
  | "text_single_mcq_validator";

export type ParseCacheForwardProvider = "openai" | "custom";

/**
 * Key material before canonical hashing. Field order for JSON canonicalization is fixed in
 * `canonicalizeParseCacheKeyParts` (see `parseCacheDb.ts`).
 */
export type ParseCacheKeyParts = {
  lane: ParseCacheLane;
  contentFingerprint: string;
  /** From `formatPromptKeyComponent(bundleVersion, systemPromptDigest)`. */
  promptIdentity: string;
  model: string;
  forwardProvider: ParseCacheForwardProvider;
};

/** Optional metadata — never part of the cache key (D-07). */
export type ParseCacheRecordMeta = {
  savedAt: string;
  lastAccessedAt: string;
  studySetId?: string;
};

export type ParseCacheVisionValue = {
  kind: "vision_batch";
  items: VisionParseItem[];
  meta: ParseCacheRecordMeta;
};

export type ParseCacheTextValue = {
  kind:
    | "text_multi_mcq"
    | "text_single_mcq"
    | "text_multi_mcq_validator"
    | "text_single_mcq_validator";
  items: Question[];
  meta: ParseCacheRecordMeta;
};

export type ParseCacheStoredPayload = ParseCacheVisionValue | ParseCacheTextValue;
