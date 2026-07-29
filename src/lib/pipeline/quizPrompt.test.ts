import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildQuizGeneratorMessages,
  loadQuizPrompt,
  QUIZ_PROMPT_VERSION,
  substituteQuizInput,
} from "@/lib/pipeline/quizPrompt";

const mockPromptSpec = {
  name: "quiz_generator",
  version: "1.0",
  system:
    "Generate multiple-choice questions from canonical knowledge only.",
  input: {
    study_set_id: "{{study_set_id}}",
    title: "{{title}}",
    language: "{{language}}",
    canonical_markdown: "{{canonical_markdown}}",
    sections_json: "{{sections_json}}",
    extracted_questions_json: "{{extracted_questions_json}}",
    requested_count: "{{requested_count}}",
  },
  tasks: [
    "Identify distinct testable concepts from the canonical knowledge.",
    "Recommend an appropriate question count based on content depth.",
  ],
  output_schema: {
    recommended_count: "number",
    concepts: [],
    questions: [],
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

describe("loadQuizPrompt", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns version 1.0 from quiz_generator_v1.json", async () => {
    const spec = await loadQuizPrompt();
    expect(spec.version).toBe("1.0");
    expect(spec.name).toBe("quiz_generator");
  });

  it("exports QUIZ_PROMPT_VERSION from loaded spec", async () => {
    await loadQuizPrompt();
    expect(QUIZ_PROMPT_VERSION).toBe("1.0");
  });
});

describe("substituteQuizInput", () => {
  it("replaces template variables", () => {
    const result = substituteQuizInput(
      "id={{study_set_id}} md={{canonical_markdown}} count={{requested_count}}",
      {
        study_set_id: "set-42",
        canonical_markdown: "# Biology",
        requested_count: "12",
      },
    );
    expect(result).toBe("id=set-42 md=# Biology count=12");
  });

  it("replaces unknown keys with empty string", () => {
    const result = substituteQuizInput("{{missing}}", {});
    expect(result).toBe("");
  });
});

describe("buildQuizGeneratorMessages", () => {
  it("assembles system from spec without hardcoded prompt text", async () => {
    const spec = await loadQuizPrompt();
    const vars = {
      study_set_id: "study-1",
      title: "Intro Biology",
      language: "en",
      canonical_markdown: "# Cells\n\nCells are the basic unit of life.",
      sections_json: JSON.stringify([{ id: "sec_001", title: "Cells" }]),
      extracted_questions_json: "[]",
      requested_count: "10",
    };

    const { system, user } = buildQuizGeneratorMessages(spec, vars);

    expect(system).toContain(spec.system);
    expect(system).toContain("Tasks:");
    expect(system).toContain("1. Identify distinct testable concepts");
    expect(system).toContain("Constraints:");
    expect(system).toContain("- Canonical knowledge only");
    expect(system).toContain("Return JSON matching this schema exactly:");

    const parsedUser = JSON.parse(user) as Record<string, string>;
    expect(parsedUser.study_set_id).toBe("study-1");
    expect(parsedUser.title).toBe("Intro Biology");
    expect(parsedUser.canonical_markdown).toBe(
      "# Cells\n\nCells are the basic unit of life.",
    );
    expect(parsedUser.sections_json).toBe(
      JSON.stringify([{ id: "sec_001", title: "Cells" }]),
    );
    expect(parsedUser.requested_count).toBe("10");
    expect(parsedUser).not.toHaveProperty("raw_markdown");
  });
});
