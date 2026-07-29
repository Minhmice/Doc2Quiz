import type { SupabaseClient, User } from "@supabase/supabase-js";

import { stripJsonFence } from "@/lib/pipeline/canonicalize";
import { GENERATOR_LLM_CANONICAL_MARKDOWN_MAX_CHARS } from "@/lib/pipeline/rawMarkdownLimit";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import { dedupeAndCapFlashcards } from "@/lib/pipeline/dedupeAndCapFlashcards";
import { mapFlashcardOutputToRows } from "@/lib/pipeline/mapFlashcardOutputToRows";
import {
  buildFlashcardGeneratorMessages,
  loadFlashcardPrompt,
  FLASHCARD_PROMPT_VERSION,
} from "@/lib/pipeline/flashcardPrompt";
import {
  flashcardGeneratorOutputSchema,
  type FlashcardGenerateBody,
  type FlashcardGeneratorOutput,
} from "@/lib/pipeline/flashcardSchemas";
import { checkFlashcard } from "@/lib/pipeline/faithfulness";
import {
  getAiProcessingConfig,
  isAiProcessingConfigured,
} from "@/lib/server/ai-processing-config";
import { postChatCompletionAssistantText } from "@/lib/server/openAiChatCompletion";
import { formatUpstreamAiError } from "@/lib/server/formatUpstreamAiError";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

const CANONICAL_MARKDOWN_MAX_CHARS = GENERATOR_LLM_CANONICAL_MARKDOWN_MAX_CHARS;

const PIPELINE_STAGES = [
  "input",
  "raw",
  "canonical",
  "mode_selected",
  "quiz",
  "flashcards",
] as const;

export class FlashcardGenerateValidationError extends Error {
  readonly name = "FlashcardGenerateValidationError";
}

export class FlashcardGenerateError extends Error {
  readonly name = "FlashcardGenerateError";
  readonly statusCode: number;

  constructor(message: string, statusCode = 422) {
    super(message);
    this.statusCode = statusCode;
  }
}

export type FlashcardGenerateSuccess = {
  ok: true;
  recommendedCount: number;
  generatedCount: number;
  detectedFormat: "term_definition" | "question_answer" | "cloze" | "mixed";
  cardIds: string[];
};

type CanonicalMetadata = Record<string, unknown> & {
  extracted_questions?: unknown[];
  language?: string;
};

type CanonicalSection = {
  ordinal: number;
  heading: string;
  body_markdown: string;
  section_key: string;
};

function isAtLeastPipelineStage(
  stage: string,
  minimum: (typeof PIPELINE_STAGES)[number],
): boolean {
  const stageIndex = PIPELINE_STAGES.indexOf(
    stage as (typeof PIPELINE_STAGES)[number],
  );
  const minimumIndex = PIPELINE_STAGES.indexOf(minimum);
  if (stageIndex < 0) {
    return false;
  }
  return stageIndex >= minimumIndex;
}

function truncateCanonicalMarkdown(canonicalMarkdown: string): {
  markdown: string;
  warnings: string[];
} {
  if (canonicalMarkdown.length <= CANONICAL_MARKDOWN_MAX_CHARS) {
    return { markdown: canonicalMarkdown, warnings: [] };
  }
  return {
    markdown: canonicalMarkdown.slice(0, CANONICAL_MARKDOWN_MAX_CHARS),
    warnings: [
      `canonical_markdown truncated from ${canonicalMarkdown.length} to ${CANONICAL_MARKDOWN_MAX_CHARS} characters`,
    ],
  };
}

function filterSectionsByCoverage(
  sections: CanonicalSection[],
  coverage: FlashcardGenerateBody["coverage"],
): CanonicalSection[] {
  if (coverage === "entire_document") {
    return sections;
  }
  const allowed = new Set(coverage.sectionKeys);
  return sections.filter((section) => allowed.has(section.section_key));
}

function resolveCoverageMode(
  coverage: FlashcardGenerateBody["coverage"],
): string {
  return coverage === "entire_document" ? "entire_document" : "selected_sections";
}

function resolveRequestedCount(amount: FlashcardGenerateBody["amount"]): string {
  if (amount === "recommended") {
    return "recommended";
  }
  return String(amount.count);
}

async function callFlashcardGenerator(params: {
  studySetId: string;
  title: string;
  language: string;
  learningGoal: string;
  canonicalMarkdown: string;
  sectionsJson: string;
  extractedQuestionsJson: string;
  requestedCount: string;
  coverageMode: string;
  user: User;
}): Promise<FlashcardGeneratorOutput> {
  const spec = await loadFlashcardPrompt();
  const messages = buildFlashcardGeneratorMessages(spec, {
    study_set_id: params.studySetId,
    title: params.title,
    language: params.language,
    learning_goal: params.learningGoal,
    canonical_markdown: params.canonicalMarkdown,
    sections_json: params.sectionsJson,
    extracted_questions_json: params.extractedQuestionsJson,
    requested_count: params.requestedCount,
    coverage_mode: params.coverageMode,
  });

  const tier = resolveUserAiTier(params.user);
  const aiConfig = getAiProcessingConfig(tier);

  const baseMessages = [
    { role: "system" as const, content: messages.system },
    { role: "user" as const, content: messages.user },
  ];

  const first = await postChatCompletionAssistantText({
    configUrl: aiConfig.url,
    apiKey: aiConfig.key,
    model: aiConfig.model,
    messages: baseMessages,
    responseFormatJsonObject: true,
    temperature: 0,
  });

  if (!first.ok) {
    throw new FlashcardGenerateError(
      formatUpstreamAiError(first.status, first.body),
    );
  }

  let parsed = flashcardGeneratorOutputSchema.safeParse(
    JSON.parse(stripJsonFence(first.text)),
  );

  if (!parsed.success) {
    const repair = await postChatCompletionAssistantText({
      configUrl: aiConfig.url,
      apiKey: aiConfig.key,
      model: aiConfig.model,
      messages: [
        ...baseMessages,
        { role: "assistant" as const, content: first.text },
        {
          role: "user" as const,
          content: `Invalid schema: ${summarizeZodError(parsed.error)}. Return ONLY valid JSON matching the schema.`,
        },
      ],
      responseFormatJsonObject: true,
      temperature: 0,
    });

    if (!repair.ok) {
      throw new FlashcardGenerateError(
        formatUpstreamAiError(repair.status, repair.body),
      );
    }

    parsed = flashcardGeneratorOutputSchema.safeParse(
      JSON.parse(stripJsonFence(repair.text)),
    );
  }

  if (!parsed.success) {
    throw new FlashcardGenerateError(
      `Flashcard generator output failed validation: ${summarizeZodError(parsed.error)}`,
    );
  }

  return parsed.data;
}

