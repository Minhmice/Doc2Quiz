import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  buildCanonicalMessages,
  CANONICAL_PROMPT_VERSION,
  loadCanonicalPrompt,
} from "@/lib/pipeline/canonicalPrompt";
import {
  canonicalBuilderOutputSchema,
  type CanonicalBuilderOutput,
} from "@/lib/pipeline/canonicalSchemas";
import { checkCanonical } from "@/lib/pipeline/faithfulness";
import { buildHeuristicCanonicalOutput } from "@/lib/pipeline/heuristicCanonicalBuilder";
import {
  getAiProcessingConfig,
  isAiProcessingConfigured,
} from "@/lib/server/ai-processing-config";
import { postChatCompletionAssistantText } from "@/lib/server/openAiChatCompletion";
import {
  CANONICAL_LLM_RAW_MARKDOWN_MAX_CHARS,
  truncateRawMarkdown,
  truncateRawMarkdownToMax,
} from "@/lib/pipeline/rawMarkdownLimit";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import {
  formatUpstreamAiError,
  isRetryableUpstreamAiError,
} from "@/lib/server/formatUpstreamAiError";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";
import {
  formatSupabaseNetworkError,
  isSupabaseNetworkError,
} from "@/lib/supabase/networkErrors";

const CANONICAL_AI_TOTAL_BUDGET_MS = 180_000;
const CANONICAL_AI_REQUEST_TIMEOUT_MS = 90_000;
const SUPABASE_WRITE_MAX_ATTEMPTS = 3;

const PIPELINE_STAGES = [
  "input",
  "raw",
  "canonical",
  "mode_selected",
  "quiz",
  "flashcards",
] as const;

export class CanonicalizeValidationError extends Error {
  readonly name = "CanonicalizeValidationError";
}

export class CanonicalizeError extends Error {
  readonly name = "CanonicalizeError";
}

export class CanonicalizePersistenceError extends Error {
  readonly name = "CanonicalizePersistenceError";
}

export type CanonicalizeResult = {
  studySetId: string;
  pipelineStage: "canonical";
  sectionCount: number;
  title: string;
};

type CanonicalMetadata = Record<string, unknown> & {
  input_type?: string;
  canonicalization_status?: "ok" | "failed";
  canonicalization_error?: string | null;
  canonicalization_mode?: "ai" | "heuristic";
  canonicalization_upstream_error?: string | null;
  prompt_version?: string;
  title?: string;
  clean_filename?: string;
  language?: string;
  content_type?: string;
  topics?: string[];
  extracted_questions?: CanonicalBuilderOutput["extracted_questions"];
  atomic_facts?: CanonicalBuilderOutput["atomic_facts"];
  source_readiness?: CanonicalBuilderOutput["source_readiness"];
  max_supported_count?: number;
  warnings?: string[];
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

export function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  return trimmed;
}

function mapCanonicalOutputToMetadata(
  output: CanonicalBuilderOutput,
  existing: CanonicalMetadata,
  extraWarnings: string[],
  canonicalization: {
    mode: "ai" | "heuristic";
    upstreamError: string | null;
  },
): CanonicalMetadata {
  return {
    ...existing,
    title: output.title,
    clean_filename: output.filename,
    language: output.language,
    content_type: output.document_type,
    topics: output.topics,
    extracted_questions: output.extracted_questions,
    atomic_facts: output.atomic_facts,
    source_readiness: output.source_readiness,
    max_supported_count: output.max_supported_count,
    warnings: [
      ...new Set([
        ...(existing.warnings ?? []),
        ...output.warnings,
        ...extraWarnings,
      ]),
    ],
    prompt_version: CANONICAL_PROMPT_VERSION,
    canonicalization_status: "ok",
    canonicalization_error: null,
    canonicalization_mode: canonicalization.mode,
    canonicalization_upstream_error: canonicalization.upstreamError,
  };
}

function mapCanonicalOutputToSections(
  output: CanonicalBuilderOutput,
  params: { userId: string; documentId: string },
) {
  return output.sections.map((section, index) => ({
    user_id: params.userId,
    canonical_document_id: params.documentId,
    ordinal: index + 1,
    heading: section.title,
    body_markdown: section.content,
    section_type: section.content_type,
    section_key: section.id,
  }));
}

async function persistCanonicalizationFailure(
  supabase: SupabaseClient,
  params: {
    userId: string;
    studySetId: string;
    existingMetadata: CanonicalMetadata;
    message: string;
  },
): Promise<void> {
  const compactMessage = params.message.replace(/\s+/g, " ").trim().slice(0, 500);
  const { error } = await supabase
    .from("canonical_documents")
    .update({
      metadata: {
        ...params.existingMetadata,
        canonicalization_status: "failed",
        canonicalization_error: compactMessage,
      },
    })
    .eq("study_set_id", params.studySetId)
    .eq("user_id", params.userId);

  if (error) {
    console.error(
      "[canonicalize] could not persist failure metadata:",
      error.message,
    );
  }
}

