import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildFlashcardGeneratorMessages,
  loadFlashcardPrompt,
  FLASHCARD_PROMPT_VERSION,
  substituteFlashcardInput,
} from "@/lib/pipeline/flashcardPrompt";

const mockPromptSpec = {
  name: "flashcard_generator",
  version: "1.0",
  system:
    "Generate flashcards from canonical knowledge only.",
  input: {
    study_set_id: "{{study_set_id}}",
    title: "{{title}}",
    language: "{{language}}",
    learning_goal: "{{learning_goal}}",
    canonical_markdown: "{{canonical_markdown}}",
    sections_json: "{{sections_json}}",
    extracted_questions_json: "{{extracted_questions_json}}",
    requested_count: "{{requested_count}}",
    coverage_mode: "{{coverage_mode}}",
  },
  tasks: [
    "Detect the best card format for this content.",
    "Identify distinct learnable concepts from the canonical knowledge.",
  ],
  output_schema: {
    detected_format: "term_definition | question_answer | cloze | mixed",
    recommended_count: "number",
    concepts: [],
    cards: [],
    warnings: ["string"],
  },
  constraints: [
    "Canonical knowledge only — no raw_markdown, no original file, no external facts.",
    "Return JSON matching the schema exactly.",
  ],
};

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => JSON.stringify(mockPromptSpec)),
}));

describe("loadFlashcardPrompt", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns version 1.0 from flashcard_generator_v1.json", async () => {
    const spec = await loadFlashcardPrompt();
    expect(spec.version).toBe("1.0");
    expect(spec.name).toBe("flashcard_generator");
  });

  it("exports FLASHCARD_PROMPT_VERSION from loaded spec", async () => {
    await loadFlashcardPrompt();
    expect(FLASHCARD_PROMPT_VERSION).toBe("1.0");
  });
});

describe("substituteFlashcardInput", () => {
  it("replaces template variables", () => {
    const result = substituteFlashcardInput(
      "id={{study_set_id}} goal={{learning_goal}} md={{canonical_markdown}}",
      {
        study_set_id: "set-42",
        learning_goal: "memorize",
        canonical_markdown: "# Biology",
      },
    );
    expect(result).toBe("id=set-42 goal=memorize md=# Biology");
  });

  it("replaces unknown keys with empty string", () => {
    const result = substituteFlashcardInput("{{missing}}", {});
    expect(result).toBe("");
  });
});

describe("buildFlashcardGeneratorMessages", () => {
  it("assembles system from spec without hardcoded prompt text", async () => {
    const spec = await loadFlashcardPrompt();
    const vars = {
      study_set_id: "study-1",
      title: "Intro Biology",
      language: "en",
      learning_goal: "memorize",
      canonical_markdown: "# Cells\n\nCells are the basic unit of life.",
      sections_json: JSON.stringify([{ id: "sec_001", title: "Cells" }]),
      extracted_questions_json: "[]",
      requested_count: "10",
      coverage_mode: "entire_document",
    };

    const { system, user } = buildFlashcardGeneratorMessages(spec, vars);

    expect(system).toContain(spec.system);
    expect(system).toContain("Tasks:");
    expect(system).toContain("1. Detect the best card format");
    expect(system).toContain("Constraints:");
    expect(system).toContain("- Canonical knowledge only");
    expect(system).toContain("Return JSON matching this schema exactly:");

    const parsedUser = JSON.parse(user) as Record<string, string>;
    expect(parsedUser.study_set_id).toBe("study-1");
    expect(parsedUser.title).toBe("Intro Biology");
    expect(parsedUser.learning_goal).toBe("memorize");
    expect(parsedUser.canonical_markdown).toBe(
      "# Cells\n\nCells are the basic unit of life.",
    );
    expect(parsedUser.sections_json).toBe(
      JSON.stringify([{ id: "sec_001", title: "Cells" }]),
    );
    expect(parsedUser.requested_count).toBe("10");
    expect(parsedUser.coverage_mode).toBe("entire_document");
    expect(parsedUser).not.toHaveProperty("raw_markdown");
  });
});
