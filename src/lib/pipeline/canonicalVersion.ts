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
import { stripJsonFence } from "@/lib/pipeline/canonicalize";
import { checkCanonical } from "@/lib/pipeline/faithfulness";
import { buildHeuristicCanonicalOutput } from "@/lib/pipeline/heuristicCanonicalBuilder";
import {
  CANONICAL_LLM_RAW_MARKDOWN_MAX_CHARS,
  truncateRawMarkdown,
  truncateRawMarkdownToMax,
} from "@/lib/pipeline/rawMarkdownLimit";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import {
  checksumCanonicalMarkdown,
  checksumSections,
} from "@/lib/provenance/checksum";
import {
  getAiProcessingConfig,
  isAiProcessingConfigured,
} from "@/lib/server/ai-processing-config";
import {
  formatUpstreamAiError,
  isRetryableUpstreamAiError,
} from "@/lib/server/formatUpstreamAiError";
import { postChatCompletionAssistantText } from "@/lib/server/openAiChatCompletion";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";
import {
  formatSupabaseNetworkError,
  isSupabaseNetworkError,
} from "@/lib/supabase/networkErrors";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

/** Schema/parser contract version for workspace-native canonicalization. */
export const CANONICAL_PARSER_VERSION = "1.0";

const CANONICAL_AI_TOTAL_BUDGET_MS = 180_000;
const CANONICAL_AI_REQUEST_TIMEOUT_MS = 90_000;
const SUPABASE_WRITE_MAX_ATTEMPTS = 3;

export class CanonicalVersionValidationError extends Error {
  readonly name = "CanonicalVersionValidationError";
}

export class CanonicalVersionError extends Error {
  readonly name = "CanonicalVersionError";
}

export class CanonicalVersionPersistenceError extends Error {
  readonly name = "CanonicalVersionPersistenceError";
}

export type CanonicalVersionResult = {
  canonicalVersionId: string;
  versionNumber: number;
  sectionCount: number;
  title: string;
  model: string | null;
  promptVersion: string;
  parserVersion: string;
  createdAt: string;
  provenance: Record<string, unknown>;
};

type ConversionProvenance = Record<string, unknown> & {
  input_type?: string;
  conversion_status?: string;
  markitdown_version?: string;
  conversion_error?: string | null;
};

type DocumentVersionRow = {
  id: string;
  document_id: string;
  version_number: number;
  raw_markdown: string | null;
  original_filename: string | null;
  deleted_at: string | null;
  conversion_provenance: ConversionProvenance | null;
  documents: {
    id: string;
    workspace_id: string;
    title: string;
    deleted_at: string | null;
  } | null;
};

type CanonicalBuilderResult = {
  output: CanonicalBuilderOutput;
  mode: "ai" | "heuristic";
  upstreamError: string | null;
  model: string | null;
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

function resolveHeuristicCanonicalOutput(params: {
  rawMarkdown: string;
  originalFilename: string;
}): CanonicalBuilderOutput {
  const candidate = buildHeuristicCanonicalOutput(params);
  const parsed = canonicalBuilderOutputSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new CanonicalVersionError(
      `Heuristic canonical fallback failed validation: ${summarizeZodError(parsed.error)}`,
    );
  }
  return parsed.data;
}

