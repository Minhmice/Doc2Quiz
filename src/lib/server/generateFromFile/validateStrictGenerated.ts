import { questionStemKey } from "@/lib/ai/dedupeQuestions";
import type { Question } from "@/types/question";
import type { FlashcardVisionItem } from "@/types/visionParse";

function isEmpty(s: string | undefined): boolean {
  return s == null || s.trim().length === 0;
}

/**
 * Post-parse validation: required fields, structure, duplicates, confidence.
 * Run after Zod + mapping; use before persisting draft.
 */
export function validateStrictQuizQuestions(
  questions: Question[],
): { ok: true } | { ok: false; error: string } {
  const stems = new Set<string>();
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    if (isEmpty(q.question)) {
      return { ok: false, error: `Quiz item ${i}: empty question` };
    }
    if (!q.options || q.options.length !== 4) {
      return { ok: false, error: `Quiz item ${i}: require exactly 4 options` };
    }
    for (let j = 0; j < 4; j++) {
      if (isEmpty(q.options[j])) {
        return { ok: false, error: `Quiz item ${i}: empty option ${j}` };
      }
    }
    if (q.correctIndex < 0 || q.correctIndex > 3) {
      return { ok: false, error: `Quiz item ${i}: correctIndex must be 0–3` };
    }
    const conf = q.parseConfidence;
    if (typeof conf !== "number" || !Number.isFinite(conf) || conf < 0 || conf > 1) {
      return { ok: false, error: `Quiz item ${i}: confidence must be a number 0..1` };
    }
    const stem = questionStemKey(q.question);
    if (stem.length > 0 && stems.has(stem)) {
      return { ok: false, error: `Duplicate question stem at index ${i}` };
    }
    if (stem.length > 0) {
      stems.add(stem);
    }
    if (!Array.isArray(q.sourceUnitIds) || q.sourceUnitIds.length === 0) {
      return {
        ok: false,
        error: `Quiz item ${i}: sourceUnitIds must cite at least one canonical unit`,
      };
    }
  }
  return { ok: true };
}

export function validateStrictFlashcards(
  items: FlashcardVisionItem[],
): { ok: true } | { ok: false; error: string } {
  const fronts = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const c = items[i]!;
    if (isEmpty(c.front)) {
      return { ok: false, error: `Card ${i}: empty front` };
    }
    if (isEmpty(c.back)) {
      return { ok: false, error: `Card ${i}: empty back` };
    }
    const conf = c.confidence;
    if (typeof conf !== "number" || !Number.isFinite(conf) || conf < 0 || conf > 1) {
      return { ok: false, error: `Card ${i}: confidence must be a number 0..1` };
    }
    const k = c.front.trim().replace(/\s+/g, " ").toLowerCase();
    if (k.length > 0 && fronts.has(k)) {
      return { ok: false, error: `Duplicate card front at index ${i}` };
    }
    if (k.length > 0) {
      fronts.add(k);
    }
    if (!Array.isArray(c.sourceUnitIds) || c.sourceUnitIds.length === 0) {
      return {
        ok: false,
        error: `Card ${i}: sourceUnitIds must cite at least one canonical unit`,
      };
    }
  }
  return { ok: true };
}
