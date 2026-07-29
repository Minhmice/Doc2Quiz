import type {
  FlashcardGeneratorOutput,
  GeneratedFlashcard,
  flashcardAmountSchema,
} from "@/lib/pipeline/flashcardSchemas";
import type { z } from "zod";

type FlashcardAmount = z.infer<typeof flashcardAmountSchema>;

const MAX_FLASHCARDS = 60;
const LIMITED_CONTENT_WARNING = "Limited content";

export type FlashcardFormat =
  | "term_definition"
  | "question_answer"
  | "cloze"
  | "mixed";

export type DedupeAndCapFlashcardsResult = {
  cards: GeneratedFlashcard[];
  recommendedCount: number;
  generatedCount: number;
  detectedFormat: FlashcardFormat;
  warnings: string[];
};

export function resolveDominantFormat(
  cards: GeneratedFlashcard[],
): FlashcardFormat {
  const counts = new Map<FlashcardFormat, number>();

  for (const card of cards) {
    const format = card.format ?? "mixed";
    counts.set(format, (counts.get(format) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return "mixed";
  }

  let topFormat: FlashcardFormat = "mixed";
  let topCount = 0;
  let tie = false;

  for (const [format, count] of counts) {
    if (count > topCount) {
      topCount = count;
      topFormat = format;
      tie = false;
    } else if (count === topCount) {
      tie = true;
    }
  }

  return tie ? "mixed" : topFormat;
}

export function dedupeAndCapFlashcards(
  output: FlashcardGeneratorOutput,
  amount: FlashcardAmount,
): DedupeAndCapFlashcardsResult {
  const seenConcepts = new Set<string>();
  const uniqueConcepts = output.concepts.filter((concept) => {
    const key = concept.concept_id.toLowerCase();
    if (seenConcepts.has(key)) {
      return false;
    }
    seenConcepts.add(key);
    return true;
  });

  const byConcept = new Map<string, GeneratedFlashcard>();
  for (const card of output.cards) {
    if (!card.concept_id) {
      continue;
    }
    const key = card.concept_id.toLowerCase();
    if (!byConcept.has(key)) {
      byConcept.set(key, card);
    }
  }

  const customCount =
    amount === "recommended" ? undefined : amount.count;

  let recommendedCount =
    customCount ?? output.recommended_count;
  const warnings = [...output.warnings];

  if (uniqueConcepts.length < 3) {
    recommendedCount = Math.min(recommendedCount, uniqueConcepts.length);
  }

  const maxAllowed = Math.min(
    recommendedCount,
    uniqueConcepts.length,
    output.cards.length,
    customCount ?? Number.POSITIVE_INFINITY,
    MAX_FLASHCARDS,
  );

  const cards = uniqueConcepts
    .slice(0, maxAllowed)
    .map((concept) => byConcept.get(concept.concept_id.toLowerCase()))
    .filter((card): card is GeneratedFlashcard => card != null);

  const generatedCount = cards.length;
  const detectedFormat = resolveDominantFormat(cards);

  if (uniqueConcepts.length < 3 || generatedCount < recommendedCount) {
    if (!warnings.includes(LIMITED_CONTENT_WARNING)) {
      warnings.push(LIMITED_CONTENT_WARNING);
    }
  }

  return {
    cards,
    recommendedCount,
    generatedCount,
    detectedFormat,
    warnings,
  };
}
