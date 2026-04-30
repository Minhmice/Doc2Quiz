import { sha256Utf8HexSync } from "@/lib/server/sha256Hex";
import type { StudyContentKind } from "@/types/studySet";

/**
 * Stable cache key for persisted generation output (per user row).
 * Aligns with: content_sha256 + contentKind + generation_schema_version +
 * model_fingerprint + targetItemCount (tier is implied by model fingerprint).
 */
export function computeGenerationOutputCacheKey(input: {
  contentSha256: string;
  contentKind: StudyContentKind;
  generationSchemaVersion: number;
  modelFingerprint: string;
  targetItemCount: number;
}): string {
  return sha256Utf8HexSync(
    [
      input.contentSha256,
      input.contentKind,
      String(input.generationSchemaVersion),
      input.modelFingerprint,
      String(input.targetItemCount),
    ].join("|"),
  );
}
