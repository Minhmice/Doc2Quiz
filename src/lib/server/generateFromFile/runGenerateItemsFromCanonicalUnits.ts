import { questionStemKey } from "@/lib/ai/dedupeQuestions";
import { postChatCompletionAssistantText } from "@/lib/server/openAiChatCompletion";
import {
  computeGenerationCoverage,
  coverageWarnings,
} from "@/lib/server/generateFromFile/computeGenerationCoverage";
import { deriveGenerationSeed } from "@/lib/server/generateFromFile/generationSeed";
import {
  DEFAULT_GENERATION_TARGET_ITEMS,
  GENERATION_SCHEMA_VERSION,
} from "@/lib/server/generateFromFile/canonicalConstants";
import { parseGenerationPayload } from "@/lib/server/generateFromFile/parseAssistantJson";
import type { FlashcardGenItem, QuizGenItem } from "@/lib/server/generateFromFile/schemas";
import type { CanonicalSourceUnit } from "@/types/canonicalSource";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import type { Question } from "@/types/question";
import type { StudyContentKind } from "@/types/studySet";
import type { FlashcardVisionItem } from "@/types/visionParse";

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const DEFAULT_MAX_ITEMS = DEFAULT_GENERATION_TARGET_ITEMS;

function flashcardStemKey(front: string): string {
  return front.trim().replace(/\s+/g, " ").toLowerCase();
}

function dedupeQuestionsMergeStemAndUnits(questions: Question[]): Question[] {
  const map = new Map<string, Question>();
  const emptyMarker = "__empty_stem__";
  for (const q of questions) {
    const k = questionStemKey(q.question);
    const dedupeKey = k.length === 0 ? emptyMarker : k;
    const prev = map.get(dedupeKey);
    if (!prev) {
      map.set(dedupeKey, q);
      continue;
    }
    const mergedIds = [
      ...new Set([...prev.sourceUnitIds, ...q.sourceUnitIds]),
    ];
    map.set(dedupeKey, {
      ...prev,
      ...q,
      id: prev.id,
      sourceUnitIds: mergedIds.length > 0 ? mergedIds : prev.sourceUnitIds,
    });
  }
  return [...map.values()];
}

function dedupeFlashcardsMergeFrontAndUnits(
  items: FlashcardVisionItem[],
): FlashcardVisionItem[] {
  const map = new Map<string, FlashcardVisionItem>();
  for (const it of items) {
    const k = flashcardStemKey(it.front);
    if (k.length === 0) {
      continue;
    }
    const prev = map.get(k);
    if (!prev) {
      map.set(k, it);
      continue;
    }
    const mergedIds = [
      ...new Set([...prev.sourceUnitIds, ...it.sourceUnitIds]),
    ];
    map.set(k, {
      ...prev,
      ...it,
      id: prev.id,
      sourceUnitIds: mergedIds.length > 0 ? mergedIds : prev.sourceUnitIds,
    });
  }
  return [...map.values()];
}

function filterValidUnitRefs<T extends { sourceUnitIds: string[] }>(
  items: T[],
  allowed: Set<string>,
): T[] {
  return items.filter(
    (it) =>
      it.sourceUnitIds.length > 0 &&
      it.sourceUnitIds.every((id) => allowed.has(id)),
  );
}

function pageHintFromUnits(units: CanonicalSourceUnit[], ids: string[]): number | undefined {
  const pages: number[] = [];
  const idSet = new Set(ids);
  for (const u of units) {
    if (idSet.has(u.id)) {
      pages.push(...u.pageRefs);
    }
  }
  if (pages.length === 0) {
    return undefined;
  }
  return Math.min(...pages);
}

