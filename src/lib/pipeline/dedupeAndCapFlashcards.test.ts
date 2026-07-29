import { describe, expect, it } from "vitest";

import type {
  FlashcardGeneratorOutput,
  GeneratedFlashcard,
} from "@/lib/pipeline/flashcardSchemas";

import {
  dedupeAndCapFlashcards,
  resolveDominantFormat,
} from "./dedupeAndCapFlashcards";

function makeCard(
  conceptId: string,
  format: GeneratedFlashcard["format"] = "term_definition",
  suffix = "",
): GeneratedFlashcard {
  return {
    concept_id: conceptId,
    front: `Front ${conceptId}${suffix}`,
    back: `Back ${conceptId}${suffix}`,
    format,
    section_key: "sec_001",
    source_excerpt: "excerpt",
  };
}

function makeOutput(
  overrides: Partial<FlashcardGeneratorOutput> = {},
): FlashcardGeneratorOutput {
  return {
    detected_format: "term_definition",
    recommended_count: 5,
    concepts: [
      { concept_id: "concept_001", label: "One" },
      { concept_id: "concept_002", label: "Two" },
      { concept_id: "concept_003", label: "Three" },
      { concept_id: "concept_004", label: "Four" },
      { concept_id: "concept_005", label: "Five" },
    ],
    cards: [
      makeCard("concept_001"),
      makeCard("concept_002"),
      makeCard("concept_003"),
      makeCard("concept_004"),
      makeCard("concept_005"),
    ],
    warnings: [],
    ...overrides,
  };
}

describe("resolveDominantFormat", () => {
  it("returns plurality format from per-card format values", () => {
    const cards = [
      makeCard("concept_001", "term_definition"),
      makeCard("concept_002", "term_definition"),
      makeCard("concept_003", "question_answer"),
    ];

    expect(resolveDominantFormat(cards)).toBe("term_definition");
  });

  it("returns mixed when top format counts tie", () => {
    const cards = [
      makeCard("concept_001", "term_definition"),
      makeCard("concept_002", "question_answer"),
    ];

    expect(resolveDominantFormat(cards)).toBe("mixed");
  });

  it("returns mixed when cards have no format", () => {
    const cards = [
      { front: "A", back: "B", concept_id: "concept_001" },
      { front: "C", back: "D", concept_id: "concept_002" },
    ];

    expect(resolveDominantFormat(cards)).toBe("mixed");
  });
});

describe("dedupeAndCapFlashcards", () => {
  it("removes duplicate concept_id entries case-insensitively", () => {
    const output = makeOutput({
      concepts: [
        { concept_id: "concept_001", label: "One" },
        { concept_id: "CONCEPT_001", label: "Dup" },
        { concept_id: "concept_002", label: "Two" },
      ],
      cards: [
        makeCard("concept_001", "term_definition", " first"),
        makeCard("CONCEPT_001", "term_definition", " dup"),
        makeCard("concept_002"),
      ],
      recommended_count: 3,
    });

    const result = dedupeAndCapFlashcards(output, "recommended");

    expect(result.generatedCount).toBe(2);
    expect(result.cards.map((c) => c.concept_id)).toEqual([
      "concept_001",
      "concept_002",
    ]);
    expect(result.cards[0]?.front).toContain("first");
  });

  it("caps recommended count when unique concepts are fewer than three", () => {
    const output = makeOutput({
      recommended_count: 10,
      concepts: [
        { concept_id: "concept_001", label: "One" },
        { concept_id: "concept_002", label: "Two" },
      ],
      cards: [makeCard("concept_001"), makeCard("concept_002")],
    });

    const result = dedupeAndCapFlashcards(output, "recommended");

    expect(result.recommendedCount).toBe(2);
    expect(result.generatedCount).toBe(2);
    expect(result.warnings).toContain("Limited content");
  });

  it("applies custom amount as an upper bound", () => {
    const output = makeOutput({ recommended_count: 5 });

    const result = dedupeAndCapFlashcards(output, { count: 2 });

    expect(result.recommendedCount).toBe(2);
    expect(result.generatedCount).toBe(2);
    expect(result.cards).toHaveLength(2);
  });

  it("never exceeds sixty cards", () => {
    const concepts = Array.from({ length: 65 }, (_, i) => ({
      concept_id: `concept_${String(i + 1).padStart(3, "0")}` as const,
      label: `Concept ${i + 1}`,
    }));
    const cards = concepts.map((c) => makeCard(c.concept_id));

    const result = dedupeAndCapFlashcards(
      {
        detected_format: "term_definition",
        recommended_count: 65,
        concepts,
        cards,
        warnings: [],
      },
      "recommended",
    );

    expect(result.generatedCount).toBe(60);
  });

  it("adds limited content warning when generated count is below recommended", () => {
    const output = makeOutput({
      recommended_count: 5,
      concepts: [
        { concept_id: "concept_001", label: "One" },
        { concept_id: "concept_002", label: "Two" },
      ],
      cards: [makeCard("concept_001"), makeCard("concept_002")],
    });

    const result = dedupeAndCapFlashcards(output, { count: 5 });

    expect(result.generatedCount).toBe(2);
    expect(result.recommendedCount).toBe(2);
    expect(result.warnings).toContain("Limited content");
  });

  it("uses LLM recommended_count when amount is recommended", () => {
    const output = makeOutput({ recommended_count: 4 });

    const result = dedupeAndCapFlashcards(output, "recommended");

    expect(result.recommendedCount).toBe(4);
    expect(result.generatedCount).toBe(4);
  });

  it("aggregates detected format from final cards", () => {
    const output = makeOutput({
      recommended_count: 3,
      concepts: [
        { concept_id: "concept_001", label: "One" },
        { concept_id: "concept_002", label: "Two" },
        { concept_id: "concept_003", label: "Three" },
      ],
      cards: [
        makeCard("concept_001", "cloze"),
        makeCard("concept_002", "cloze"),
        makeCard("concept_003", "term_definition"),
      ],
    });

    const result = dedupeAndCapFlashcards(output, "recommended");

    expect(result.detectedFormat).toBe("cloze");
  });
});
