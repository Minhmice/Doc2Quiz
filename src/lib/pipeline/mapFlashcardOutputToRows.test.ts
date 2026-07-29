import { describe, expect, it, vi } from "vitest";

import type { GeneratedFlashcard } from "@/lib/pipeline/flashcardSchemas";

import {
  mapFlashcardOutputToRows,
  mapGeneratedCardToRow,
} from "./mapFlashcardOutputToRows";

vi.mock("@/lib/ids/createRandomUuid", () => ({
  createRandomUuid: vi
    .fn()
    .mockReturnValueOnce("uuid-1")
    .mockReturnValueOnce("uuid-2"),
}));

const sampleCard: GeneratedFlashcard = {
  concept_id: "concept_001",
  front: "Photosynthesis",
  back: "Process plants use to convert light to energy",
  format: "term_definition",
  section_key: "sec_001",
  source_excerpt: "Plants use sunlight...",
};

describe("mapGeneratedCardToRow", () => {
  it("maps LLM card fields to approved_flashcards insert shape", () => {
    const row = mapGeneratedCardToRow(sampleCard, {
      id: "row-id-1",
      userId: "user-1",
      studySetId: "set-1",
      promptVersion: "1.0",
      detectedFormat: "term_definition",
      learningGoal: "memorize",
    });

    expect(row).toMatchObject({
      id: "row-id-1",
      user_id: "user-1",
      study_set_id: "set-1",
      front: sampleCard.front,
      back: sampleCard.back,
      tags: ["concept_001"],
      source: {
        concept_id: "concept_001",
        section_key: "sec_001",
        source_excerpt: "Plants use sunlight...",
        format: "term_definition",
        detected_format: "term_definition",
        learning_goal: "memorize",
        prompt_version: "1.0",
        generated_at: expect.any(String),
      },
    });
  });

  it("uses empty tags when concept_id is missing", () => {
    const row = mapGeneratedCardToRow(
      { front: "Q", back: "A" },
      {
        id: "row-id-2",
        userId: "user-1",
        studySetId: "set-1",
        promptVersion: "1.0",
        detectedFormat: "mixed",
        learningGoal: "understand",
      },
    );

    expect(row.tags).toEqual([]);
    expect(row.source.concept_id).toBeUndefined();
  });
});

describe("mapFlashcardOutputToRows", () => {
  it("assigns server UUIDs for each card row", () => {
    const rows = mapFlashcardOutputToRows(
      [sampleCard, { ...sampleCard, concept_id: "concept_002", front: "Mitosis" }],
      {
        userId: "user-1",
        studySetId: "set-1",
        promptVersion: "1.0",
        detectedFormat: "term_definition",
        learningGoal: "exam_preparation",
      },
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe("uuid-1");
    expect(rows[1]?.id).toBe("uuid-2");
    expect(rows[0]?.tags).toEqual(["concept_001"]);
    expect(rows[1]?.tags).toEqual(["concept_002"]);
    expect(rows[0]?.source.learning_goal).toBe("exam_preparation");
  });
});
