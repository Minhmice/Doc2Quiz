import { parseJsonFromModelText } from "@/lib/ai/parseChunk";
import { computeFlashcardConfidence } from "@/lib/ai/visionConfidence";
import {
  validateVisionFlashcardItems,
  type ValidateVisionFlashcardOptions,
} from "@/lib/ai/validateVisionFlashcardItems";
import type { FlashcardVisionItem } from "@/types/visionParse";

/**
 * Parse assistant JSON for flashcard mode.
 * Schema: { "cards": [ { "front", "back", "sourcePages" } ] } when strict validation is on
 * (also accepts `flashcards` array). Never use `questionsFromAssistantContent` here.
 */
export function parseVisionFlashcardResponse(
  raw: string,
  parseOpts?: ValidateVisionFlashcardOptions,
): FlashcardVisionItem[] {
  const parsed = parseJsonFromModelText(raw);
  const items = validateVisionFlashcardItems(parsed, parseOpts);
  return items.map((it) => ({
    ...it,
    confidence: computeFlashcardConfidence(it),
  }));
}
