import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCanonicalMessages,
  CANONICAL_PROMPT_VERSION,
  loadCanonicalPrompt,
  substituteTemplate,
} from "@/lib/pipeline/canonicalPrompt";

const mockPromptSpec = {
  name: "canonical_knowledge_builder",
  version: "1.0",
  system: "Transform extracted Markdown into reusable canonical knowledge.",
  input: {
    source_id: "{{source_id}}",
    source_type: "{{source_type}}",
    original_filename: "{{original_filename}}",
    raw_markdown: "{{raw_markdown}}",
  },
  tasks: ["Remove extraction noise.", "Preserve factual content."],
  output_schema: {
    title: "string",
    filename: "string.md",
    language: "string",
    document_type: "theory | exam | mixed",
    topics: ["string"],
    canonical_markdown: "string",
    sections: [],
    extracted_questions: [],
    warnings: ["string"],
  },
  constraints: ["No invented facts.", "Return JSON matching the schema exactly."],
};

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => JSON.stringify(mockPromptSpec)),
}));

describe("loadCanonicalPrompt", () => {
  it("returns version 1.0 from canonical_builder_v1.json", async () => {
    const spec = await loadCanonicalPrompt();
    expect(spec.version).toBe("1.0");
    expect(spec.name).toBe("canonical_knowledge_builder");
  });

  it("exports CANONICAL_PROMPT_VERSION from loaded spec", async () => {
    await loadCanonicalPrompt();
    expect(CANONICAL_PROMPT_VERSION).toBe("1.0");
  });
});

describe("substituteTemplate", () => {
  it("replaces template variables", () => {
    const result = substituteTemplate(
      "id={{source_id}} type={{source_type}} file={{original_filename}} md={{raw_markdown}}",
      {
        source_id: "abc-123",
        source_type: "paste",
        original_filename: "notes.md",
        raw_markdown: "# Hello",
      },
    );
    expect(result).toBe("id=abc-123 type=paste file=notes.md md=# Hello");
  });

  it("replaces unknown keys with empty string", () => {
    const result = substituteTemplate("{{missing}}", {});
    expect(result).toBe("");
  });
});

describe("buildCanonicalMessages", () => {
  it("assembles system from spec without hardcoded prompt text", async () => {
    const spec = await loadCanonicalPrompt();
    const vars = {
      source_id: "study-1",
      source_type: "file",
      original_filename: "lecture.pdf",
      raw_markdown: "# Title\n\nContent here.",
    };

    const { system, user } = buildCanonicalMessages(spec, vars);

    expect(system).toContain(spec.system);
    expect(system).toContain("Tasks:");
    expect(system).toContain("1. Remove extraction noise.");
    expect(system).toContain("Constraints:");
    expect(system).toContain("- No invented facts.");
    expect(system).toContain("Return one JSON object with:");

    const parsedUser = JSON.parse(user) as Record<string, string>;
    expect(parsedUser.source_id).toBe("study-1");
    expect(parsedUser.source_type).toBe("file");
    expect(parsedUser.original_filename).toBe("lecture.pdf");
    expect(parsedUser.raw_markdown).toBe("# Title\n\nContent here.");
  });
});
