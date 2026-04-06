import type { ApprovedBank, Question } from "@/types/question";
import {
  DB_NAME,
  DB_VERSION,
  type ParseProgressRecord,
  type StudySetDocumentRecord,
  type StudySetMeta,
} from "@/types/studySet";

type MediaRecord = {
  id: string;
  studySetId: string;
  buffer: ArrayBuffer;
  mimeType: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;
let initPromise: Promise<void> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (ev) => {
        const db = (ev.target as IDBOpenDBRequest).result;
        const from = ev.oldVersion;
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("document")) {
          db.createObjectStore("document", { keyPath: "studySetId" });
        }
        if (!db.objectStoreNames.contains("draft")) {
          db.createObjectStore("draft", { keyPath: "studySetId" });
        }
        if (!db.objectStoreNames.contains("approved")) {
          db.createObjectStore("approved", { keyPath: "studySetId" });
        }
        if (!db.objectStoreNames.contains("media")) {
          const m = db.createObjectStore("media", { keyPath: "id" });
          m.createIndex("byStudySetId", "studySetId", { unique: false });
        }
        if (!db.objectStoreNames.contains("parseProgress")) {
          db.createObjectStore("parseProgress", { keyPath: "studySetId" });
        }
        if (from < 3) {
          if (!db.objectStoreNames.contains("quizSessions")) {
            const qs = db.createObjectStore("quizSessions", { keyPath: "id" });
            qs.createIndex("byStudySetId", "studySetId", { unique: false });
          }
          if (!db.objectStoreNames.contains("studyWrongHistory")) {
            db.createObjectStore("studyWrongHistory", {
              keyPath: "studySetId",
            });
          }
        }
      };
    });
  }
  return dbPromise;
}

export async function ensureStudySetDb(): Promise<IDBDatabase> {
  const db = await openDb();
  if (!initPromise) {
    initPromise = import("./migrateLegacyLocalStorage").then((m) =>
      m.migrateLegacyLocalStorage(db),
    );
  }
  await initPromise;
  return db;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IDB transaction aborted"));
  });
}

export async function listStudySetMetas(): Promise<StudySetMeta[]> {
  const db = await ensureStudySetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const store = tx.objectStore("meta");
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rows = (req.result as StudySetMeta[]) ?? [];
      rows.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      resolve(rows);
    };
  });
}

export async function getStudySetMeta(
  id: string,
): Promise<StudySetMeta | undefined> {
  const db = await ensureStudySetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const req = tx.objectStore("meta").get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as StudySetMeta | undefined);
  });
}

export async function putStudySetMeta(meta: StudySetMeta): Promise<void> {
  const db = await ensureStudySetDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put(meta);
  await txDone(tx);
}

export async function deleteStudySet(id: string): Promise<void> {
  const db = await ensureStudySetDb();
  const storeNames: string[] = [
    "meta",
    "document",
    "draft",
    "approved",
    "media",
    "parseProgress",
  ];
  if (db.objectStoreNames.contains("quizSessions")) {
    storeNames.push("quizSessions");
  }
  if (db.objectStoreNames.contains("studyWrongHistory")) {
    storeNames.push("studyWrongHistory");
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("deleteStudySet failed"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("deleteStudySet aborted"));
    tx.objectStore("meta").delete(id);
    tx.objectStore("document").delete(id);
    tx.objectStore("draft").delete(id);
    tx.objectStore("approved").delete(id);
    tx.objectStore("parseProgress").delete(id);
    if (db.objectStoreNames.contains("studyWrongHistory")) {
      tx.objectStore("studyWrongHistory").delete(id);
    }
    if (db.objectStoreNames.contains("quizSessions")) {
      const qsStore = tx.objectStore("quizSessions");
      if (qsStore.indexNames.contains("byStudySetId")) {
        const idx = qsStore.index("byStudySetId");
        const qReq = idx.openCursor(IDBKeyRange.only(id));
        qReq.onerror = () => reject(qReq.error);
        qReq.onsuccess = () => {
          const cursor = qReq.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }
    }
    const mediaStore = tx.objectStore("media");
    const idx = mediaStore.index("byStudySetId");
    const req = idx.openCursor(IDBKeyRange.only(id));
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  });
}

export async function getDocument(
  studySetId: string,
): Promise<StudySetDocumentRecord | undefined> {
  const db = await ensureStudySetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("document", "readonly");
    const req = tx.objectStore("document").get(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () =>
      resolve(req.result as StudySetDocumentRecord | undefined);
  });
}

export async function putDocument(
  doc: StudySetDocumentRecord,
): Promise<void> {
  const db = await ensureStudySetDb();
  const tx = db.transaction("document", "readwrite");
  tx.objectStore("document").put(doc);
  await txDone(tx);
}

