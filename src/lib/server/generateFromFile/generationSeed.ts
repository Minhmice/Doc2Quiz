import { EXTRACTION_SCHEMA_VERSION } from "@/lib/server/generateFromFile/canonicalConstants";
import { sha256Utf8HexSync } from "@/lib/server/sha256Hex";

/** Stable integer seed for extraction (same inputs → same seed). */
export function deriveExtractionSeed(contentSha256: string): number {
  const h = sha256Utf8HexSync(
    `${contentSha256}|extraction|v${EXTRACTION_SCHEMA_VERSION}`,
  );
  return parseInt(h.slice(0, 8), 16) >>> 0;
}

/** Stable integer seed for quiz vs flashcard generation from canonical units. */
export function deriveGenerationSeed(
  contentSha256: string,
  contentKind: string,
  generationSchemaVersion: number,
  targetItemCount: number,
): number {
  const h = sha256Utf8HexSync(
    `${contentSha256}|${contentKind}|${generationSchemaVersion}|${targetItemCount}|generate`,
  );
  return parseInt(h.slice(0, 8), 16) >>> 0;
}
