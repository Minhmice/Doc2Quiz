/**
 * Browser-local embedding index (Phase 33). Separate DB from study sets and parse cache.
 *
 * **RAG-33-04:** Max vectors per study set + LRU eviction by `lastAccessedAt`.
 */

import type {
  EmbeddingChunkRecord,
  EmbeddingIndexBuildMetaRecord,
} from "@/lib/ai/embeddingIndexTypes";
import { pipelineLog } from "@/lib/logging/pipelineLogger";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";

export const EMBEDDING_INDEX_DB_NAME = "doc2quiz-embedding-index";
/** v2: `buildMeta` store for Phase 34 idempotency. */
export const EMBEDDING_INDEX_DB_VERSION = 2;
export const EMBEDDING_INDEX_STORE = "chunks";
export const EMBEDDING_INDEX_BUILD_META_STORE = "buildMeta";
export const MAX_VECTORS_PER_STUDY_SET = 2000;

type Row = EmbeddingChunkRecord;

function logWarn(message: string, context?: Record<string, unknown>): void {
  pipelineLog("IDB", "embedding-index", "warn", message, context);
}

export function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

export async function openEmbeddingIndexDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }
  try {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open(EMBEDDING_INDEX_DB_NAME, EMBEDDING_INDEX_DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(EMBEDDING_INDEX_STORE)) {
          const s = db.createObjectStore(EMBEDDING_INDEX_STORE, { keyPath: "id" });
          s.createIndex("byStudySet", "studySetId", { unique: false });
          s.createIndex("byLastAccess", "lastAccessedAt", { unique: false });
        }
        if (
          ev.oldVersion < 2 &&
          !db.objectStoreNames.contains(EMBEDDING_INDEX_BUILD_META_STORE)
        ) {
          db.createObjectStore(EMBEDDING_INDEX_BUILD_META_STORE, {
            keyPath: "studySetId",
          });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  } catch (e) {
    logWarn("openEmbeddingIndexDb failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

async function countForStudySet(
  db: IDBDatabase,
  studySetId: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EMBEDDING_INDEX_STORE, "readonly");
    const store = tx.objectStore(EMBEDDING_INDEX_STORE);
    const idx = store.index("byStudySet");
    const range = IDBKeyRange.only(studySetId);
    const req = idx.count(range);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result ?? 0);
  });
}

async function collectKeysForStudySet(
  db: IDBDatabase,
  studySetId: string,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const out: string[] = [];
    const tx = db.transaction(EMBEDDING_INDEX_STORE, "readonly");
    const store = tx.objectStore(EMBEDDING_INDEX_STORE);
    const idx = store.index("byStudySet");
    const range = IDBKeyRange.only(studySetId);
    const req = idx.openCursor(range);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out.push(String(cursor.primaryKey));
      cursor.continue();
    };
  });
}

async function getRow(db: IDBDatabase, id: string): Promise<Row | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EMBEDDING_INDEX_STORE, "readonly");
    const req = tx.objectStore(EMBEDDING_INDEX_STORE).get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as Row | undefined);
  });
}

