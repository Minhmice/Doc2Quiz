import { postChatCompletionAssistantText } from "@/lib/server/openAiChatCompletion";
import {
  EXTRACTION_TEXT_BUDGET_CHARS,
  MAX_CANONICAL_UNITS,
} from "@/lib/server/generateFromFile/canonicalConstants";
import {
  canonicalExtractionPayloadSchema,
  sortAndAssignCanonicalIds,
} from "@/lib/server/generateFromFile/canonicalUnitSchemas";
import { deriveExtractionSeed } from "@/lib/server/generateFromFile/generationSeed";
import type { CanonicalSourceUnit } from "@/types/canonicalSource";

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  return t;
}

function buildExtractionSystemPrompt(maxUnits: number): string {
  return [
    "You segment a document into canonical learning units for downstream quiz and flashcard generation.",
    "Return ONLY valid JSON: {\"units\":[...]} — no markdown fences, no commentary.",
    `Produce between 1 and ${maxUnits} units. Merge trivial sentences; split distinct concepts.`,
    "Each unit MUST include:",
    "- pageRefs: number[] (1-based PDF page indices that support this unit)",
    "- sourceText: verbatim or tightly quoted passage from the document for this unit",
    "- concept: short title for the idea",
    "- facts: string[] of atomic statements grounded ONLY in sourceText",
    "- difficulty: easy | medium | hard",
    "- confidence: number 0..1 for how well the unit is supported by the document",
    "Optional: formulas (math/chem lines), terms (vocabulary).",
    "Do not invent facts not grounded in the supplied document text.",
  ].join("\n");
}

export type ExtractCanonicalSourceUnitsResult =
  | { ok: true; units: CanonicalSourceUnit[] }
  | { ok: false; error: string };

export async function extractCanonicalSourceUnits(input: {
  documentText: string;
  sourceFileLabel: string;
  contentSha256: string;
  configUrl: string;
  apiKey: string;
  model: string;
  signal?: AbortSignal;
}): Promise<ExtractCanonicalSourceUnitsResult> {
  let body = input.documentText.trim();
  let truncatedNote = "";
  if (body.length > EXTRACTION_TEXT_BUDGET_CHARS) {
    body = body.slice(0, EXTRACTION_TEXT_BUDGET_CHARS);
    truncatedNote = "(Document text was truncated for processing.)";
  }

  const userContent = [
    `Filename: ${input.sourceFileLabel}`,
    truncatedNote,
    "---",
    body,
  ]
    .filter(Boolean)
    .join("\n");

  const seed = deriveExtractionSeed(input.contentSha256);
  const messages: unknown[] = [
    { role: "system", content: buildExtractionSystemPrompt(MAX_CANONICAL_UNITS) },
    { role: "user", content: userContent },
  ];

  const first = await postChatCompletionAssistantText({
    configUrl: input.configUrl,
    apiKey: input.apiKey,
    model: input.model,
    messages,
    responseFormatJsonObject: true,
    temperature: 0,
    seed,
    signal: input.signal,
  });

  if (!first.ok) {
    return { ok: false, error: "Document processing is temporarily unavailable." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripJsonFence(first.text));
  } catch {
    return { ok: false, error: "Document processing is temporarily unavailable." };
  }

  let parsed = canonicalExtractionPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const repairMessages: unknown[] = [
      ...messages,
      { role: "assistant", content: first.text },
      {
        role: "user",
        content: `Invalid schema (${parsed.error.message}). Return ONLY JSON {"units":[...]} matching the contract with no markdown.`,
      },
    ];
    const second = await postChatCompletionAssistantText({
      configUrl: input.configUrl,
      apiKey: input.apiKey,
      model: input.model,
      messages: repairMessages,
      responseFormatJsonObject: true,
      temperature: 0,
      seed,
      signal: input.signal,
    });
    if (!second.ok) {
      return { ok: false, error: "Document processing is temporarily unavailable." };
    }
    try {
      parsedJson = JSON.parse(stripJsonFence(second.text));
    } catch {
      return { ok: false, error: "Document processing is temporarily unavailable." };
    }
    parsed = canonicalExtractionPayloadSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return { ok: false, error: "Document processing is temporarily unavailable." };
    }
  }

  const capped = parsed.data.units.slice(0, MAX_CANONICAL_UNITS);
  const units = sortAndAssignCanonicalIds(input.contentSha256, capped);
  return { ok: true, units };
}
