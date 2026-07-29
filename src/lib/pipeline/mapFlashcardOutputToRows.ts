import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import type { GeneratedFlashcard } from "@/lib/pipeline/flashcardSchemas";

import type { FlashcardFormat } from "./dedupeAndCapFlashcards";

export type ApprovedFlashcardInsertRow = {
  id: string;
  user_id: string;
  study_set_id: string;
  front: string;
  back: string;
  tags: string[];
  source: {
    concept_id?: string;
    section_key?: string;
    source_excerpt?: string;
    format?: string;
    detected_format: FlashcardFormat;
    learning_goal: string;
    prompt_version: string;
    generated_at: string;
  };
};

export function mapGeneratedCardToRow(
  card: GeneratedFlashcard,
  meta: {
    id: string;
    userId: string;
    studySetId: string;
    promptVersion: string;
    detectedFormat: FlashcardFormat;
    learningGoal: string;
  },
): ApprovedFlashcardInsertRow {
  return {
    id: meta.id,
    user_id: meta.userId,
    study_set_id: meta.studySetId,
    front: card.front,
    back: card.back,
    tags: card.concept_id ? [card.concept_id] : [],
    source: {
      concept_id: card.concept_id,
      section_key: card.section_key,
      source_excerpt: card.source_excerpt,
      format: card.format,
      detected_format: meta.detectedFormat,
      learning_goal: meta.learningGoal,
      prompt_version: meta.promptVersion,
      generated_at: new Date().toISOString(),
    },
  };
}

export function mapFlashcardOutputToRows(
  cards: GeneratedFlashcard[],
  meta: {
    userId: string;
    studySetId: string;
    promptVersion: string;
    detectedFormat: FlashcardFormat;
    learningGoal: string;
  },
): ApprovedFlashcardInsertRow[] {
  return cards.map((card) =>
    mapGeneratedCardToRow(card, {
      id: createRandomUuid(),
      userId: meta.userId,
      studySetId: meta.studySetId,
      promptVersion: meta.promptVersion,
      detectedFormat: meta.detectedFormat,
      learningGoal: meta.learningGoal,
    }),
  );
}
