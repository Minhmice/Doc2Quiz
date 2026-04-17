import { generateStudySetTitle } from "@/lib/ai/generateStudySetTitle";
import { withRetries } from "@/lib/ai/pipelineStageRetry";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import {
  fileSummary,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import type { ApprovedBank, Question } from "@/types/question";
import type { FlashcardGenerationConfig } from "@/types/flashcardGeneration";
import { normalizeFlashcardGenerationConfig } from "@/types/flashcardGeneration";
import type {
  ApprovedFlashcardBank,
  FlashcardVisionItem,
} from "@/types/visionParse";
import {
  DB_NAME,
  DB_VERSION,
  type ParseProgressRecord,
  type StudyContentKind,
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
    pipelineLog("IDB", "open", "error", "indexedDB API missing (private mode / unsupported)", {
      dbName: DB_NAME,
      dbVersion: DB_VERSION,
    });
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => {
        const err = req.error;
        pipelineLog("IDB", "open", "error", "indexedDB.open request failed", {
          dbName: DB_NAME,
          dbVersion: DB_VERSION,
          ...normalizeUnknownError(err ?? new Error("IDB open failed")),
          raw: err,
        });
        reject(err ?? new Error("IDB open failed"));
      };
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
        if (!db.objectStoreNames.contains("ocr")) {
          db.createObjectStore("ocr", { keyPath: "studySetId" });
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
        if (from < 6) {
          if (!db.objectStoreNames.contains("approvedFlashcards")) {
            db.createObjectStore("approvedFlashcards", { keyPath: "studySetId" });
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

/** Clear OCR provider/status on meta after replacing the PDF or resetting OCR. */
export async function clearOcrMetaFields(id: string): Promise<void> {
  const existing = await getStudySetMeta(id);
  if (!existing) {
    return;
  }
  const next = { ...existing, updatedAt: new Date().toISOString() };
  delete (next as Record<string, unknown>).ocrProvider;
  delete (next as Record<string, unknown>).ocrStatus;
  await putStudySetMeta(next as StudySetMeta);
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
    "ocr",
  ];
  if (db.objectStoreNames.contains("approvedFlashcards")) {
    storeNames.splice(4, 0, "approvedFlashcards");
  }
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
    if (db.objectStoreNames.contains("approvedFlashcards")) {
      tx.objectStore("approvedFlashcards").delete(id);
    }
    tx.objectStore("parseProgress").delete(id);
    tx.objectStore("ocr").delete(id);
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
  pipelineLog("IDB", "document-put", "info", "putDocument start", {
    studySetId: doc.studySetId,
    pdfFileName: doc.pdfFileName,
    hasPdfBuffer: Boolean(doc.pdfArrayBuffer),
    pdfBufferByteLength: doc.pdfArrayBuffer?.byteLength,
    extractedTextChars: doc.extractedText.length,
  });
  try {
    const db = await ensureStudySetDb();
    const tx = db.transaction("document", "readwrite");
    tx.objectStore("document").put(doc);
    await txDone(tx);
    pipelineLog("IDB", "document-put", "info", "putDocument success", {
      studySetId: doc.studySetId,
    });
  } catch (raw) {
    pipelineLog("IDB", "document-put", "error", "putDocument failed", {
      studySetId: doc.studySetId,
      ...normalizeUnknownError(raw),
      raw,
    });
    throw raw;
  }
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

type DraftRow = {
  studySetId: string;
  savedAt?: string;
  questions?: Question[];
  /** Phase 21 — flashcard vision pipeline (separate from MCQ `questions`). */
  flashcardVisionItems?: FlashcardVisionItem[];
  /** Last-used flashcard generation controls (optional; survives flashcard draft writes). */
  flashcardGenerationConfig?: FlashcardGenerationConfig;
};

export async function getDraftQuestions(
  studySetId: string,
): Promise<Question[]> {
  const db = await ensureStudySetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("draft", "readonly");
    const req = tx.objectStore("draft").get(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as DraftRow | undefined;
      resolve(Array.isArray(row?.questions) ? row.questions : []);
    };
  });
}

export async function getDraftFlashcardGenerationConfig(
  studySetId: string,
): Promise<FlashcardGenerationConfig | undefined> {
  const db = await ensureStudySetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("draft", "readonly");
    const req = tx.objectStore("draft").get(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as DraftRow | undefined;
      const cfg = row?.flashcardGenerationConfig;
      resolve(cfg ? normalizeFlashcardGenerationConfig(cfg) : undefined);
    };
  });
}

export async function getDraftFlashcardVisionItems(
  studySetId: string,
): Promise<FlashcardVisionItem[]> {
  const db = await ensureStudySetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("draft", "readonly");
    const req = tx.objectStore("draft").get(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as DraftRow | undefined;
      resolve(
        Array.isArray(row?.flashcardVisionItems) ? row.flashcardVisionItems : [],
      );
    };
  });
}

