import { parseJsonFromModelText } from "@/lib/ai/parseChunk";
import { computeQuizConfidence } from "@/lib/ai/visionConfidence";
import {
  validateVisionQuizItems,
  type ValidateVisionQuizOptions,
} from "@/lib/ai/validateVisionQuizItems";
import type { QuizVisionItem } from "@/types/visionParse";

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

/** Parse assistant JSON text into quiz vision items (not `Question` rows). */
export function parseVisionQuizResponse(
  raw: string,
  parseOpts?: ValidateVisionQuizOptions,
): QuizVisionItem[] {
  const parsed = parseJsonFromModelText(raw);
  const rows = extractQuestionsArray(parsed);
  const items = validateVisionQuizItems(rows, parseOpts);
  return items.map((it) => ({
    ...it,
    confidence: computeQuizConfidence(it),
  }));
}
