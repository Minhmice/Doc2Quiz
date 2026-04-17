/**
 * Vision batch parse cache: **L1** in-memory Map + **L2** IndexedDB (`vision_batch` store).
 * Keys include content fingerprint, model, forward provider, and prompt identity (Phase 31).
 */

import type { PageImageResult } from "@/lib/pdf/renderPagesToImages";
import type { ParseCacheKeyParts } from "@/lib/ai/parseCacheTypes";
import {
  formatPromptKeyComponent,
  hashPromptIdentity,
  PROMPTS_BUNDLE_VERSION,
} from "@/lib/ai/prompts/mcqExtractionPrompts";
import {
  canonicalParseCacheKey,
  clearParseCacheVisionBatchStore,
  parseCacheGetVisionBatch,
  parseCacheSetVisionBatch,
  parseCacheTouchVisionBatch,
  sha256Utf8Hex,
} from "@/lib/db/parseCacheDb";
import type { ParseOutputMode, VisionParseItem } from "@/types/visionParse";

/**
 * @deprecated Use `PROMPTS_BUNDLE_VERSION` and `hashPromptIdentity(systemText)` in cache keys (Phase 31).
 * Kept temporarily for grep/compat; not used in key material.
 */
export const VISION_BATCH_PROMPT_V = "26-flashcard-theory";

type MemoryCacheEntry = {
  items: VisionParseItem[];
  savedAt: string;
};

/** L1 — hot path within a session. */
const memoryStore = new Map<string, MemoryCacheEntry>();

function cloneVisionItems(items: VisionParseItem[]): VisionParseItem[] {
  return JSON.parse(JSON.stringify(items)) as VisionParseItem[];
}

/**
 * Fingerprint for page bytes + mode (+ flashcard extras only). Does **not** include model or system prompt.
 */
export async function hashVisionBatchContentFingerprint(
  pages: PageImageResult[],
  mode: ParseOutputMode,
  extraFingerprint?: string,
): Promise<string> {
  const parts: string[] = [mode];
  if (extraFingerprint && extraFingerprint.length > 0) {
    parts.push(extraFingerprint);
  }
  for (const p of pages) {
    const head = p.dataUrl.slice(0, 200);
    parts.push(`${p.pageIndex}:${p.dataUrl.length}:${head}`);
  }
  return sha256Utf8Hex(parts.join("|"));
}

export async function buildVisionBatchCacheKeyParts(options: {
  pages: PageImageResult[];
  mode: ParseOutputMode;
  extraFingerprint?: string;
  model: string;
  forwardProvider: "openai" | "custom";
  systemText: string;
}): Promise<ParseCacheKeyParts> {
  const contentFingerprint = await hashVisionBatchContentFingerprint(
    options.pages,
    options.mode,
    options.extraFingerprint,
  );
  const digest = await hashPromptIdentity(options.systemText);
  return {
    lane: "vision_batch",
    contentFingerprint,
    promptIdentity: formatPromptKeyComponent(PROMPTS_BUNDLE_VERSION, digest),
    model: options.model,
    forwardProvider: options.forwardProvider,
  };
}

export async function buildVisionBatchCacheKey(options: {
  pages: PageImageResult[];
  mode: ParseOutputMode;
  extraFingerprint?: string;
  model: string;
  forwardProvider: "openai" | "custom";
  systemText: string;
}): Promise<string> {
  const parts = await buildVisionBatchCacheKeyParts(options);
  return canonicalParseCacheKey(parts);
}

export async function getCachedVisionBatchResult(
  key: string,
): Promise<VisionParseItem[] | null> {
  const mem = memoryStore.get(key);
  if (mem) {
    void parseCacheTouchVisionBatch(key);
    return cloneVisionItems(mem.items);
  }
  const fromIdb = await parseCacheGetVisionBatch(key);
  if (!fromIdb) {
    return null;
  }
  const copy = cloneVisionItems(fromIdb);
  memoryStore.set(key, { items: copy, savedAt: new Date().toISOString() });
  return copy;
}

export async function setCachedVisionBatchResult(
  key: string,
  items: VisionParseItem[],
  studySetId?: string,
): Promise<void> {
  const copy = cloneVisionItems(items);
  memoryStore.set(key, { items: copy, savedAt: new Date().toISOString() });
  await parseCacheSetVisionBatch(key, copy, studySetId);
}

/** Test / dev: clear in-memory vision parse cache only. */
export function clearVisionParseCacheMemory(): void {
  memoryStore.clear();
}

/** Dev: clear L1 + best-effort wipe IDB vision store. */
export async function clearVisionParseCacheAll(): Promise<void> {
  memoryStore.clear();
  await clearParseCacheVisionBatchStore();
}
