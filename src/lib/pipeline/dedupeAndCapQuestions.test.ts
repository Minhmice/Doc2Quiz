import { describe, expect, it } from "vitest";

import type { QuizGeneratorOutput } from "@/lib/pipeline/quizSchemas";

import { dedupeAndCapQuestions } from "./dedupeAndCapQuestions";

function makeQuestion(conceptId: string, promptSuffix = "") {
  return {
    concept_id: conceptId,
    prompt: `What is concept ${conceptId}${promptSuffix}?`.padEnd(12, "."),
    choices: ["A", "B", "C", "D"] as [string, string, string, string],
    correct_index: 0 as const,
    explanation: "Because canonical text says so.",
    section_key: "sec_001",
    source_excerpt: "A excerpt",
    fact_ids: ["fact_001"],
    semantic_intent: "supported_statement" as const,
    answer_text: "A",
  };
}

function makeOutput(
  overrides: Partial<QuizGeneratorOutput> = {},
): QuizGeneratorOutput {
  return {
    recommended_count: 5,
    concepts: [
      { concept_id: "concept_001", label: "One", section_key: "sec_001" },
      { concept_id: "concept_002", label: "Two", section_key: "sec_001" },
      { concept_id: "concept_003", label: "Three", section_key: "sec_001" },
      { concept_id: "concept_004", label: "Four", section_key: "sec_001" },
      { concept_id: "concept_005", label: "Five", section_key: "sec_001" },
    ],
    questions: [
      makeQuestion("concept_001"),
      makeQuestion("concept_002"),
      makeQuestion("concept_003"),
      makeQuestion("concept_004"),
      makeQuestion("concept_005"),
    ],
    warnings: [],
    ...overrides,
  };
}

describe("dedupeAndCapQuestions", () => {
  it("keeps different questions that share a concept_id", () => {
    const output = makeOutput({
      concepts: [
        { concept_id: "concept_001", label: "One", section_key: "sec_001" },
        { concept_id: "CONCEPT_001", label: "Dup", section_key: "sec_001" },
        { concept_id: "concept_002", label: "Two", section_key: "sec_001" },
      ],
      questions: [
        makeQuestion("concept_001", " first"),
        makeQuestion("CONCEPT_001", " dup"),
        makeQuestion("concept_002"),
      ],
      recommended_count: 3,
    });

    const result = dedupeAndCapQuestions(output);

    expect(result.generatedCount).toBe(3);
    expect(result.questions.map((q) => q.concept_id)).toEqual([
      "concept_001",
      "concept_002",
      "CONCEPT_001",
    ]);
    expect(result.questions[0]?.prompt).toContain("first");
  });

  it("keeps forty different questions across six concepts", () => {
    const concepts = Array.from({ length: 6 }, (_, index) => ({
      concept_id: `concept_${String(index + 1).padStart(3, "0")}`,
      label: `Concept ${index + 1}`,
      section_key: "sec_001",
    }));
    const questions = Array.from({ length: 40 }, (_, index) =>
      makeQuestion(
        concepts[index % concepts.length]!.concept_id,
        ` variant ${index + 1}`,
      ),
    );
    const output = makeOutput({
      recommended_count: 40,
      concepts,
      questions,
    });

    const result = dedupeAndCapQuestions(output, 40);

    expect(result.recommendedCount).toBe(40);
    expect(result.generatedCount).toBe(40);
  });

  it("applies questionCountOverride as an upper bound", () => {
    const output = makeOutput({ recommended_count: 5 });

    const result = dedupeAndCapQuestions(output, 2);

    expect(result.recommendedCount).toBe(2);
    expect(result.generatedCount).toBe(2);
    expect(result.questions).toHaveLength(2);
  });

  it("never exceeds forty questions", () => {
    const concepts = Array.from({ length: 45 }, (_, i) => ({
      concept_id: `concept_${String(i + 1).padStart(3, "0")}` as const,
      label: `Concept ${i + 1}`,
      section_key: "sec_001",
    }));
    const questions = concepts.map((c) => makeQuestion(c.concept_id));

    const result = dedupeAndCapQuestions({
      recommended_count: 45,
      concepts,
      questions,
      warnings: [],
    });

    expect(result.generatedCount).toBe(40);
  });

  it("reports the actual count without inventing a content-limit reason", () => {
    const output = makeOutput({
      recommended_count: 5,
      concepts: [
        { concept_id: "concept_001", label: "One", section_key: "sec_001" },
        { concept_id: "concept_002", label: "Two", section_key: "sec_001" },
      ],
      questions: [makeQuestion("concept_001"), makeQuestion("concept_002")],
    });

    const result = dedupeAndCapQuestions(output, 5);

    expect(result.generatedCount).toBe(2);
    expect(result.recommendedCount).toBe(5);
    expect(result.warnings).not.toContain("Limited testable content");
  });

  it("deduplicates normalized prompt and choices even across concepts", () => {
    const first = makeQuestion("concept_001");
    const duplicate = {
      ...first,
      concept_id: "concept_002",
      prompt: first.prompt.toLocaleUpperCase().replace("?", " ? "),
      choices: ["D", "C", "B", "A"] as [string, string, string, string],
    };

    const result = dedupeAndCapQuestions(
      makeOutput({
        recommended_count: 2,
        questions: [first, duplicate],
      }),
      2,
    );

    expect(result.generatedCount).toBe(1);
  });
});
