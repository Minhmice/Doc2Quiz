import { readFile } from "node:fs/promises";
import path from "node:path";

export type CanonicalPromptSpec = {
  name: string;
  version: string;
  system: string;
  input: Record<string, string>;
  tasks: string[];
  output_schema: Record<string, unknown>;
  constraints: string[];
};

let cached: CanonicalPromptSpec | null = null;

export let CANONICAL_PROMPT_VERSION = "";

export async function loadCanonicalPrompt(): Promise<CanonicalPromptSpec> {
  if (cached) {
    return cached;
  }

  const filePath = path.join(process.cwd(), "prompt", "canonical_builder_v1.json");
  const raw = await readFile(filePath, "utf8");
  cached = JSON.parse(raw) as CanonicalPromptSpec;
  CANONICAL_PROMPT_VERSION = cached.version;
  return cached;
}

export function substituteTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

function buildSystemPrompt(spec: CanonicalPromptSpec): string {
  return [
    spec.system,
    "",
    "Tasks:",
    ...spec.tasks.map((task, index) => `${index + 1}. ${task}`),
    "",
    "Constraints:",
    ...spec.constraints.map((constraint) => `- ${constraint}`),
    "",
    "Return one JSON object with: title, filename (.md), language, document_type, topics, " +
      "canonical_markdown, sections (sec_NNN ids), extracted_questions, atomic_facts (fact_NNN ids), " +
      "source_readiness, max_supported_count, warnings.",
  ].join("\n");
}

export function buildCanonicalMessages(
  spec: CanonicalPromptSpec,
  vars: Record<string, string>,
): { system: string; user: string } {
  const substitutedInput = Object.fromEntries(
    Object.entries(spec.input).map(([key, template]) => [
      key,
      substituteTemplate(template, vars),
    ]),
  );

  return {
    system: buildSystemPrompt(spec),
    user: JSON.stringify(substitutedInput),
  };
}