export async function runFlashcardGenerate(params: {
  supabase: SupabaseClient;
  userId: string;
  studySetId: string;
  user: User;
  learningGoal: FlashcardGenerateBody["learningGoal"];
  coverage: FlashcardGenerateBody["coverage"];
  amount: FlashcardGenerateBody["amount"];
}): Promise<FlashcardGenerateSuccess> {
  const {
    supabase,
    userId,
    studySetId,
    user,
    learningGoal,
    coverage,
    amount,
  } = params;

  const { data: studySet, error: studySetError } = await supabase
    .from("study_sets")
    .select("id, pipeline_stage, title")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (studySetError) {
    throw new Error(studySetError.message);
  }
  if (!studySet) {
    throw new FlashcardGenerateValidationError("Study set not found.");
  }
  if (!isAtLeastPipelineStage(studySet.pipeline_stage, "canonical")) {
    throw new FlashcardGenerateValidationError(
      "Flashcard generation requires pipeline_stage at least canonical.",
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("canonical_documents")
    .select("id, canonical_markdown, metadata")
    .eq("study_set_id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }
  if (!document) {
    throw new FlashcardGenerateValidationError("Canonical document not found.");
  }

  const canonicalMarkdown = document.canonical_markdown?.trim() ?? "";
  if (!canonicalMarkdown) {
    throw new FlashcardGenerateValidationError("canonical_markdown is empty.");
  }

  if (!isAiProcessingConfigured()) {
    throw new FlashcardGenerateError("AI processing is not configured.", 503);
  }

  const metadata = (document.metadata ?? {}) as CanonicalMetadata;

  const { data: sections, error: sectionsError } = await supabase
    .from("canonical_sections")
    .select("ordinal, heading, body_markdown, section_key")
    .eq("canonical_document_id", document.id)
    .eq("user_id", userId)
    .order("ordinal", { ascending: true });

  if (sectionsError) {
    throw new Error(sectionsError.message);
  }

  const filteredSections = filterSectionsByCoverage(
    (sections ?? []) as CanonicalSection[],
    coverage,
  );

  const { markdown: truncatedMarkdown } =
    truncateCanonicalMarkdown(canonicalMarkdown);

  const extractedQuestions = metadata.extracted_questions ?? [];
  const requestedCount = resolveRequestedCount(amount);
  const coverageMode = resolveCoverageMode(coverage);

  let output: FlashcardGeneratorOutput;
  try {
    output = await callFlashcardGenerator({
      studySetId,
      title: studySet.title ?? "Study set",
      language: metadata.language ?? "en",
      learningGoal,
      canonicalMarkdown: truncatedMarkdown,
      sectionsJson: JSON.stringify(filteredSections),
      extractedQuestionsJson: JSON.stringify(extractedQuestions),
      requestedCount,
      coverageMode,
      user,
    });
  } catch (error) {
    if (error instanceof FlashcardGenerateError) {
      throw error;
    }
    throw new FlashcardGenerateError(
      error instanceof Error ? error.message : "Flashcard generation failed.",
    );
  }

  const {
    cards,
    recommendedCount,
    generatedCount,
    detectedFormat,
  } = dedupeAndCapFlashcards(output, amount);

  const promptVersion = FLASHCARD_PROMPT_VERSION || "1.0";
  const rows = mapFlashcardOutputToRows(cards, {
    userId,
    studySetId,
    promptVersion,
    detectedFormat,
    learningGoal,
  });

  const { error: flashcardDeleteError } = await supabase
    .from("approved_flashcards")
    .delete()
    .eq("study_set_id", studySetId)
    .eq("user_id", userId);

  if (flashcardDeleteError) {
    throw new Error(flashcardDeleteError.message);
  }

  const { error: questionDeleteError } = await supabase
    .from("approved_questions")
    .delete()
    .eq("study_set_id", studySetId)
    .eq("user_id", userId);

  if (questionDeleteError) {
    throw new Error(questionDeleteError.message);
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("approved_flashcards")
      .insert(rows);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const { error: stageError } = await supabase
    .from("study_sets")
    .update({
      pipeline_stage: "flashcards",
      content_kind: "flashcards",
    })
    .eq("id", studySetId)
    .eq("user_id", userId);

  if (stageError) {
    throw new Error(stageError.message);
  }

  return {
    ok: true,
    recommendedCount,
    generatedCount,
    detectedFormat,
    cardIds: rows.map((row) => row.id),
  };
}