export async function putDraftFlashcardVisionItems(
  studySetId: string,
  items: FlashcardVisionItem[],
  generationConfig?: FlashcardGenerationConfig,
): Promise<void> {
  const db = await ensureStudySetDb();
  await withRetries("idb_put", undefined, async () => {
    const row = await new Promise<DraftRow | undefined>((resolve, reject) => {
      const tx = db.transaction("draft", "readonly");
      const r = tx.objectStore("draft").get(studySetId);
      r.onerror = () => reject(r.error);
      r.onsuccess = () => resolve(r.result as DraftRow | undefined);
    });
    const withIds = items.map((it) =>
      it.id ? it : { ...it, id: createRandomUuid() },
    );
    const normalizedGen =
      generationConfig !== undefined
        ? normalizeFlashcardGenerationConfig(generationConfig)
        : row?.flashcardGenerationConfig !== undefined
          ? normalizeFlashcardGenerationConfig(row.flashcardGenerationConfig)
          : undefined;
    const tx = db.transaction("draft", "readwrite");
    tx.objectStore("draft").put({
      ...row,
      studySetId,
      savedAt: new Date().toISOString(),
      questions: [],
      flashcardVisionItems: withIds,
      ...(normalizedGen !== undefined
        ? { flashcardGenerationConfig: normalizedGen }
        : {}),
    });
    await txDone(tx);
  });
}

export async function putDraftQuestions(
  studySetId: string,
  questions: Question[],
): Promise<void> {
  pipelineLog("IDB", "draft-put", "info", "putDraftQuestions start", {
    studySetId,
    questionCount: questions.length,
  });
  try {
    await withRetries("idb_put", undefined, async () => {
      const db = await ensureStudySetDb();
      const row = await new Promise<DraftRow | undefined>((resolve, reject) => {
        const rtx = db.transaction("draft", "readonly");
        const r = rtx.objectStore("draft").get(studySetId);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => resolve(r.result as DraftRow | undefined);
      });
      const tx = db.transaction("draft", "readwrite");
      tx.objectStore("draft").put({
        ...row,
        studySetId,
        savedAt: new Date().toISOString(),
        questions,
        flashcardVisionItems: undefined,
      });
      await txDone(tx);
    });
    pipelineLog("IDB", "draft-put", "info", "putDraftQuestions success", {
      studySetId,
    });
  } catch (raw) {
    pipelineLog("IDB", "draft-put", "error", "putDraftQuestions failed", {
      studySetId,
      ...normalizeUnknownError(raw),
      raw,
    });
    throw raw;
  }
}

type ApprovedRow = ApprovedBank & { studySetId: string };

type ApprovedFlashcardRow = ApprovedFlashcardBank & { studySetId: string };

/** Legacy encoding: flashcards were stored as fake MCQs (back in options[0], placeholders). */
function isLegacyFlashcardCarrierQuestion(q: Question): boolean {
  return (
    q.correctIndex === 0 &&
    q.options[1] === "—" &&
    q.options[2] === "—" &&
    q.options[3] === "—"
  );
}

async function readApprovedFlashcardRowRaw(
  db: IDBDatabase,
  studySetId: string,
): Promise<ApprovedFlashcardRow | undefined> {
  if (!db.objectStoreNames.contains("approvedFlashcards")) {
    return undefined;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction("approvedFlashcards", "readonly");
    const req = tx.objectStore("approvedFlashcards").get(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () =>
      resolve(req.result as ApprovedFlashcardRow | undefined);
  });
}

/**
 * One-time migration from `approved.questions` carrier rows → `approvedFlashcards`.
 * Clears quiz `approved` row for that study set after success.
 */
async function migrateLegacyFlashcardCarrierToApprovedFlashcards(
  studySetId: string,
): Promise<void> {
  const db = await ensureStudySetDb();
  if (!db.objectStoreNames.contains("approvedFlashcards")) {
    return;
  }
  const meta = await getStudySetMeta(studySetId);
  if (meta?.contentKind !== "flashcards") {
    return;
  }
  const bank = await getApprovedBank(studySetId);
  if (!bank || bank.questions.length === 0) {
    return;
  }
  if (!bank.questions.every(isLegacyFlashcardCarrierQuestion)) {
    return;
  }
  const items: FlashcardVisionItem[] = bank.questions
    .map((q) => ({
      kind: "flashcard" as const,
      id: q.id,
      front: q.question.trim(),
      back: (q.options[q.correctIndex] ?? "").trim(),
      confidence:
        typeof q.parseConfidence === "number" ? q.parseConfidence : 0.5,
      sourcePages:
        q.sourcePageIndex !== undefined && q.sourcePageIndex >= 1
          ? [q.sourcePageIndex]
          : undefined,
    }))
    .filter((c) => c.front.length > 0 && c.back.length > 0);
  const savedAt = new Date().toISOString();
  await putApprovedFlashcardBankForStudySet(studySetId, {
    version: 1,
    savedAt,
    items,
  });
}