async function callCanonicalBuilder(params: {
  sourceId: string;
  sourceType: string;
  originalFilename: string;
  rawMarkdown: string;
  user: User;
}): Promise<CanonicalBuilderResult> {
  const spec = await loadCanonicalPrompt();
  const tier = resolveUserAiTier(params.user);
  const aiConfig = getAiProcessingConfig(tier);
  const startedAt = Date.now();
  const llmInputLimits = [CANONICAL_LLM_RAW_MARKDOWN_MAX_CHARS, 8_000];

  let lastUpstream: { status: number; body: string } | null = null;

  for (let attempt = 0; attempt < llmInputLimits.length; attempt += 1) {
    const maxChars = llmInputLimits[attempt];
    const { markdown: llmMarkdown } = truncateRawMarkdownToMax(
      params.rawMarkdown,
      maxChars,
    );

    const messages = buildCanonicalMessages(spec, {
      source_id: params.sourceId,
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
        model: aiConfig.model,
      };
    }

    if (attempt < llmInputLimits.length - 1) {
      continue;
    }
  }

  console.warn(
    "[canonicalVersion] AI builder failed; using heuristic fallback.",
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
    model: null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapSectionsForPersist(output: CanonicalBuilderOutput) {
  return output.sections.map((section, index) => {
    const ordinal = index + 1;
    const body = section.content;
    return {
      ordinal,
      section_key: section.id,
      heading: section.title,
      body_markdown: body,
      section_type: section.content_type,
      checksum: checksumCanonicalMarkdown(body),
    };
  });
}

function buildRedactedProvenance(params: {
  conversion: ConversionProvenance;
  mode: "ai" | "heuristic";
  upstreamError: string | null;
  model: string | null;
  promptVersion: string;
  parserVersion: string;
  providerHost: string | null;
  startedAt: string;
  completedAt: string;
}): Record<string, unknown> {
  return {
    markitdown_version:
      typeof params.conversion.markitdown_version === "string"
        ? params.conversion.markitdown_version
        : null,
    conversion_status: params.conversion.conversion_status ?? null,
    input_type: params.conversion.input_type ?? null,
    mode: params.mode,
    fallback_reason: params.upstreamError,
    model: params.model,
    prompt_version: params.promptVersion,
    parser_version: params.parserVersion,
    provider_host: params.providerHost,
    started_at: params.startedAt,
    completed_at: params.completedAt,
  };
}

function providerHostFromUrl(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function persistCanonicalVersionWithRetry(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<{
  canonicalVersionId: string;
  versionNumber: number;
  sectionCount: number;
}> {
  let lastMessage = "Canonical version persistence failed.";

  for (let attempt = 1; attempt <= SUPABASE_WRITE_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.rpc("persist_canonical_version", args);

    if (!error && data && typeof data === "object") {
      const payload = data as Record<string, unknown>;
      const canonicalVersionId = payload.canonicalVersionId;
      const versionNumber = payload.versionNumber;
      const sectionCount = payload.sectionCount;
      if (
        typeof canonicalVersionId !== "string" ||
        typeof versionNumber !== "number" ||
        typeof sectionCount !== "number"
      ) {
        throw new CanonicalVersionPersistenceError(
          "persist_canonical_version returned an unexpected payload.",
        );
      }
      return { canonicalVersionId, versionNumber, sectionCount };
    }

    lastMessage = error?.message ?? lastMessage;
    if (
      !error ||
      !isSupabaseNetworkError(error.message) ||
      attempt === SUPABASE_WRITE_MAX_ATTEMPTS
    ) {
      throw new CanonicalVersionPersistenceError(
        formatSupabaseNetworkError(lastMessage),
      );
    }

    await sleep(750 * attempt);
  }

  throw new CanonicalVersionPersistenceError(
    formatSupabaseNetworkError(lastMessage),
  );
}

async function requireWorkspaceEditor(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new CanonicalVersionValidationError("Workspace not found.");
  }
  if (data.role === "viewer") {
    throw new CanonicalVersionValidationError(
      "Workspace editor access required to canonicalize.",
    );
  }
}

export async function runCanonicalVersion(params: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  documentId: string;
  documentVersionId: string;
  user: User;
}): Promise<CanonicalVersionResult> {
  const {
    supabase,
    userId,
    workspaceId,
    documentId,
    documentVersionId,
    user,
  } = params;

  await requireWorkspaceEditor(supabase, userId, workspaceId);

  const { data: versionRow, error: versionError } = await supabase
    .from("document_versions")
    .select(
      "id, document_id, version_number, raw_markdown, original_filename, deleted_at, conversion_provenance, documents!inner(id, workspace_id, title, deleted_at)",
    )
    .eq("id", documentVersionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (versionError) {
    throw new Error(versionError.message);
  }

  const version = versionRow as DocumentVersionRow | null;
  if (
    !version ||
    !version.documents ||
    version.document_id !== documentId ||
    version.documents.workspace_id !== workspaceId ||
    version.documents.deleted_at != null
  ) {
    throw new CanonicalVersionValidationError("Document version not found.");
  }

  const rawMarkdown = version.raw_markdown?.trim() ?? "";
  if (!rawMarkdown) {
    throw new CanonicalVersionValidationError("raw_markdown is empty.");
  }

  if (!isAiProcessingConfigured()) {
    throw new CanonicalVersionError("AI processing is not configured.");
  }

  const conversion = (version.conversion_provenance ??
    {}) as ConversionProvenance;
  const sourceType = conversion.input_type ?? "file";
  const originalFilename =
    version.original_filename?.trim() || version.documents.title || "document";

  const { markdown: truncatedMarkdown, warnings: truncationWarnings } =
    truncateRawMarkdown(rawMarkdown);

  const startedAt = new Date().toISOString();
  let builderResult: CanonicalBuilderResult;
  try {
    builderResult = await callCanonicalBuilder({
      sourceId: documentVersionId,
      sourceType,
      originalFilename,
      rawMarkdown: truncatedMarkdown,
      user,
    });
  } catch (error) {
    if (error instanceof CanonicalVersionError) {
      throw error;
    }
    throw new CanonicalVersionError(
      error instanceof Error ? error.message : "Canonicalization failed.",
    );
  }

  let output = builderResult.output;
  const recoveredQuestions = buildHeuristicCanonicalOutput({
    rawMarkdown: truncatedMarkdown,
    originalFilename,
  }).extracted_questions;
  if (recoveredQuestions.length > output.extracted_questions.length) {
    const questionSectionId =
      output.sections.find((section) => section.content_type === "question")
        ?.id ?? output.sections[0]?.id;
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
      const mergedParsed =
        canonicalBuilderOutputSchema.safeParse(mergedCandidate);
      if (mergedParsed.success) {
        output = mergedParsed.data;
      }
    }
  }

  const faithfulnessWarnings = checkCanonical({
    title: output.title,
    filename: output.filename,
    canonical_markdown: output.canonical_markdown,
    raw_markdown: truncatedMarkdown,
    sections: output.sections,
    extracted_questions: output.extracted_questions,
  }).warnings;

  const promptVersion = CANONICAL_PROMPT_VERSION || "1.0";
  const parserVersion = CANONICAL_PARSER_VERSION;
  const completedAt = new Date().toISOString();

  let providerHost: string | null = null;
  let modelIdentity = builderResult.model;
  try {
    const tier = resolveUserAiTier(user);
    const aiConfig = getAiProcessingConfig(tier);
    providerHost = providerHostFromUrl(aiConfig.url);
    if (!modelIdentity && builderResult.mode === "ai") {
      modelIdentity = aiConfig.model;
    }
  } catch {
    providerHost = null;
  }

  const generatorSettings = {
    temperature: 0,
    max_tokens: 8192,
    response_format: "json_object",
    tier: resolveUserAiTier(user),
  };

  const provenance = buildRedactedProvenance({
    conversion,
    mode: builderResult.mode,
    upstreamError: builderResult.upstreamError,
    model: modelIdentity,
    promptVersion,
    parserVersion,
    providerHost,
    startedAt,
    completedAt,
  });

  const metadata = {
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
        ...truncationWarnings,
        ...output.warnings,
        ...faithfulnessWarnings,
      ]),
    ],
    prompt_version: promptVersion,
    canonicalization_status: "ok",
    canonicalization_error: null,
    canonicalization_mode: builderResult.mode,
    canonicalization_upstream_error: builderResult.upstreamError,
  };

  const sectionRows = mapSectionsForPersist(output);
  if (sectionRows.length < 1) {
    throw new CanonicalVersionError("Canonical output produced no sections.");
  }

  const canonicalContentChecksum = checksumCanonicalMarkdown(
    output.canonical_markdown,
  );
  const sectionsChecksum = checksumSections(
    sectionRows.map((section) => ({
      ordinal: section.ordinal,
      section_key: section.section_key,
      heading: section.heading,
      section_type: section.section_type,
      body_markdown: section.body_markdown,
    })),
  );

  // Append-only: never call replace_canonical_content or touch canonical_documents.
  const persisted = await persistCanonicalVersionWithRetry(supabase, {
    p_document_version_id: documentVersionId,
    p_canonical_markdown: output.canonical_markdown,
    p_canonical_content_checksum: canonicalContentChecksum,
    p_sections_checksum: sectionsChecksum,
    p_model: modelIdentity,
    p_prompt_version: promptVersion,
    p_parser_version: parserVersion,
    p_generator_settings: generatorSettings,
    p_provenance: provenance,
    p_metadata: metadata,
    p_expected_section_count: sectionRows.length,
    p_sections: sectionRows,
  });

  return {
    canonicalVersionId: persisted.canonicalVersionId,
    versionNumber: persisted.versionNumber,
    sectionCount: persisted.sectionCount,
    title: output.title,
    model: modelIdentity,
    promptVersion,
    parserVersion,
    createdAt: completedAt,
    provenance,
  };
}

// Re-export workspace errors for route mapping convenience when auth mismatches.
export { WorkspaceForbiddenError, WorkspaceNotFoundError };
