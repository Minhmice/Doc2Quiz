import { readFile } from "node:fs/promises";
import path from "node:path";

export type QuizPromptSpec = {
  name: string;
  version: string;
  system: string;
  input: Record<string, string>;
  tasks: string[];
  output_schema: Record<string, unknown>;
  constraints: string[];
};

let cached: QuizPromptSpec | null = null;

export let QUIZ_PROMPT_VERSION = "";

export async function loadQuizPrompt(): Promise<QuizPromptSpec> {
  if (cached) {
    return cached;
  }

  const filePath = path.join(process.cwd(), "prompt", "quiz_generator_v1.json");
  const raw = await readFile(filePath, "utf8");
  cached = JSON.parse(raw) as QuizPromptSpec;
  QUIZ_PROMPT_VERSION = cached.version;
  return cached;
}

export function substituteQuizInput(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

function buildSystemPrompt(spec: QuizPromptSpec): string {
  return [
    spec.system,
    "",
    "Tasks:",
    ...spec.tasks.map((task, index) => `${index + 1}. ${task}`),
    "",
    "Constraints:",
    ...spec.constraints.map((constraint) => `- ${constraint}`),
    "",
    "Return JSON matching this schema exactly:",
    JSON.stringify(spec.output_schema, null, 2),
  ].join("\n");
}

export function buildQuizGeneratorMessages(
  spec: QuizPromptSpec,
  vars: Record<string, string>,
): { system: string; user: string } {
  const substitutedInput = Object.fromEntries(
    Object.entries(spec.input).map(([key, template]) => [
      key,
      substituteQuizInput(template, vars),
    ]),
  );

  return {
    system: buildSystemPrompt(spec),
    user: JSON.stringify(substitutedInput),
  };
}
