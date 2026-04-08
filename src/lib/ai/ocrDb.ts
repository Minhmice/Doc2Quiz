import { ensureStudySetDb } from "@/lib/db/studySetDb";
import {
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import type { OcrRunResult } from "@/types/ocr";

/** Store OCR result for a study set. */
export async function putOcrResult(
  studySetId: string,
  result: OcrRunResult,
): Promise<void> {
  pipelineLog("IDB", "ocr-put", "info", "putOcrResult start", {
    studySetId,
    pageRows: result.pages.length,
    version: result.version,
  });
  try {
    const db = await ensureStudySetDb();
    const tx = db.transaction("ocr", "readwrite");
    tx.objectStore("ocr").put({
      studySetId,
      ...result,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("putOcrResult failed"));
      tx.onabort = () =>
        reject(tx.error ?? new Error("putOcrResult aborted"));
    });
    pipelineLog("IDB", "ocr-put", "info", "putOcrResult success", {
      studySetId,
    });
  } catch (raw) {
    pipelineLog("IDB", "ocr-put", "error", "putOcrResult failed", {
      studySetId,
      ...normalizeUnknownError(raw),
      raw,
    });
    throw raw;
  }
}

/** Retrieve OCR result for a study set, or undefined if not yet run. */
export async function getOcrResult(
  studySetId: string,
): Promise<OcrRunResult | undefined> {
  const db = await ensureStudySetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("ocr", "readonly");
    const req = tx.objectStore("ocr").get(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as ({ studySetId: string } & OcrRunResult) | undefined;
      if (!row) {
        resolve(undefined);
        return;
      }
      const { studySetId: rowStudySetId, ...ocrResult } = row;
      void rowStudySetId;
      resolve(ocrResult as OcrRunResult);
    };
  });
}

/** Delete OCR result for a study set. */
export async function deleteOcrResult(studySetId: string): Promise<void> {
  const db = await ensureStudySetDb();
  const tx = db.transaction("ocr", "readwrite");
  tx.objectStore("ocr").delete(studySetId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("deleteOcrResult failed"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("deleteOcrResult aborted"));
  });
}
