import { describe, expect, it } from "vitest";

import {
  quizGenerateBodySchema,
  quizGeneratorOutputSchema,
} from "@/lib/pipeline/quizSchemas";

const validFixture = {
  recommended_count: 2,
  concepts: [
    {
      concept_id: "concept_001",
      label: "Cell structure",
      section_key: "sec_001",
      importance: "high" as const,
    },
    {
      concept_id: "concept_002",
      label: "Cell division",
      section_key: "sec_002",
      importance: "medium" as const,
    },
  ],
  questions: [
    {
      concept_id: "concept_001",
      prompt: "What is the basic unit of life?",
      choices: ["Cell", "Atom", "Molecule", "Organ"],
      correct_index: 0 as const,
      explanation: "Cells are the basic unit of life per canonical text.",
      section_key: "sec_001",
      source_excerpt: "Cells are the basic unit of life.",
      fact_ids: ["fact_001"],
      semantic_intent: "identify_definition",
      answer_text: "Cell",
    },
    {
      concept_id: "concept_002",
      prompt: "Which process produces two daughter cells?",
      choices: ["Mitosis", "Photosynthesis", "Digestion", "Respiration"],
      correct_index: 0 as const,
      explanation: "Mitosis divides a cell into two daughter cells.",
      section_key: "sec_002",
      source_excerpt: "Mitosis divides a cell into two daughter cells.",
      fact_ids: ["fact_002"],
      semantic_intent: "match_property",
      answer_text: "Mitosis",
    },
  ],
  warnings: [],
};

describe("quizGenerateBodySchema", () => {
  it("accepts { questionCount: 12 }", () => {
    const result = quizGenerateBodySchema.safeParse({ questionCount: 12 });
    expect(result.success).toBe(true);
  });

  it("accepts empty body (optional questionCount)", () => {
    const result = quizGenerateBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects questionCount 0", () => {
    const result = quizGenerateBodySchema.safeParse({ questionCount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects questionCount 41", () => {
    const result = quizGenerateBodySchema.safeParse({ questionCount: 41 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer questionCount", () => {
    const result = quizGenerateBodySchema.safeParse({ questionCount: 12.5 });
    expect(result.success).toBe(false);
  });
});

describe("quizGeneratorOutputSchema", () => {
  it("accepts valid fixture with concepts[] and questions[]", () => {
    const result = quizGeneratorOutputSchema.safeParse(validFixture);
    expect(result.success).toBe(true);
  });

  it("accepts long prompts and choices when their structure is valid", () => {
    const result = quizGeneratorOutputSchema.safeParse({
      ...validFixture,
      questions: [{
        ...validFixture.questions[0],
        prompt:
          `Read the complete case context. ${"Every condition remains relevant. ".repeat(20)}` +
          "Which conclusion follows?",
        choices: [
          `The complete supported conclusion ${"with all required detail ".repeat(12)}`,
          `A first alternative conclusion ${"with comparable detail ".repeat(12)}`,
          `A second alternative conclusion ${"with comparable detail ".repeat(12)}`,
          `A third alternative conclusion ${"with comparable detail ".repeat(12)}`,
        ],
      }],
    });

    expect(result.success).toBe(true);
  });

  it("validates recommended_count int 1–40", () => {
    const valid = quizGeneratorOutputSchema.safeParse(validFixture);
    expect(valid.success).toBe(true);

    const tooLow = quizGeneratorOutputSchema.safeParse({
      ...validFixture,
      recommended_count: 0,
    });
    expect(tooLow.success).toBe(false);

    const tooHigh = quizGeneratorOutputSchema.safeParse({
      ...validFixture,
      recommended_count: 41,
    });
    expect(tooHigh.success).toBe(false);
  });

  it("rejects choices.length !== 4", () => {
    const result = quizGeneratorOutputSchema.safeParse({
      ...validFixture,
      questions: [
        {
          ...validFixture.questions[0],
          choices: ["A", "B", "C"],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects correct_index outside 0–3", () => {
    const result = quizGeneratorOutputSchema.safeParse({
      ...validFixture,
      questions: [
        {
          ...validFixture.questions[0],
          correct_index: 4,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts concept_001 pattern for concept_id", () => {
    const result = quizGeneratorOutputSchema.safeParse(validFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.concepts[0]?.concept_id).toBe("concept_001");
    }
  });

  it("rejects invalid concept_id pattern", () => {
    const result = quizGeneratorOutputSchema.safeParse({
      ...validFixture,
      concepts: [
        {
          ...validFixture.concepts[0],
          concept_id: "concept-1",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
