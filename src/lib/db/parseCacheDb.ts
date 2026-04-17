/**
 * Browser-local parse cache (Phase 31). Separate DB from study-set persistence.
 *
 * **CACHE-31-07 caps (per object store):**
 * - Max **400** entries
 * - Max **~15 MiB** combined `estimatedBytes` (UTF-8 length of stored `itemsJson`)
 *
 * LRU: `lastAccessedAtMs` updated on successful get and set; eviction deletes lowest
 * `lastAccessedAtMs` first until both caps are satisfied.
 *
 * Canonical key: SHA-256 hex (or fallback) of UTF-8 bytes of JSON from
 * `canonicalizeParseCacheKeyParts` with field order:
 * `contentFingerprint`, `forwardProvider`, `lane`, `model`, `promptIdentity`.
 */

import type { ParseCacheKeyParts } from "@/lib/ai/parseCacheTypes";
import { validateQuestionsFromJson } from "@/lib/ai/validateQuestions";
import { pipelineLog } from "@/lib/logging/pipelineLogger";
import type { Question } from "@/types/question";
import type { VisionParseItem } from "@/types/visionParse";

export const PARSE_CACHE_DB_NAME = "doc2quiz-parse-cache";
export const PARSE_CACHE_DB_VERSION = 1;
export const PARSE_CACHE_STORE_VISION = "vision_batch";
export const PARSE_CACHE_STORE_TEXT = "text_chunk";

/** CACHE-31-07 */
export const PARSE_CACHE_MAX_ENTRIES_PER_STORE = 400;
/** CACHE-31-07 — approximate payload budget per store */
export const PARSE_CACHE_MAX_ESTIMATED_BYTES_PER_STORE = 15 * 1024 * 1024;

type ParseCacheRow = {
  itemsJson: string;
  estimatedBytes: number;
  lastAccessedAtMs: number;
  savedAtMs: number;
  studySetId?: string;
};

function logParseCacheWarn(message: string, context?: Record<string, unknown>): void {
  pipelineLog("IDB", "parse-cache", "warn", message, context);
}

export function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * Stable JSON string for hashing. Keys sorted alphabetically at top level:
 * contentFingerprint, forwardProvider, lane, model, promptIdentity.
 */
export function canonicalizeParseCacheKeyParts(parts: ParseCacheKeyParts): string {
  return JSON.stringify({
    contentFingerprint: parts.contentFingerprint,
    forwardProvider: parts.forwardProvider,
    lane: parts.lane,
    model: parts.model,
    promptIdentity: parts.promptIdentity,
  });
}

export async function sha256Utf8Hex(message: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
    const buf = new TextEncoder().encode(message);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  for (let i = 0; i < message.length; i++) {
    h = (Math.imul(31, h) + message.charCodeAt(i)) | 0;
  }
  return `fb_${message.length}_${(h >>> 0).toString(16)}`;
}

export async function canonicalParseCacheKey(
  parts: ParseCacheKeyParts,
): Promise<string> {
  return sha256Utf8Hex(canonicalizeParseCacheKeyParts(parts));
}

