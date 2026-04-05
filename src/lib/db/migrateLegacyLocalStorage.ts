import {
  LS_APPROVED_BANK,
  LS_DRAFT_QUESTIONS,
  type ApprovedBank,
  type Question,
} from "@/types/question";
import type { StudySetDocumentRecord, StudySetMeta } from "@/types/studySet";
import { LS_IDB_MIGRATED } from "@/types/studySet";
import { validateQuestionsFromJson } from "@/lib/ai/validateQuestions";
import { isApprovedBankShape } from "@/lib/review/approvedBank";

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IDB transaction aborted"));
  });
}

/**
 * One-time copy of legacy localStorage draft/bank into IndexedDB as a single study set.
 */
export async function migrateLegacyLocalStorage(db: IDBDatabase): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  if (localStorage.getItem(LS_IDB_MIGRATED) === "1") {
    return;
  }

  let draftQs: Question[] = [];
  try {
    const raw = localStorage.getItem(LS_DRAFT_QUESTIONS);
    if (raw) {
      const data = JSON.parse(raw) as { questions?: unknown };
      draftQs = validateQuestionsFromJson(
        { questions: data.questions },
        { preserveIds: true },
      );
    }
  } catch {
    draftQs = [];
  }

  let bank: ApprovedBank | null = null;
  try {
    const raw = localStorage.getItem(LS_APPROVED_BANK);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      bank = isApprovedBankShape(parsed) ? parsed : null;
    }
  } catch {
    bank = null;
  }

  if (draftQs.length === 0 && !bank) {
    localStorage.setItem(LS_IDB_MIGRATED, "1");
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const meta: StudySetMeta = {
    id,
    title: "Imported (migrated)",
    createdAt: now,
    updatedAt: now,
    status: bank ? "ready" : "draft",
  };
  const doc: StudySetDocumentRecord = {
    studySetId: id,
    extractedText: "",
  };

  const tx = db.transaction(
    ["meta", "document", "draft", "approved"],
    "readwrite",
  );
  tx.objectStore("meta").put(meta);
  tx.objectStore("document").put(doc);
  tx.objectStore("draft").put({
    studySetId: id,
    savedAt: now,
    questions: draftQs,
  });
  if (bank) {
    tx.objectStore("approved").put({
      studySetId: id,
      version: bank.version,
      savedAt: bank.savedAt,
      questions: bank.questions,
    });
  }
  await txDone(tx);

  try {
    localStorage.removeItem(LS_DRAFT_QUESTIONS);
    localStorage.removeItem(LS_APPROVED_BANK);
  } catch {
    /* ignore */
  }
  localStorage.setItem(LS_IDB_MIGRATED, "1");
}