async function deleteKey(db: IDBDatabase, id: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(EMBEDDING_INDEX_STORE, "readwrite");
    tx.objectStore(EMBEDDING_INDEX_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Evict oldest `lastAccessedAt` until under cap. */
async function enforceCapForStudySet(
  db: IDBDatabase,
  studySetId: string,
): Promise<void> {
  let count = await countForStudySet(db, studySetId);
  while (count > MAX_VECTORS_PER_STUDY_SET) {
    const keys = await collectKeysForStudySet(db, studySetId);
    if (keys.length === 0) {
      break;
    }
    let oldestKey = keys[0]!;
    let oldestMs = Infinity;
    for (const k of keys) {
      const row = await getRow(db, k);
      if (!row) {
        continue;
      }
      const ms = Date.parse(row.lastAccessedAt);
      if (ms < oldestMs) {
        oldestMs = ms;
        oldestKey = k;
      }
    }
    await deleteKey(db, oldestKey);
    count -= 1;
  }
}

export async function embeddingIndexPut(row: Row): Promise<void> {
  const db = await openEmbeddingIndexDb();
  if (!db) {
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EMBEDDING_INDEX_STORE, "readwrite");
      tx.objectStore(EMBEDDING_INDEX_STORE).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await enforceCapForStudySet(db, row.studySetId);
  } catch (e) {
    logWarn("embeddingIndexPut failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function embeddingIndexListByStudySet(
  studySetId: string,
): Promise<Row[]> {
  const db = await openEmbeddingIndexDb();
  if (!db) {
    return [];
  }
  try {
    const items: Row[] = await new Promise((resolve, reject) => {
      const out: Row[] = [];
      const tx = db.transaction(EMBEDDING_INDEX_STORE, "readonly");
      const store = tx.objectStore(EMBEDDING_INDEX_STORE);
      const idx = store.index("byStudySet");
      const range = IDBKeyRange.only(studySetId);
      const req = idx.openCursor(range);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(out);
          return;
        }
        out.push(cursor.value as Row);
        cursor.continue();
      };
    });
    return items;
  } catch (e) {
    logWarn("embeddingIndexListByStudySet failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

/** Update lastAccessedAt on read (single). */
export async function embeddingIndexTouch(id: string): Promise<void> {
  const db = await openEmbeddingIndexDb();
  if (!db) {
    return;
  }
  try {
    const row = await getRow(db, id);
    if (!row) {
      return;
    }
    row.lastAccessedAt = new Date().toISOString();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EMBEDDING_INDEX_STORE, "readwrite");
      tx.objectStore(EMBEDDING_INDEX_STORE).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function embeddingIndexClearStudySet(studySetId: string): Promise<void> {
  const db = await openEmbeddingIndexDb();
  if (!db) {
    return;
  }
  try {
    const keys = await collectKeysForStudySet(db, studySetId);
    for (const k of keys) {
      await deleteKey(db, k);
    }
    await embeddingIndexDeleteBuildMeta(studySetId);
  } catch (e) {
    logWarn("embeddingIndexClearStudySet failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function embeddingIndexGetBuildMeta(
  studySetId: string,
): Promise<EmbeddingIndexBuildMetaRecord | undefined> {
  const db = await openEmbeddingIndexDb();
  if (!db || !db.objectStoreNames.contains(EMBEDDING_INDEX_BUILD_META_STORE)) {
    return undefined;
  }
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(EMBEDDING_INDEX_BUILD_META_STORE, "readonly");
      const req = tx.objectStore(EMBEDDING_INDEX_BUILD_META_STORE).get(studySetId);
      req.onerror = () => reject(req.error);
      req.onsuccess = () =>
        resolve(req.result as EmbeddingIndexBuildMetaRecord | undefined);
    });
  } catch (e) {
    logWarn("embeddingIndexGetBuildMeta failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return undefined;
  }
}

export async function embeddingIndexPutBuildMeta(
  row: EmbeddingIndexBuildMetaRecord,
): Promise<void> {
  const db = await openEmbeddingIndexDb();
  if (!db || !db.objectStoreNames.contains(EMBEDDING_INDEX_BUILD_META_STORE)) {
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EMBEDDING_INDEX_BUILD_META_STORE, "readwrite");
      tx.objectStore(EMBEDDING_INDEX_BUILD_META_STORE).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logWarn("embeddingIndexPutBuildMeta failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function embeddingIndexDeleteBuildMeta(studySetId: string): Promise<void> {
  const db = await openEmbeddingIndexDb();
  if (!db || !db.objectStoreNames.contains(EMBEDDING_INDEX_BUILD_META_STORE)) {
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EMBEDDING_INDEX_BUILD_META_STORE, "readwrite");
      tx.objectStore(EMBEDDING_INDEX_BUILD_META_STORE).delete(studySetId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logWarn("embeddingIndexDeleteBuildMeta failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export function newEmbeddingChunkId(): string {
  return createRandomUuid();
}
