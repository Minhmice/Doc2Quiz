import { describe, expect, it } from "vitest";

import {
  flashcardGenerateBodySchema,
  flashcardGeneratorOutputSchema,
} from "@/lib/pipeline/flashcardSchemas";

const validOutputFixture = {
  detected_format: "term_definition" as const,
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
  cards: [
    {
      front: "What is the basic unit of life?",
      back: "The cell",
      format: "term_definition" as const,
      concept_id: "concept_001",
      section_key: "sec_001",
      source_excerpt: "Cells are the basic unit of life.",
    },
    {
      front: "Which process produces two daughter cells?",
      back: "Mitosis",
      concept_id: "concept_002",
    },
  ],
  warnings: [],
};

describe("flashcardGenerateBodySchema", () => {
  it("accepts valid wizard payload with entire_document and recommended", () => {
    const result = flashcardGenerateBodySchema.safeParse({
      learningGoal: "memorize",
      coverage: "entire_document",
      amount: "recommended",
    });
    expect(result.success).toBe(true);
  });

  it("accepts selected_sections with sectionKeys", () => {
    const result = flashcardGenerateBodySchema.safeParse({
      learningGoal: "understand",
      coverage: { sectionKeys: ["sec_001", "sec_002"] },
      amount: { count: 12 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts exam_preparation learning goal", () => {
    const result = flashcardGenerateBodySchema.safeParse({
      learningGoal: "exam_preparation",
      coverage: "entire_document",
      amount: { count: 5 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid learningGoal", () => {
    const result = flashcardGenerateBodySchema.safeParse({
      learningGoal: "quick_recall",
      coverage: "entire_document",
      amount: "recommended",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty sectionKeys", () => {
    const result = flashcardGenerateBodySchema.safeParse({
      learningGoal: "memorize",
      coverage: { sectionKeys: [] },
      amount: "recommended",
    });
    expect(result.success).toBe(false);
  });

  it("rejects custom count 4", () => {
    const result = flashcardGenerateBodySchema.safeParse({
      learningGoal: "memorize",
      coverage: "entire_document",
      amount: { count: 4 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects custom count 61", () => {
    const result = flashcardGenerateBodySchema.safeParse({
      learningGoal: "memorize",
      coverage: "entire_document",
      amount: { count: 61 },
    });
    expect(result.success).toBe(false);
  });
});

describe("flashcardGeneratorOutputSchema", () => {
  it("accepts valid fixture with detected_format and cards[]", () => {
    const result = flashcardGeneratorOutputSchema.safeParse(validOutputFixture);
    expect(result.success).toBe(true);
  });

  it("rejects empty front", () => {
    const result = flashcardGeneratorOutputSchema.safeParse({
      ...validOutputFixture,
      cards: [{ ...validOutputFixture.cards[0], front: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty back", () => {
    const result = flashcardGeneratorOutputSchema.safeParse({
      ...validOutputFixture,
      cards: [{ ...validOutputFixture.cards[0], back: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid detected_format enum", () => {
    const result = flashcardGeneratorOutputSchema.safeParse({
      ...validOutputFixture,
      detected_format: "quick_recall",
    });
    expect(result.success).toBe(false);
  });

  it("accepts concept_001 pattern for concept_id", () => {
    const result = flashcardGeneratorOutputSchema.safeParse(validOutputFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.concepts[0]?.concept_id).toBe("concept_001");
    }
  });

  it("rejects invalid concept_id pattern", () => {
    const result = flashcardGeneratorOutputSchema.safeParse({
      ...validOutputFixture,
      concepts: [
        {
          ...validOutputFixture.concepts[0],
          concept_id: "concept-1",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts sec_001 pattern for section_key", () => {
    const result = flashcardGeneratorOutputSchema.safeParse(validOutputFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cards[0]?.section_key).toBe("sec_001");
    }
  });

  it("rejects invalid section_key pattern on cards", () => {
    const result = flashcardGeneratorOutputSchema.safeParse({
      ...validOutputFixture,
      cards: [
        {
          ...validOutputFixture.cards[0],
          section_key: "section-1",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
