import { describe, it, expect } from "vitest";
import { checkCanonical, checkQuiz, checkFlashcard } from "./faithfulness";

describe("faithfulness checks", () => {
  describe("checkCanonical", () => {
    const baseInput = () => ({
      title: "Cell Biology",
      filename: "cell-biology.md",
      canonical_markdown: "# Cell Biology\n\nMitochondria produce ATP.",
      raw_markdown: "# Cell Biology\n\nMitochondria produce ATP.",
      sections: [{ id: "sec_001", title: "Cell Biology", content: "Mitochondria produce ATP." }],
      extracted_questions: [],
    });

    it("passes valid input", () => {
      const result = checkCanonical(baseInput());
      expect(result.ok).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it("warns on invented title", () => {
      const input = { ...baseInput(), title: "Quantum Physics" };
      const result = checkCanonical(input);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("may be invented");
    });

    it("warns on bad filename", () => {
      const input = { ...baseInput(), filename: "Cell Biology.txt" };
      const result = checkCanonical(input);
      expect(result.warnings.some(w => w.includes(".md"))).toBe(true);
    });

    it("warns on non-sequential section IDs", () => {
      const input = { ...baseInput(), sections: [{ id: "sec_005", title: "X", content: "Y" }] };
      const result = checkCanonical(input);
      expect(result.warnings.some(w => w.includes("Non-sequential"))).toBe(true);
    });

    it("warns on orphan section_id in extracted_questions", () => {
      const input = { ...baseInput(), extracted_questions: [{ section_id: "sec_999" }] };
      const result = checkCanonical(input);
      expect(result.warnings.some(w => w.includes("Orphan"))).toBe(true);
    });
  });

  describe("checkQuiz", () => {
    const baseInput = () => ({
      canonical_markdown: "content",
      concepts: [{ concept_id: "c1", section_key: "sec_001" }],
      questions: [{ concept_id: "c1", prompt: "Q?", choices: ["A", "B"], explanation: "Because" }],
      validSectionKeys: ["sec_001"],
    });

    it("passes valid input", () => {
      const result = checkQuiz(baseInput());
      expect(result.ok).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it("warns on invalid section_key", () => {
      const input = { ...baseInput(), concepts: [{ concept_id: "c1", section_key: "sec_999" }] };
      const result = checkQuiz(input);
      expect(result.warnings.some(w => w.includes("invalid section_key"))).toBe(true);
    });

    it("warns on duplicate choices", () => {
      const input = { ...baseInput(), questions: [{ concept_id: "c1", prompt: "Q?", choices: ["A", "a", "B"] }] };
      const result = checkQuiz(input);
      expect(result.warnings.some(w => w.includes("Duplicate choices"))).toBe(true);
    });

    it("warns on missing explanation", () => {
      const input = { ...baseInput(), questions: [{ concept_id: "c1", prompt: "Q?", choices: ["A", "B"], explanation: "" }] };
      const result = checkQuiz(input);
      expect(result.warnings.some(w => w.includes("Missing explanation"))).toBe(true);
    });
  });

  describe("checkFlashcard", () => {
    const baseInput = () => ({
      concepts: [{ concept_id: "c1", section_key: "sec_001" }],
      cards: [{ front: "What is ATP?", back: "Energy molecule" }],
      validSectionKeys: ["sec_001"],
    });

    it("passes valid input", () => {
      const result = checkFlashcard(baseInput());
      expect(result.ok).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it("warns on identical front/back", () => {
      const input = { ...baseInput(), cards: [{ front: "ATP", back: "ATP" }] };
      const result = checkFlashcard(input);
      expect(result.warnings.some(w => w.includes("Identical front/back"))).toBe(true);
    });

    it("warns on invalid section_key in concept", () => {
      const input = { ...baseInput(), concepts: [{ concept_id: "c1", section_key: "sec_999" }] };
      const result = checkFlashcard(input);
      expect(result.warnings.some(w => w.includes("invalid section_key"))).toBe(true);
    });
  });
});
