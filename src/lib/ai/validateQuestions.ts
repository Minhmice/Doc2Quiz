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

/**
 * Validates model JSON (top-level `{ questions: [...] }` or a raw array per D-12)
 * and returns only well-formed MCQs with new ids.
 */
export function validateQuestionsFromJson(raw: unknown): Question[] {
  const items = extractQuestionsArray(raw);
  const out: Question[] = [];

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

    out.push({
      id: crypto.randomUUID(),
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
