import { describe, expect, it, vi } from "vitest";

import type { GeneratedQuestion } from "@/lib/pipeline/quizSchemas";

import {
  mapGeneratedQuestionToRow,
  mapQuizOutputToRows,
} from "./mapQuizOutputToRows";

vi.mock("@/lib/ids/createRandomUuid", () => ({
  createRandomUuid: vi
    .fn()
    .mockReturnValueOnce("uuid-1")
    .mockReturnValueOnce("uuid-2"),
}));

const sampleQuestion: GeneratedQuestion = {
  concept_id: "concept_001",
  prompt: "What is photosynthesis?",
  choices: ["A", "B", "C", "D"],
  correct_index: 2,
  explanation: "Plants convert light to energy.",
  section_key: "sec_001",
  source_excerpt: "Plants use sunlight...",
  fact_ids: ["fact_001"],
  semantic_intent: "match_property",
  answer_text: "Chlorophyll",
};

describe("mapGeneratedQuestionToRow", () => {
  it("maps LLM question fields to approved_questions insert shape", () => {
    const row = mapGeneratedQuestionToRow(sampleQuestion, {
      id: "row-id-1",
      userId: "user-1",
      studySetId: "set-1",
      promptVersion: "1.0",
    });

    expect(row).toMatchObject({
      id: "row-id-1",
      user_id: "user-1",
      study_set_id: "set-1",
      prompt: sampleQuestion.prompt,
      choices: sampleQuestion.choices,
      correct_index: 2,
      explanation: sampleQuestion.explanation,
      tags: ["concept_001"],
      source: {
        concept_id: "concept_001",
        section_key: "sec_001",
        source_excerpt: "Plants use sunlight...",
        prompt_version: "1.0",
        generated_at: expect.any(String),
      },
    });
    expect(row.choices).toHaveLength(4);
  });
});

describe("mapQuizOutputToRows", () => {
  it("assigns server UUIDs for each question row", () => {
    const rows = mapQuizOutputToRows(
      [sampleQuestion, { ...sampleQuestion, concept_id: "concept_002" }],
      {
        userId: "user-1",
        studySetId: "set-1",
        promptVersion: "1.0",
      },
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe("uuid-1");
    expect(rows[1]?.id).toBe("uuid-2");
    expect(rows[0]?.tags).toEqual(["concept_001"]);
    expect(rows[1]?.tags).toEqual(["concept_002"]);
  });
});