function resolveHeuristicCanonicalOutput(params: {
  rawMarkdown: string;
  originalFilename: string;
}): CanonicalBuilderOutput {
  const candidate = buildHeuristicCanonicalOutput(params);
  const parsed = canonicalBuilderOutputSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new CanonicalizeError(
      `Heuristic canonical fallback failed validation: ${summarizeZodError(parsed.error)}`,
    );
  }
  return parsed.data;
}

type CanonicalBuilderResult = {
  output: CanonicalBuilderOutput;
  mode: "ai" | "heuristic";
  upstreamError: string | null;
};

function aiRequestSignal(startedAt: number): AbortSignal | null {
  const remaining = CANONICAL_AI_TOTAL_BUDGET_MS - (Date.now() - startedAt);
  if (remaining <= 0) {
    return null;
  }
  return AbortSignal.timeout(
    Math.max(1, Math.min(CANONICAL_AI_REQUEST_TIMEOUT_MS, remaining)),
  );
}

async function callCanonicalBuilder(params: {
  studySetId: string;
  sourceType: string;
  originalFilename: string;
  rawMarkdown: string;
  user: User;
}): Promise<CanonicalBuilderResult> {
  const spec = await loadCanonicalPrompt();
  const tier = resolveUserAiTier(params.user);
  const aiConfig = getAiProcessingConfig(tier);
  const startedAt = Date.now();

  const llmInputLimits = [
    CANONICAL_LLM_RAW_MARKDOWN_MAX_CHARS,
    8_000,
  ];

  let lastUpstream: { status: number; body: string } | null = null;

  for (let attempt = 0; attempt < llmInputLimits.length; attempt += 1) {
    const maxChars = llmInputLimits[attempt];
    const { markdown: llmMarkdown } = truncateRawMarkdownToMax(
      params.rawMarkdown,
      maxChars,
    );

    const messages = buildCanonicalMessages(spec, {
      source_id: params.studySetId,
      source_type: params.sourceType,
      original_filename: params.originalFilename,
      raw_markdown: llmMarkdown,
    });

    const baseMessages = [
      { role: "system" as const, content: messages.system },
      { role: "user" as const, content: messages.user },
    ];

    const firstSignal = aiRequestSignal(startedAt);
    if (!firstSignal) {
      lastUpstream = { status: 502, body: "Canonical AI time budget exhausted" };
      break;
    }

    const first = await postChatCompletionAssistantText({
      configUrl: aiConfig.url,
      apiKey: aiConfig.key,
      model: aiConfig.model,
      messages: baseMessages,
      responseFormatJsonObject: true,
      temperature: 0,
      max_tokens: 8192,
      signal: firstSignal,
    });

    if (!first.ok) {
      lastUpstream = { status: first.status, body: first.body };
      if (
        isRetryableUpstreamAiError(first.status, first.body) &&
        attempt < llmInputLimits.length - 1
      ) {
        continue;
      }
      break;
    }

    let parsed;
    try {
      parsed = canonicalBuilderOutputSchema.safeParse(
        JSON.parse(stripJsonFence(first.text)),
      );
    } catch {
      parsed = canonicalBuilderOutputSchema.safeParse(null);
    }

    if (!parsed.success) {
      const repairSignal = aiRequestSignal(startedAt);
      if (!repairSignal) {
        lastUpstream = { status: 502, body: "Canonical AI time budget exhausted" };
        break;
      }

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
        max_tokens: 8192,
        signal: repairSignal,
      });

      if (!repair.ok) {
        lastUpstream = { status: repair.status, body: repair.body };
        if (
          isRetryableUpstreamAiError(repair.status, repair.body) &&
          attempt < llmInputLimits.length - 1
        ) {
          continue;
        }
        break;
      }

      try {
        parsed = canonicalBuilderOutputSchema.safeParse(
          JSON.parse(stripJsonFence(repair.text)),
        );
      } catch {
        parsed = canonicalBuilderOutputSchema.safeParse(null);
      }
    }

    if (parsed.success) {
      return {
        output: parsed.data,
        mode: "ai",
        upstreamError: null,
      };
    }

    if (attempt < llmInputLimits.length - 1) {
      continue;
    }
  }

  console.warn(
    "[canonicalize] AI builder failed; using heuristic fallback.",
    lastUpstream
      ? formatUpstreamAiError(lastUpstream.status, lastUpstream.body)
      : "no upstream response",
  );

  const upstreamError = lastUpstream
    ? formatUpstreamAiError(lastUpstream.status, lastUpstream.body)
    : "Canonical AI returned invalid output.";

  return {
    output: resolveHeuristicCanonicalOutput({
      rawMarkdown: params.rawMarkdown,
      originalFilename: params.originalFilename,
    }),
    mode: "heuristic",
    upstreamError,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function replaceCanonicalContentWithRetry(
  supabase: SupabaseClient,
  params: {
    studySetId: string;
    canonicalMarkdown: string;
    metadata: CanonicalMetadata;
    title: string;
    sections: ReturnType<typeof mapCanonicalOutputToSections>;
  },
): Promise<void> {
  let lastMessage = "Canonical persistence failed.";

  for (let attempt = 1; attempt <= SUPABASE_WRITE_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.rpc("replace_canonical_content", {
      p_study_set_id: params.studySetId,
      p_canonical_markdown: params.canonicalMarkdown,
      p_metadata: params.metadata,
      p_title: params.title,
      p_expected_section_count: params.sections.length,
      p_sections: params.sections,
    });

    if (!error) {
      if (data !== params.sections.length) {
        throw new CanonicalizePersistenceError(
          `Expected to persist ${params.sections.length} sections; persisted ${String(data)}.`,
        );
      }
      return;
    }

    lastMessage = error.message;
    if (
      !isSupabaseNetworkError(error.message) ||
      attempt === SUPABASE_WRITE_MAX_ATTEMPTS
    ) {
      throw new CanonicalizePersistenceError(
        formatSupabaseNetworkError(error.message),
      );
    }

    await sleep(750 * attempt);
  }

  throw new CanonicalizePersistenceError(
    formatSupabaseNetworkError(lastMessage),
  );
}

export async function runCanonicalize(params: {
  supabase: SupabaseClient;
  userId: string;
  studySetId: string;
  user: User;
}): Promise<CanonicalizeResult> {
  const { supabase, userId, studySetId, user } = params;

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
    throw new CanonicalizeValidationError("Study set not found.");
  }
  if (!isAtLeastPipelineStage(studySet.pipeline_stage, "raw")) {
    throw new CanonicalizeValidationError(
      "Canonicalize requires pipeline_stage at least raw.",
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("canonical_documents")
    .select("id, raw_markdown, original_filename, metadata")
    .eq("study_set_id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }
  if (!document) {
    throw new CanonicalizeValidationError("Canonical document not found.");
  }

  const rawMarkdown = document.raw_markdown?.trim() ?? "";
  if (!rawMarkdown) {
    throw new CanonicalizeValidationError("raw_markdown is empty.");
  }

  if (!isAiProcessingConfigured()) {
    throw new CanonicalizeError("AI processing is not configured.");
  }

  const existingMetadata = (document.metadata ?? {}) as CanonicalMetadata;
  const sourceType = existingMetadata.input_type ?? "file";
  const originalFilename =
    document.original_filename?.trim() || studySet.title || "document";

  const { markdown: truncatedMarkdown, warnings: truncationWarnings } =
    truncateRawMarkdown(rawMarkdown);

  let builderResult: CanonicalBuilderResult;
  try {
    builderResult = await callCanonicalBuilder({
      studySetId,
      sourceType,
      originalFilename,
      rawMarkdown: truncatedMarkdown,
      user,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Canonicalization failed.";
    await persistCanonicalizationFailure(supabase, {
      userId,
      studySetId,
      existingMetadata,
      message,
    });
    if (error instanceof CanonicalizeError) {
      throw error;
    }
    throw new CanonicalizeError(message);
  }
  let output = builderResult.output;
  const recoveredQuestions = buildHeuristicCanonicalOutput({
    rawMarkdown: truncatedMarkdown,
    originalFilename,
  }).extracted_questions;
  if (recoveredQuestions.length > output.extracted_questions.length) {
    const questionSectionId =
      output.sections.find((section) => section.content_type === "question")?.id ??
      output.sections[0]?.id;
    if (questionSectionId) {
      const mergedCandidate = {
        ...output,
        extracted_questions: recoveredQuestions.map((question) => ({
          ...question,
          section_id: questionSectionId,
        })),
        source_readiness: { pass: true, reasons: [] },
        warnings: [
          ...output.warnings,
          `Recovered ${recoveredQuestions.length} source questions deterministically; AI extracted ${output.extracted_questions.length}.`,
        ],
      };
      const mergedParsed = canonicalBuilderOutputSchema.safeParse(mergedCandidate);
      if (mergedParsed.success) output = mergedParsed.data;
    }
  }

  // Post-LLM faithfulness checks - P0 guardrails against hallucination
  const canonicalInput = {
    title: output.title,
    filename: output.filename,
    canonical_markdown: output.canonical_markdown,
    raw_markdown: truncatedMarkdown,
    sections: output.sections,
    extracted_questions: output.extracted_questions,
  };
  const canonicalResult = checkCanonical(canonicalInput);
  const faithfulnessWarnings: string[] = canonicalResult.warnings;

  if (faithfulnessWarnings.length > 0) {
    for (const warning of faithfulnessWarnings) {
      console.warn(`[canonical faithfulness] ${warning}`);
    }
  }

  const mergedMetadata = mapCanonicalOutputToMetadata(
    output,
    existingMetadata,
    [...truncationWarnings, ...faithfulnessWarnings],
    {
      mode: builderResult.mode,
      upstreamError: builderResult.upstreamError,
    },
  );
  const sectionRows = mapCanonicalOutputToSections(output, {
    userId,
    documentId: document.id,
  });

  await replaceCanonicalContentWithRetry(supabase, {
    studySetId,
    canonicalMarkdown: output.canonical_markdown,
    metadata: mergedMetadata,
    title: output.title,
    sections: sectionRows,
  });

  return {
    studySetId,
    pipelineStage: "canonical",
    sectionCount: sectionRows.length,
    title: output.title,
  };
}