function mapQuizItems(units: CanonicalSourceUnit[], items: QuizGenItem[]): Question[] {
  const unitMap = new Map(units.map((u) => [u.id, u]));
  const out: Question[] = [];
  for (const it of items) {
    const su = it.sourceUnitIds;
    const pageRefs = it.pageRefs?.filter((n) => Number.isFinite(n) && n >= 1);
    const cited = su.map((id) => unitMap.get(id)).filter(Boolean);
    const q: Question = {
      id: createRandomUuid(),
      question: it.question.trim(),
      options: [
        it.options[0].trim(),
        it.options[1].trim(),
        it.options[2].trim(),
        it.options[3].trim(),
      ] as Question["options"],
      correctIndex: it.correctIndex,
      parseConfidence: it.confidence,
      parseStructureValid: true,
      sourceUnitIds: [...su],
    };
    const page =
      pageRefs && pageRefs.length > 0
        ? pageRefs[0]
        : pageHintFromUnits(units, su);
    if (page !== undefined) {
      q.sourcePageIndex = page;
    }
    if (cited.length > 0) {
      const avg =
        cited.reduce((s, u) => s + u!.confidence, 0) / cited.length;
      q.parseConfidence = Math.min(it.confidence, avg);
    }
    out.push(q);
  }
  return dedupeQuestionsMergeStemAndUnits(out);
}

function mapFlashcardItems(
  units: CanonicalSourceUnit[],
  items: FlashcardGenItem[],
): FlashcardVisionItem[] {
  const unitMap = new Map(units.map((u) => [u.id, u]));
  const mapped: FlashcardVisionItem[] = items.map((it) => {
    const su = it.sourceUnitIds;
    const cited = su.map((id) => unitMap.get(id)).filter(Boolean);
    let confidence = it.confidence;
    if (cited.length > 0) {
      const avg =
        cited.reduce((s, u) => s + u!.confidence, 0) / cited.length;
      confidence = Math.min(it.confidence, avg);
    }
    const explicitPages = it.pageRefs?.filter((n) => Number.isFinite(n) && n >= 1);
    const inferred = pageHintFromUnits(units, su);
    const pages =
      explicitPages && explicitPages.length > 0
        ? explicitPages
        : inferred !== undefined
          ? [inferred]
          : undefined;
    return {
      kind: "flashcard" as const,
      id: createRandomUuid(),
      front: it.front.trim(),
      back: it.back.trim(),
      confidence,
      sourcePages: pages,
      sourceUnitIds: [...su],
    };
  });
  return dedupeFlashcardsMergeFrontAndUnits(mapped);
}

export type GenerateFromCanonicalResult =
  | {
      ok: true;
      questions?: Question[];
      flashcards?: FlashcardVisionItem[];
      itemsCreated: number;
      lowConfidenceCount: number;
      warnings: string[];
      coverage: ReturnType<typeof computeGenerationCoverage>;
      generationSeed: number;
    }
  | { ok: false; error: string };

