import type { ApprovedBank, Question } from "@/types/question";
import { LS_APPROVED_BANK } from "@/types/question";
import { allMcqsComplete, isMcqComplete } from "@/lib/review/validateMcq";

function isApprovedBankShape(raw: unknown): raw is ApprovedBank {
  if (raw === null || typeof raw !== "object") {
    return false;
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) {
    return false;
  }
  if (typeof o.savedAt !== "string" || o.savedAt.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(o.questions)) {
    return false;
  }
  const qs = o.questions as unknown[];
  return qs.every((item): item is Question => {
    if (item === null || typeof item !== "object") {
      return false;
    }
    const q = item as Question;
    return (
      typeof q.id === "string" &&
      q.id.trim().length > 0 &&
      isMcqComplete(q)
    );
  });
}

export function loadApprovedBank(): ApprovedBank | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(LS_APPROVED_BANK);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isApprovedBankShape(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveApprovedBank(questions: Question[]): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (!allMcqsComplete(questions)) {
    return false;
  }
  const payload: ApprovedBank = {
    version: 1,
    savedAt: new Date().toISOString(),
    questions,
  };
  try {
    localStorage.setItem(LS_APPROVED_BANK, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