export async function getParseProgressRecord(
  studySetId: string,
): Promise<ParseProgressRecord | undefined> {
  const db = await ensureStudySetDb();
  if (!db.objectStoreNames.contains("parseProgress")) {
    return undefined;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction("parseProgress", "readonly");
    const req = tx.objectStore("parseProgress").get(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () =>
      resolve(req.result as ParseProgressRecord | undefined);
  });
}

export async function putParseProgressRecord(
  record: ParseProgressRecord,
): Promise<void> {
  const db = await ensureStudySetDb();
  if (!db.objectStoreNames.contains("parseProgress")) {
    return;
  }
  const tx = db.transaction("parseProgress", "readwrite");
  tx.objectStore("parseProgress").put(record);
  await txDone(tx);
}

export async function getDraftQuestions(
  studySetId: string,
): Promise<Question[]> {
  const db = await ensureStudySetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("draft", "readonly");
    const req = tx.objectStore("draft").get(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as { questions?: Question[] } | undefined;
      resolve(Array.isArray(row?.questions) ? row.questions : []);
    };
  });
}

export async function putDraftQuestions(
  studySetId: string,
  questions: Question[],
): Promise<void> {
  const db = await ensureStudySetDb();
  const tx = db.transaction("draft", "readwrite");
  tx.objectStore("draft").put({
    studySetId,
    savedAt: new Date().toISOString(),
    questions,
  });
  await txDone(tx);
}

type ApprovedRow = ApprovedBank & { studySetId: string };

export async function getApprovedBank(
  studySetId: string,
): Promise<ApprovedBank | null> {
  const db = await ensureStudySetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("approved", "readonly");
    const req = tx.objectStore("approved").get(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as ApprovedRow | undefined;
      if (!row) {
        resolve(null);
        return;
      }
      resolve({
        version: row.version,
        savedAt: row.savedAt,
        questions: row.questions,
      });
    };
  });
}

export async function putApprovedBankForStudySet(
  studySetId: string,
  bank: ApprovedBank,
): Promise<void> {
  const db = await ensureStudySetDb();
  const tx = db.transaction("approved", "readwrite");
  tx.objectStore("approved").put({
    studySetId,
    version: bank.version,
    savedAt: bank.savedAt,
    questions: bank.questions,
  });
  await txDone(tx);
}

export async function putMediaBlob(
  studySetId: string,
  blob: Blob,
): Promise<string> {
  const db = await ensureStudySetDb();
  const id = crypto.randomUUID();
  const buffer = await blob.arrayBuffer();
  const tx = db.transaction("media", "readwrite");
  const rec: MediaRecord = {
    id,
    studySetId,
    buffer,
    mimeType: blob.type || "application/octet-stream",
  };
  tx.objectStore("media").put(rec);
  await txDone(tx);
  return id;
}

export async function getMediaBlob(
  mediaId: string,
): Promise<Blob | null> {
  const db = await ensureStudySetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("media", "readonly");
    const req = tx.objectStore("media").get(mediaId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as MediaRecord | undefined;
      if (!row) {
        resolve(null);
        return;
      }
      resolve(new Blob([row.buffer], { type: row.mimeType }));
    };
  });
}

export async function deleteMedia(mediaId: string): Promise<void> {
  const db = await ensureStudySetDb();
  const tx = db.transaction("media", "readwrite");
  tx.objectStore("media").delete(mediaId);
  await txDone(tx);
}

export function newStudySetId(): string {
  return crypto.randomUUID();
}

export async function createStudySet(input: {
  title: string;
  subtitle?: string;
  sourceFileName?: string;
  pageCount?: number;
  extractedText: string;
  pdfFile?: File | null;
}): Promise<string> {
  const id = newStudySetId();
  const now = new Date().toISOString();
  const meta: StudySetMeta = {
    id,
    title: input.title,
    subtitle: input.subtitle,
    createdAt: now,
    updatedAt: now,
    sourceFileName: input.sourceFileName,
    pageCount: input.pageCount ?? undefined,
    status: "draft",
  };
  let pdfArrayBuffer: ArrayBuffer | undefined;
  if (input.pdfFile && input.pdfFile.size > 0) {
    pdfArrayBuffer = await input.pdfFile.arrayBuffer();
  }
  const doc: StudySetDocumentRecord = {
    studySetId: id,
    extractedText: input.extractedText,
    pdfArrayBuffer,
    pdfFileName: input.pdfFile?.name,
  };
  const db = await ensureStudySetDb();
  const tx = db.transaction(["meta", "document", "draft"], "readwrite");
  tx.objectStore("meta").put(meta);
  tx.objectStore("document").put(doc);
  tx.objectStore("draft").put({
    studySetId: id,
    savedAt: now,
    questions: [],
  });
  await txDone(tx);
  return id;
}

export async function touchStudySetMeta(
  id: string,
  patch: Partial<
    Pick<
      StudySetMeta,
      "title" | "subtitle" | "status" | "pageCount" | "sourceFileName"
    >
  >,
): Promise<void> {
  const existing = await getStudySetMeta(id);
  if (!existing) {
    return;
  }
  await putStudySetMeta({
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}