export async function openParseCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }
  try {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open(PARSE_CACHE_DB_NAME, PARSE_CACHE_DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PARSE_CACHE_STORE_VISION)) {
          const s = db.createObjectStore(PARSE_CACHE_STORE_VISION);
          s.createIndex("byLastAccess", "lastAccessedAtMs", { unique: false });
        }
        if (!db.objectStoreNames.contains(PARSE_CACHE_STORE_TEXT)) {
          const s = db.createObjectStore(PARSE_CACHE_STORE_TEXT);
          s.createIndex("byLastAccess", "lastAccessedAtMs", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  } catch (e) {
    logParseCacheWarn("openParseCacheDb failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

function isVisionParseItemArray(v: unknown): v is VisionParseItem[] {
  if (!Array.isArray(v)) {
    return false;
  }
  for (const it of v) {
    if (it === null || typeof it !== "object") {
      return false;
    }
    const k = (it as { kind?: unknown }).kind;
    if (k !== "quiz" && k !== "flashcard") {
      return false;
    }
  }
  return true;
}

async function collectStoreRows(
  db: IDBDatabase,
  storeName: string,
): Promise<Array<{ key: string; row: ParseCacheRow }>> {
  return new Promise((resolve, reject) => {
    const out: Array<{ key: string; row: ParseCacheRow }> = [];
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out.push({
        key: String(cursor.key),
        row: cursor.value as ParseCacheRow,
      });
      cursor.continue();
    };
  });
}

async function enforceLruAfterSet(
  db: IDBDatabase,
  storeName: string,
): Promise<void> {
  const rows = await collectStoreRows(db, storeName);
  let totalBytes = 0;
  for (const { row } of rows) {
    totalBytes += row.estimatedBytes;
  }
  if (
    rows.length <= PARSE_CACHE_MAX_ENTRIES_PER_STORE &&
    totalBytes <= PARSE_CACHE_MAX_ESTIMATED_BYTES_PER_STORE
  ) {
    return;
  }
  const sorted = [...rows].sort((a, b) => a.row.lastAccessedAtMs - b.row.lastAccessedAtMs);
  const toDelete: string[] = [];
  let count = rows.length;
  let bytes = totalBytes;
  for (const { key, row } of sorted) {
    if (
      count <= PARSE_CACHE_MAX_ENTRIES_PER_STORE &&
      bytes <= PARSE_CACHE_MAX_ESTIMATED_BYTES_PER_STORE
    ) {
      break;
    }
    toDelete.push(key);
    count -= 1;
    bytes -= row.estimatedBytes;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const key of toDelete) {
      store.delete(key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteKey(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function nowRowMeta(studySetId?: string): {
  lastAccessedAtMs: number;
  savedAtMs: number;
  studySetId?: string;
} {
  const ms = Date.now();
  return { lastAccessedAtMs: ms, savedAtMs: ms, studySetId };
}

export async function parseCacheGetVisionBatch(
  key: string,
): Promise<VisionParseItem[] | null> {
  const db = await openParseCacheDb();
  if (!db) {
    return null;
  }
  try {
    const row = await new Promise<ParseCacheRow | undefined>((resolve, reject) => {
      const tx = db.transaction(PARSE_CACHE_STORE_VISION, "readwrite");
      const store = tx.objectStore(PARSE_CACHE_STORE_VISION);
      const req = store.get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result as ParseCacheRow | undefined);
    });
    if (!row) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.itemsJson);
    } catch {
      await deleteKey(db, PARSE_CACHE_STORE_VISION, key);
      return null;
    }
    if (!isVisionParseItemArray(parsed)) {
      await deleteKey(db, PARSE_CACHE_STORE_VISION, key);
      return null;
    }
    const now = Date.now();
    row.lastAccessedAtMs = now;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PARSE_CACHE_STORE_VISION, "readwrite");
      tx.objectStore(PARSE_CACHE_STORE_VISION).put(row, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return parsed;
  } catch (e) {
    logParseCacheWarn("parseCacheGetVisionBatch failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function parseCacheSetVisionBatch(
  key: string,
  items: VisionParseItem[],
  studySetId?: string,
): Promise<void> {
  const db = await openParseCacheDb();
  if (!db) {
    return;
  }
  try {
    const itemsJson = JSON.stringify(items);
    const estimatedBytes = utf8ByteLength(itemsJson);
    const meta = nowRowMeta(studySetId);
    const row: ParseCacheRow = {
      itemsJson,
      estimatedBytes,
      lastAccessedAtMs: meta.lastAccessedAtMs,
      savedAtMs: meta.savedAtMs,
      studySetId: meta.studySetId,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PARSE_CACHE_STORE_VISION, "readwrite");
      tx.objectStore(PARSE_CACHE_STORE_VISION).put(row, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await enforceLruAfterSet(db, PARSE_CACHE_STORE_VISION);
  } catch (e) {
    logParseCacheWarn("parseCacheSetVisionBatch failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function parseCacheTouchVisionBatch(key: string): Promise<void> {
  const db = await openParseCacheDb();
  if (!db) {
    return;
  }
  try {
    const row = await new Promise<ParseCacheRow | undefined>((resolve, reject) => {
      const tx = db.transaction(PARSE_CACHE_STORE_VISION, "readwrite");
      const store = tx.objectStore(PARSE_CACHE_STORE_VISION);
      const req = store.get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result as ParseCacheRow | undefined);
    });
    if (!row) {
      return;
    }
    row.lastAccessedAtMs = Date.now();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PARSE_CACHE_STORE_VISION, "readwrite");
      tx.objectStore(PARSE_CACHE_STORE_VISION).put(row, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logParseCacheWarn("parseCacheTouchVisionBatch failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function parseCacheGetTextChunk(key: string): Promise<Question[] | null> {
  const db = await openParseCacheDb();
  if (!db) {
    return null;
  }
  try {
    const row = await new Promise<ParseCacheRow | undefined>((resolve, reject) => {
      const tx = db.transaction(PARSE_CACHE_STORE_TEXT, "readwrite");
      const store = tx.objectStore(PARSE_CACHE_STORE_TEXT);
      const req = store.get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result as ParseCacheRow | undefined);
    });
    if (!row) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.itemsJson);
    } catch {
      await deleteKey(db, PARSE_CACHE_STORE_TEXT, key);
      return null;
    }
    const qs = validateQuestionsFromJson(parsed, { preserveIds: true });
    const rawArr = Array.isArray(parsed) ? parsed : [];
    if (rawArr.length > 0 && qs.length === 0) {
      await deleteKey(db, PARSE_CACHE_STORE_TEXT, key);
      return null;
    }
    const now = Date.now();
    row.lastAccessedAtMs = now;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PARSE_CACHE_STORE_TEXT, "readwrite");
      tx.objectStore(PARSE_CACHE_STORE_TEXT).put(row, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return qs;
  } catch (e) {
    logParseCacheWarn("parseCacheGetTextChunk failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function parseCacheSetTextChunk(
  key: string,
  items: Question[],
  studySetId?: string,
): Promise<void> {
  const db = await openParseCacheDb();
  if (!db) {
    return;
  }
  try {
    const itemsJson = JSON.stringify(items);
    const estimatedBytes = utf8ByteLength(itemsJson);
    const meta = nowRowMeta(studySetId);
    const row: ParseCacheRow = {
      itemsJson,
      estimatedBytes,
      lastAccessedAtMs: meta.lastAccessedAtMs,
      savedAtMs: meta.savedAtMs,
      studySetId: meta.studySetId,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PARSE_CACHE_STORE_TEXT, "readwrite");
      tx.objectStore(PARSE_CACHE_STORE_TEXT).put(row, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await enforceLruAfterSet(db, PARSE_CACHE_STORE_TEXT);
  } catch (e) {
    logParseCacheWarn("parseCacheSetTextChunk failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Dev / tests: best-effort wipe vision batch store and L1 should be cleared separately. */
export async function clearParseCacheVisionBatchStore(): Promise<void> {
  const db = await openParseCacheDb();
  if (!db) {
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PARSE_CACHE_STORE_VISION, "readwrite");
      tx.objectStore(PARSE_CACHE_STORE_VISION).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logParseCacheWarn("clearParseCacheVisionBatchStore failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
