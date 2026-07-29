import { describe, expect, it } from "vitest";

import { canonicalBuilderOutputSchema } from "@/lib/pipeline/canonicalSchemas";

const validFixture = {
  title: "Introduction to Biology",
  filename: "intro-biology.md",
  language: "en",
  document_type: "theory" as const,
  topics: ["cells", "organisms"],
  canonical_markdown: "# Introduction\n\nCells are the basic unit of life.",
  sections: [
    {
      id: "sec_001",
      title: "Introduction",
      content: "Cells are the basic unit of life.",
      content_type: "theory" as const,
    },
  ],
  extracted_questions: [
    {
      question: "What is the basic unit of life?",
      options: ["Cell", "Atom", "Molecule", "Organ"],
      answer: null,
      section_id: "sec_001",
    },
  ],
  atomic_facts: [
    {
      fact_id: "fact_001",
      section_key: "sec_001",
      statement: "Cells are the basic unit of life.",
      source_excerpt: "Cells are the basic unit of life.",
      answer_text: "Cells",
      fact_type: "definition" as const,
      entities: ["Cells"],
      conditions: [],
      question_opportunities: ["identify_definition" as const],
      answerable: true,
    },
  ],
  source_readiness: { pass: true, reasons: [] },
  max_supported_count: 1,
  warnings: [],
};

const groundedFixture = {
  ...validFixture,
};

describe("canonicalBuilderOutputSchema", () => {
  it("accepts valid fixture matching output_schema shape", () => {
    const result = canonicalBuilderOutputSchema.safeParse(validFixture);
    expect(result.success).toBe(true);
  });

  it("rejects empty canonical_markdown", () => {
    const result = canonicalBuilderOutputSchema.safeParse({
      ...validFixture,
      canonical_markdown: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid document_type", () => {
    const result = canonicalBuilderOutputSchema.safeParse({
      ...validFixture,
      document_type: "textbook",
    });
    expect(result.success).toBe(false);
  });

  it("rejects section id not matching sec_NNN pattern", () => {
    const result = canonicalBuilderOutputSchema.safeParse({
      ...validFixture,
      sections: [
        {
          ...validFixture.sections[0],
          id: "section-1",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("validates section content_type enum", () => {
    const valid = canonicalBuilderOutputSchema.safeParse(validFixture);
    expect(valid.success).toBe(true);

    const invalid = canonicalBuilderOutputSchema.safeParse({
      ...validFixture,
      sections: [
        {
          ...validFixture.sections[0],
          content_type: "summary",
        },
      ],
    });
    expect(invalid.success).toBe(false);
  });

  it("accepts null answer in extracted_questions", () => {
    const result = canonicalBuilderOutputSchema.safeParse(validFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.extracted_questions[0]?.answer).toBeNull();
    }
  });

  it("rejects empty sections array", () => {
    const result = canonicalBuilderOutputSchema.safeParse({
      ...validFixture,
      sections: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a grounded atomic-fact artifact with exact capacity", () => {
    expect(canonicalBuilderOutputSchema.safeParse(groundedFixture).success).toBe(
      true,
    );
  });

  it("accepts complete long-form evidence and answers without truncation", () => {
    const answer = `A complete supported answer ${"with necessary detail ".repeat(20)}`.trim();
    const excerpt =
      `The complete relation is ${answer}. ` +
      "Additional source context preserves every condition and exception. ".repeat(20);
    const result = canonicalBuilderOutputSchema.safeParse({
      ...groundedFixture,
      canonical_markdown: excerpt,
      sections: [{
        ...groundedFixture.sections[0],
        content: excerpt,
      }],
      atomic_facts: [{
        ...groundedFixture.atomic_facts[0],
        statement: `The complete relation is ${answer}.`,
        source_excerpt: excerpt,
        answer_text: answer,
      }],
    });

    expect(excerpt.length).toBeGreaterThan(900);
    expect(answer.length).toBeGreaterThan(180);
    expect(result.success).toBe(true);
  });

  it("rejects a non-exact fact excerpt or answer span", () => {
    const invalid = {
      ...groundedFixture,
      atomic_facts: [
        {
          ...groundedFixture.atomic_facts[0],
          source_excerpt: "Paraphrased cell fact.",
        },
      ],
    };
    expect(canonicalBuilderOutputSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects declared capacity that differs from fact opportunities", () => {
    expect(
      canonicalBuilderOutputSchema.safeParse({
        ...groundedFixture,
        max_supported_count: 2,
      }).success,
    ).toBe(false);
  });

  it("rejects inflated semantic opportunities for a fact type", () => {
    expect(
      canonicalBuilderOutputSchema.safeParse({
        ...groundedFixture,
        atomic_facts: [
          {
            ...groundedFixture.atomic_facts[0],
            question_opportunities: ["direct_calculation"],
          },
        ],
      }).success,
    ).toBe(false);
  });
});