export async function runGenerateItemsFromCanonicalUnits(input: {
  contentKind: StudyContentKind;
  units: CanonicalSourceUnit[];
  contentSha256: string;
  sourceFileLabel: string;
  configUrl: string;
  apiKey: string;
  model: string;
  maxItems?: number;
  language?: "vi" | "en" | "auto";
  signal?: AbortSignal;
}): Promise<GenerateFromCanonicalResult> {
  const maxItems = input.maxItems ?? DEFAULT_MAX_ITEMS;
  const language = input.language ?? "auto";
  const sliceCap = Math.min(120, Math.max(1, maxItems));
  const allowedIds = new Set(input.units.map((u) => u.id));

  const lang =
    language === "auto"
      ? "Match the language of the canonical units."
      : language === "vi"
        ? "Write every field in Vietnamese."
        : "Write every field in English.";

  const unitsJson = JSON.stringify({
    sourceFile: input.sourceFileLabel,
    units: input.units,
  });

  const targetCount = sliceCap;
  const seed = deriveGenerationSeed(
    input.contentSha256,
    input.contentKind,
    GENERATION_SCHEMA_VERSION,
    targetCount,
  );

  let system: string;
  if (input.contentKind === "flashcards") {
    system = [
      "You create flashcards ONLY from the canonical units JSON in the user message.",
      lang,
      `Return ONLY JSON {"items":[...]} with at most ${targetCount} items.`,
      "Each item MUST include front, back, confidence (0..1), and sourceUnitIds (non-empty array of unit ids from the input).",
      "Do not add facts beyond what is supported by the cited units.",
      "Optional pageRefs when inferable from those units.",
    ].join("\n");
  } else {
    system = [
      "You create multiple-choice questions ONLY from the canonical units JSON in the user message.",
      lang,
      `Return ONLY JSON {"items":[...]} with at most ${targetCount} items.`,
      "Each item MUST include question, four options, correctIndex 0-3, confidence (0..1), and sourceUnitIds (non-empty).",
      "Every distractor and the stem must be grounded in the cited units — no external knowledge.",
      "Optional explanation; optional pageRefs.",
    ].join("\n");
  }

  const messagesFirst: unknown[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Canonical units (JSON). Generate ${input.contentKind === "quiz" ? "quiz questions" : "flashcards"}.\n\n${unitsJson}`,
    },
  ];

  const first = await postChatCompletionAssistantText({
    configUrl: input.configUrl,
    apiKey: input.apiKey,
    model: input.model,
    messages: messagesFirst,
    responseFormatJsonObject: true,
    temperature: 0,
    seed,
    signal: input.signal,
  });

  if (!first.ok) {
    return { ok: false, error: "Document processing is temporarily unavailable." };
  }

  let assistantRaw = first.text;

  let parsed = parseGenerationPayload(input.contentKind, assistantRaw);
  if (!parsed.ok) {
    const repairMessages: unknown[] = [
      ...messagesFirst,
      { role: "assistant", content: assistantRaw },
      {
        role: "user",
        content: `Schema validation failed (${parsed.error}). Return ONLY valid JSON with an "items" array; each item MUST include sourceUnitIds referencing ids from the canonical units.`,
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
    assistantRaw = second.text;
    parsed = parseGenerationPayload(input.contentKind, second.text);
    if (!parsed.ok) {
      return { ok: false, error: "Document processing is temporarily unavailable." };
    }
  }

  let warnings: string[] = [];

  if (parsed.kind === "quiz") {
    const filtered = filterValidUnitRefs(parsed.items, allowedIds);
    if (filtered.length < parsed.items.length) {
      warnings.push("Dropped quiz rows that cited unknown canonical unit ids.");
    }
    let qs = mapQuizItems(input.units, filtered);
    if (qs.length > sliceCap) {
      warnings.push(`Trimmed to ${sliceCap} quiz items.`);
      qs = qs.slice(0, sliceCap);
    }
    const lowConfidenceCount = qs.filter(
      (q) => (q.parseConfidence ?? 0) < LOW_CONFIDENCE_THRESHOLD,
    ).length;
    const coverage = computeGenerationCoverage({
      units: input.units,
      itemsSourceUnitIds: qs.map((q) => q.sourceUnitIds ?? []),
      itemConfidences: qs.map((q) => q.parseConfidence ?? 0),
    });
    warnings = [...warnings, ...coverageWarnings(coverage)];
    return {
      ok: true,
      questions: qs,
      itemsCreated: qs.length,
      lowConfidenceCount,
      warnings,
      coverage,
      generationSeed: seed,
    };
  }

  const filteredFc = filterValidUnitRefs(parsed.items, allowedIds);
  if (filteredFc.length < parsed.items.length) {
    warnings.push("Dropped flashcards that cited unknown canonical unit ids.");
  }
  let cards = mapFlashcardItems(input.units, filteredFc);
  if (cards.length > sliceCap) {
    warnings.push(`Trimmed to ${sliceCap} flashcards.`);
    cards = cards.slice(0, sliceCap);
  }
  const lowConfidenceCount = cards.filter(
    (c) => (c.confidence ?? 0) < LOW_CONFIDENCE_THRESHOLD,
  ).length;
  const coverage = computeGenerationCoverage({
    units: input.units,
    itemsSourceUnitIds: cards.map((c) => c.sourceUnitIds ?? []),
    itemConfidences: cards.map((c) => c.confidence ?? 0),
  });
  warnings = [...warnings, ...coverageWarnings(coverage)];

  return {
    ok: true,
    flashcards: cards,
    itemsCreated: cards.length,
    lowConfidenceCount,
    warnings,
    coverage,
    generationSeed: seed,
  };
}