export async function getApprovedFlashcardBank(
  studySetId: string,
): Promise<ApprovedFlashcardBank | null> {
  const db = await ensureStudySetDb();
  if (!db.objectStoreNames.contains("approvedFlashcards")) {
    return null;
  }
  let row = await readApprovedFlashcardRowRaw(db, studySetId);
  if (!row) {
    await migrateLegacyFlashcardCarrierToApprovedFlashcards(studySetId);
    row = await readApprovedFlashcardRowRaw(db, studySetId);
  }
  if (!row) {
    return null;
  }
  return {
    version: row.version,
    savedAt: row.savedAt,
    items: Array.isArray(row.items) ? row.items : [],
  };
}

/**
 * Persists an approved flashcard deck and clears the MCQ `approved` row for the
 * same study set (flashcard lane must not leave quiz-shaped carriers behind).
 */
export async function putApprovedFlashcardBankForStudySet(
  studySetId: string,
  bank: ApprovedFlashcardBank,
): Promise<void> {
  const db = await ensureStudySetDb();
  if (!db.objectStoreNames.contains("approvedFlashcards")) {
    pipelineLog("IDB", "approved-flashcards", "warn", "store missing", {
      studySetId,
    });
    return;
  }
  const tx = db.transaction(["approvedFlashcards", "approved"], "readwrite");
  tx.objectStore("approvedFlashcards").put({
    studySetId,
    version: bank.version,
    savedAt: bank.savedAt,
    items: bank.items,
  });
  tx.objectStore("approved").put({
    studySetId,
    version: 1,
    savedAt: bank.savedAt,
    questions: [],
  });
  await txDone(tx);
}

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
  const storeNames =
    db.objectStoreNames.contains("approvedFlashcards") &&
    bank.questions.length > 0
      ? (["approved", "approvedFlashcards"] as const)
      : (["approved"] as const);
  const tx = db.transaction(storeNames, "readwrite");
  tx.objectStore("approved").put({
    studySetId,
    version: bank.version,
    savedAt: bank.savedAt,
    questions: bank.questions,
  });
  if (
    db.objectStoreNames.contains("approvedFlashcards") &&
    bank.questions.length > 0
  ) {
    tx.objectStore("approvedFlashcards").delete(studySetId);
  }
  await txDone(tx);
}

export async function putMediaBlob(
  studySetId: string,
  blob: Blob,
): Promise<string> {
  const db = await ensureStudySetDb();
  const id = createRandomUuid();
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
  return createRandomUuid();
}

/**
 * Persist meta + empty draft + document row (no PDF bytes) immediately so inline parse can start
 * without waiting for full extract, title model, or arrayBuffer persistence (Phase 27 D-09).
 */
