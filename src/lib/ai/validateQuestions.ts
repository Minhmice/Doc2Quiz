import type { Question } from "@/types/question";

function extractQuestionsArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw !== null && typeof raw === "object" && "questions" in raw) {
    const q = (raw as { questions: unknown }).questions;
    if (Array.isArray(q)) {
      return q;
    }
  }
  return [];
}

export type ValidateQuestionsOptions = {
  /** When true, reuse `id` from each item if it is a non-empty string (draft round-trip). */
  preserveIds?: boolean;
};

/**
 * Validates model JSON (top-level `{ questions: [...] }` or a raw array per D-12)
 * and returns only well-formed MCQs with new ids unless `preserveIds` is set for draft load.
 */
export function validateQuestionsFromJson(
  raw: unknown,
  options?: ValidateQuestionsOptions,
): Question[] {
  const items = extractQuestionsArray(raw);
  const out: Question[] = [];
  const preserveIds = options?.preserveIds === true;

  for (const item of items) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const question = rec.question;
    const options = rec.options;
    const correctIndex = rec.correctIndex;

    if (typeof question !== "string" || question.trim().length === 0) {
      continue;
    }
    if (!Array.isArray(options) || options.length !== 4) {
      continue;
    }
    if (
      !options.every(
        (o): o is string => typeof o === "string" && o.trim().length > 0,
      )
    ) {
      continue;
    }
    if (
      typeof correctIndex !== "number" ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex > 3
    ) {
      continue;
    }

    const existingId = rec.id;
    const id =
      preserveIds &&
      typeof existingId === "string" &&
      existingId.trim().length > 0
        ? existingId.trim()
        : crypto.randomUUID();

    out.push({
      id,
      question: question.trim(),
      options: [
        (options[0] as string).trim(),
        (options[1] as string).trim(),
        (options[2] as string).trim(),
        (options[3] as string).trim(),
      ] as [string, string, string, string],
      correctIndex: correctIndex as 0 | 1 | 2 | 3,
    });
  }

  return out;
}
