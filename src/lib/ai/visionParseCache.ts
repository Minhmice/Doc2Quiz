import type { PageImageResult } from "@/lib/pdf/renderPagesToImages";
import type { ParseOutputMode, VisionParseItem } from "@/types/visionParse";

/** Bump when vision batch prompt/schema changes (invalidates in-memory cache). */
export const VISION_BATCH_PROMPT_V = "26-flashcard-theory";

type CacheEntry = {
  items: VisionParseItem[];
  savedAt: string;
};

const memoryStore = new Map<string, CacheEntry>();

/**
 * Deterministic key: mode + per-page fingerprint (length + head slice of data URL).
 * Same PDF re-render may change data URLs slightly — cache is best-effort for identical batch bytes in MVP.
 */
export async function hashVisionBatch(
  pages: PageImageResult[],
  mode: ParseOutputMode,
  /** When set (e.g. flashcard generation controls), cache key includes prompt-relevant knobs. */
  extraFingerprint?: string,
): Promise<string> {
  const parts: string[] = [VISION_BATCH_PROMPT_V, mode];
  if (extraFingerprint && extraFingerprint.length > 0) {
    parts.push(extraFingerprint);
  }
  for (const p of pages) {
    const head = p.dataUrl.slice(0, 200);
    parts.push(`${p.pageIndex}:${p.dataUrl.length}:${head}`);
  }
  const s = parts.join("|");
  if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return `vb_${s.length}_${pages.map((p) => p.pageIndex).join("-")}`;
}

export async function getCachedVisionBatchResult(
  key: string,
): Promise<VisionParseItem[] | null> {
  const hit = memoryStore.get(key);
  return hit ? [...hit.items] : null;
}

export async function setCachedVisionBatchResult(
  key: string,
  items: VisionParseItem[],
): Promise<void> {
  memoryStore.set(key, {
    items: [...items],
    savedAt: new Date().toISOString(),
  });
}

/** Test / dev: clear in-memory vision parse cache. */
export function clearVisionParseCacheMemory(): void {
  memoryStore.clear();
}