export async function createStudySetEarlyMeta(input: {
  title: string;
  subtitle?: string;
  sourceFileName?: string;
  pageCount?: number;
  extractedText?: string;
  contentKind?: StudyContentKind;
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
    ...(input.contentKind !== undefined ? { contentKind: input.contentKind } : {}),
  };
  const doc: StudySetDocumentRecord = {
    studySetId: id,
    extractedText: input.extractedText ?? "",
    pdfFileName: input.sourceFileName,
  };
  pipelineLog("STUDY_SET", "create", "info", "createStudySetEarlyMeta", {
    studySetId: id,
    title: input.title,
    pageCount: input.pageCount,
    sourceFileName: input.sourceFileName,
    contentKind: input.contentKind,
  });
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

/**
 * Background: full text extract, optional AI title, and PDF bytes into IDB. Safe if user cancelled (no meta).
 */
export async function enrichStudySetDocumentFromLocalPdf(input: {
  studySetId: string;
  file: File;
  pageCount: number;
  titlePrefix?: string;
}): Promise<void> {
  const { studySetId, file, pageCount, titlePrefix } = input;
  const meta = await getStudySetMeta(studySetId);
  if (!meta) {
    pipelineLog("STUDY_SET", "enrich", "warn", "enrichStudySetDocumentFromLocalPdf: no meta (cancelled?)", {
      studySetId,
    });
    return;
  }
  try {
    pipelineLog("PDF", "extract-text", "info", "enrichStudySet: extractPdfText start", {
      studySetId,
      ...fileSummary(file),
      pageCount,
    });
    const extractedText = await extractPdfText(file);
    pipelineLog("PDF", "extract-text", "info", "enrichStudySet: extractPdfText done", {
      studySetId,
      extractedCharCount: extractedText.length,
    });

    let title = meta.title;
    let subtitle = meta.subtitle;
    try {
      const naming = await generateStudySetTitle(extractedText, file.name);
      title =
        titlePrefix !== undefined && titlePrefix.length > 0
          ? `${titlePrefix}${naming.title}`
          : naming.title;
      subtitle = naming.subtitle;
    } catch (raw) {
      pipelineLog("STUDY_SET", "enrich", "warn", "generateStudySetTitle failed; keeping provisional title", {
        studySetId,
        ...normalizeUnknownError(raw),
        raw,
      });
    }

    pipelineLog("PDF", "array-buffer", "info", "enrichStudySet: reading pdf arrayBuffer", {
      studySetId,
      ...fileSummary(file),
    });
    const pdfArrayBuffer = await file.arrayBuffer();
    await putDocument({
      studySetId,
      extractedText,
      pdfArrayBuffer,
      pdfFileName: file.name,
    });
    await touchStudySetMeta(studySetId, {
      title,
      subtitle,
      pageCount,
      sourceFileName: file.name,
    });
    pipelineLog("STUDY_SET", "enrich", "info", "enrichStudySetDocumentFromLocalPdf success", {
      studySetId,
    });
  } catch (raw) {
    pipelineLog("STUDY_SET", "enrich", "error", "enrichStudySetDocumentFromLocalPdf failed", {
      studySetId,
      ...normalizeUnknownError(raw),
      raw,
    });
  }
}

export async function createStudySet(input: {
  title: string;
  subtitle?: string;
  sourceFileName?: string;
  pageCount?: number;
  extractedText: string;
  pdfFile?: File | null;
  contentKind?: StudyContentKind;
}): Promise<string> {
  const id = newStudySetId();
  const now = new Date().toISOString();
  try {
    pipelineLog("STUDY_SET", "create", "info", "createStudySet start", {
      studySetId: id,
      title: input.title,
      pageCount: input.pageCount,
      sourceFileName: input.sourceFileName,
      ...fileSummary(input.pdfFile ?? undefined),
      reusedExtractedText: input.extractedText.trim().length > 0,
    });
    const meta: StudySetMeta = {
      id,
      title: input.title,
      subtitle: input.subtitle,
      createdAt: now,
      updatedAt: now,
      sourceFileName: input.sourceFileName,
      pageCount: input.pageCount ?? undefined,
      status: "draft",
      ...(input.contentKind !== undefined
        ? { contentKind: input.contentKind }
        : {}),
    };
    /** If `pdfFile` is set and `extractedText` is already non-empty, callers skip a second extract. */
    let extractedTextForDoc = input.extractedText;
    if (input.pdfFile && input.pdfFile.size > 0) {
      if (input.extractedText.trim().length > 0) {
        extractedTextForDoc = input.extractedText;
      } else {
        pipelineLog("PDF", "extract-text", "info", "createStudySet: running extractPdfText (no pre text)", {
          studySetId: id,
          ...fileSummary(input.pdfFile),
        });
        extractedTextForDoc = await extractPdfText(input.pdfFile);
      }
    }
    let pdfArrayBuffer: ArrayBuffer | undefined;
    if (input.pdfFile && input.pdfFile.size > 0) {
      pipelineLog("PDF", "array-buffer", "info", "createStudySet: reading pdf arrayBuffer for IDB", {
        studySetId: id,
        ...fileSummary(input.pdfFile),
      });
      pdfArrayBuffer = await input.pdfFile.arrayBuffer();
      pipelineLog("PDF", "array-buffer", "info", "createStudySet: pdf buffer ready", {
        studySetId: id,
        byteLength: pdfArrayBuffer.byteLength,
      });
    }
    const doc: StudySetDocumentRecord = {
      studySetId: id,
      extractedText: extractedTextForDoc,
      pdfArrayBuffer,
      pdfFileName: input.pdfFile?.name,
    };
    pipelineLog("IDB", "transaction", "info", "createStudySet: meta + document + draft transaction", {
      studySetId: id,
      extractedTextChars: extractedTextForDoc.length,
    });
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
    pipelineLog("STUDY_SET", "create", "info", "createStudySet success", {
      studySetId: id,
    });
    return id;
  } catch (raw) {
    pipelineLog("STUDY_SET", "create", "error", "createStudySet failed", {
      studySetId: id,
      ...normalizeUnknownError(raw),
      raw,
    });
    throw raw;
  }
}

export async function touchStudySetMeta(
  id: string,
  patch: Partial<
    Pick<
      StudySetMeta,
      | "title"
      | "subtitle"
      | "status"
      | "pageCount"
      | "sourceFileName"
      | "ocrProvider"
      | "ocrStatus"
      | "contentKind"
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
