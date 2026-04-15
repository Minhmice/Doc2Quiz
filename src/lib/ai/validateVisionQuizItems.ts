import { stripLeadingChoiceLabel } from "@/lib/ai/sanitizeMcqOptionText";
import type { QuizVisionItem } from "@/types/visionParse";

export type ValidateVisionPageBounds = {
  minPage: number;
  maxPage: number;
};

export type ValidateVisionQuizOptions = {
  /** When true, each row must include `sourcePages` (1-based PDF indices). */
  requireSourcePages?: boolean;
  /** If set with `requireSourcePages`, every page index must lie in this inclusive range. */
  pageBounds?: ValidateVisionPageBounds;
};

function readSourcePages(
  rec: Record<string, unknown>,
  opts: ValidateVisionQuizOptions | undefined,
): number[] | null {
  if (!opts?.requireSourcePages) {
    return null;
  }
  const sp = rec.sourcePages;
  if (!Array.isArray(sp) || sp.length === 0) {
    return null;
  }
  const pages: number[] = [];
  for (const x of sp) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1) {
      return null;
    }
    pages.push(x);
  }
  if (opts.pageBounds) {
    const { minPage, maxPage } = opts.pageBounds;
    if (!pages.every((p) => p >= minPage && p <= maxPage)) {
      return null;
    }
  }
  return pages;
}

function isCorrectIndex(n: unknown): n is 0 | 1 | 2 | 3 {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= 0 &&
    n <= 3
  );
}

/**
 * Validate quiz vision items.
 * Strict schema: question (string), options (4 strings), correctIndex (0-3),
 *                confidence, sourcePages.
 * Do not coerce flashcards or summaries into quiz items.
 *
 * Rows that are flashcard-shaped (e.g. have `front`/`back` keys but lack
 * `question`/`options`/`correctIndex`) are silently dropped — they will never
 * be coerced into quiz output.
 */
export function validateVisionQuizItems(
  raw: unknown[],
  opts?: ValidateVisionQuizOptions,
): QuizVisionItem[] {
  const out: QuizVisionItem[] = [];
  for (const item of raw) {
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
    const strippedOptions = options.map((o) =>
      stripLeadingChoiceLabel(typeof o === "string" ? o : ""),
    ) as [string, string, string, string];
    if (!strippedOptions.every((o) => o.length > 0)) {
      continue;
    }
    if (!isCorrectIndex(correctIndex)) {
      continue;
    }
    const sourcePages = readSourcePages(rec, opts);
    if (opts?.requireSourcePages && sourcePages === null) {
      continue;
    }
    const ipi = rec.includePageImage;
    const includePageImage =
      typeof ipi === "boolean" ? ipi : undefined;
    out.push({
      kind: "quiz",
      question: question.trim(),
      options: strippedOptions,
      correctIndex,
      confidence: 0,
      ...(sourcePages !== null ? { sourcePages } : {}),
      ...(includePageImage === false ? { includePageImage: false } : {}),
    });
  }
  return out;
}
