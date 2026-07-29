import type { SupabaseClient, User } from "@supabase/supabase-js";

import { checkQuiz } from "@/lib/pipeline/faithfulness";
import { mapQuizOutputToRows } from "@/lib/pipeline/mapQuizOutputToRows";
import {
  buildQuestionCandidates,
  callQuizGenerator,
  resolveGenerationMode,
  truncateCanonicalMarkdown,
  validateAtomicFactArtifact,
  type QuizGenerateSuccess,
} from "@/lib/pipeline/quizGenerate";
import { QUIZ_PROMPT_VERSION } from "@/lib/pipeline/quizPrompt";
import type {
  QuizGeneratorOutput,
  QuizModelOutput,
} from "@/lib/pipeline/quizSchemas";
import {
  resolveSourceQuestions,
  type ResolvedSourceQuestion,
  type SourceQuestionInput,
} from "@/lib/pipeline/sourceQuestionResolver";
import {
  buildOutputSourceSnapshots,
  dedupeCanonicalVersionIds,
  type CanonicalVersionSnapshotInput,
  type OutputSourceSnapshot,
  type SectionSnapshotInput,
} from "@/lib/provenance/outputSnapshot";
import { isAiProcessingConfigured } from "@/lib/server/ai-processing-config";
import {
  formatSupabaseNetworkError,
  isSupabaseNetworkError,
} from "@/lib/supabase/networkErrors";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

const QUIZ_AI_TOTAL_BUDGET_MS = 180_000;
const SUPABASE_WRITE_MAX_ATTEMPTS = 3;

export class MultiSourceGenerateValidationError extends Error {
  readonly name = "MultiSourceGenerateValidationError";
}

export class MultiSourceGenerateError extends Error {
  readonly name = "MultiSourceGenerateError";
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, number | string>;

  constructor(
    message: string,
    statusCode = 422,
    code = "QUIZ_GENERATION_FAILED",
    details?: Record<string, number | string>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export type MultiSourceQuizGenerateSuccess = QuizGenerateSuccess & {
  outputId: string;
  bridgeStudySetId: string;
  studySetId: string;
  snapshotCount: number;
};

type CanonicalVersionRow = CanonicalVersionSnapshotInput & {
  status: string;
  deleted_at: string | null;
  document_version_id: string;
  document_versions: {
    id: string;
    deleted_at: string | null;
    documents: {
      id: string;
      title: string;
      workspace_id: string;
      deleted_at: string | null;
    } | null;
  } | null;
};

type CanonicalMetadata = Record<string, unknown> & {
  atomic_facts?: unknown[];
  extracted_questions?: unknown[];
  language?: string;
  max_supported_count?: number;
  source_readiness?: {
    pass: boolean;
    reasons: string[];
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assembleMultiSourceMarkdown(
  snapshots: OutputSourceSnapshot[],
): {
  markdown: string;
  sections: Array<{
    ordinal: number;
    section_key: string;
    heading: string | null;
    body_markdown: string;
  }>;
  sectionKeys: string[];
} {
  const parts: string[] = [];
  const sections: Array<{
    ordinal: number;
    section_key: string;
    heading: string | null;
    body_markdown: string;
  }> = [];
  const sectionKeys: string[] = [];
  let ordinal = 1;

  for (const snapshot of snapshots) {
    parts.push(
      `--- SOURCE ${snapshot.ordinal}: canonical_version_id=${snapshot.canonical_version_id} ---`,
      snapshot.canonical_markdown,
      "",
    );
    for (const section of snapshot.sections) {
      const sectionKey =
        section.section_key ??
        `src_${snapshot.ordinal}_sec_${section.ordinal}`;
      sections.push({
        ordinal,
        section_key: sectionKey,
        heading: section.heading,
        body_markdown: section.body_markdown,
      });
      sectionKeys.push(sectionKey);
      ordinal += 1;
    }
  }

  return {
    markdown: parts.join("\n").trimEnd(),
    sections,
    sectionKeys,
  };
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
    throw new WorkspaceNotFoundError("Workspace not found");
  }
  if (data.role === "viewer") {
    throw new WorkspaceForbiddenError("Viewer cannot generate quiz outputs");
  }
}

async function createLearningOutputWithRetry(
  supabase: SupabaseClient,
  args: {
    workspaceId: string;
    title: string;
    generationProvenance: Record<string, unknown>;
    snapshots: OutputSourceSnapshot[];
    items: ReturnType<typeof mapQuizOutputToRows>;
  },
): Promise<{
  outputId: string;
  bridgeStudySetId: string;
  itemCount: number;
  snapshotCount: number;
}> {
  const rpcArgs = {
    p_workspace_id: args.workspaceId,
    p_kind: "quiz",
    p_title: args.title,
    p_generation_provenance: args.generationProvenance,
    p_snapshots: args.snapshots,
    p_expected_item_count: args.items.length,
    p_items: args.items.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      choices: item.choices,
      correct_index: item.correct_index,
      explanation: item.explanation,
      tags: item.tags,
      source: item.source,
    })),
  };

  for (let attempt = 1; attempt <= SUPABASE_WRITE_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.rpc(
      "create_learning_output",
      rpcArgs,
    );
    if (!error) {
      const payload = data as {
        outputId?: string;
        bridgeStudySetId?: string;
        itemCount?: number;
        snapshotCount?: number;
      } | null;
      if (
        !payload?.outputId ||
        !payload.bridgeStudySetId ||
        typeof payload.itemCount !== "number" ||
        typeof payload.snapshotCount !== "number"
      ) {
        throw new MultiSourceGenerateError(
          "create_learning_output returned an incomplete bridge/output payload.",
          500,
          "QUIZ_PERSISTENCE_FAILED",
        );
      }
      return {
        outputId: payload.outputId,
        bridgeStudySetId: payload.bridgeStudySetId,
        itemCount: payload.itemCount,
        snapshotCount: payload.snapshotCount,
      };
    }
    if (
      !isSupabaseNetworkError(error.message) ||
      attempt === SUPABASE_WRITE_MAX_ATTEMPTS
    ) {
      throw new MultiSourceGenerateError(
        formatSupabaseNetworkError(error.message),
        isSupabaseNetworkError(error.message) ? 503 : 500,
        "QUIZ_PERSISTENCE_FAILED",
      );
    }
    await sleep(750 * attempt);
  }

  throw new MultiSourceGenerateError(
    "create_learning_output failed after retries.",
    503,
    "QUIZ_PERSISTENCE_FAILED",
  );
}

/**
 * Workspace-native multi-source quiz generation.
 * Never calls replace_quiz_questions / destructive deletes.
 */
export async function runMultiSourceQuizGenerate(params: {
  supabase: SupabaseClient;
  user: User;
  userId: string;
  workspaceId: string;
  canonicalVersionIds: string[];
  questionCountOverride?: number;
  /** Optional title override; defaults to first document title. */
  title?: string;
}): Promise<MultiSourceQuizGenerateSuccess> {
  const {
    supabase,
    user,
    userId,
    workspaceId,
    questionCountOverride,
  } = params;

  await requireWorkspaceEditor(supabase, userId, workspaceId);

  const orderedVersionIds = dedupeCanonicalVersionIds(
    params.canonicalVersionIds,
  );
  if (orderedVersionIds.length === 0) {
    throw new MultiSourceGenerateValidationError(
      "Select at least one completed canonical version.",
    );
  }

  const { data: versionRows, error: versionsError } = await supabase
    .from("canonical_versions")
    .select(
      "id, status, deleted_at, document_version_id, canonical_markdown, canonical_content_checksum, sections_checksum, metadata, model, prompt_version, parser_version, generator_settings, provenance, document_versions(id, deleted_at, documents(id, title, workspace_id, deleted_at))",
    )
    .in("id", orderedVersionIds);

  if (versionsError) {
    throw new Error(versionsError.message);
  }

  const loadedVersions = (versionRows ?? []) as unknown as CanonicalVersionRow[];
  const versionsById = new Map(
    loadedVersions.map((row) => [row.id, row]),
  );

  for (const versionId of orderedVersionIds) {
    const row = versionsById.get(versionId);
    if (!row) {
      throw new MultiSourceGenerateValidationError(
        `Canonical version not found: ${versionId}`,
      );
    }
    if (row.deleted_at != null) {
      throw new MultiSourceGenerateValidationError(
        `Canonical version is deleted: ${versionId}`,
      );
    }
    if (row.status !== "completed") {
      throw new MultiSourceGenerateValidationError(
        `Canonical version is not completed: ${versionId}`,
      );
    }
    const documentVersion = row.document_versions;
    const document = documentVersion?.documents ?? null;
    if (!documentVersion || documentVersion.deleted_at != null) {
      throw new MultiSourceGenerateValidationError(
        `Document version is deleted for canonical version: ${versionId}`,
      );
    }
    if (!document || document.deleted_at != null) {
      throw new MultiSourceGenerateValidationError(
        `Document is deleted for canonical version: ${versionId}`,
      );
    }
    if (document.workspace_id !== workspaceId) {
      throw new MultiSourceGenerateValidationError(
        `Canonical version is outside workspace: ${versionId}`,
      );
    }
  }

  const { data: sectionRows, error: sectionsError } = await supabase
    .from("canonical_version_sections")
    .select(
      "canonical_version_id, ordinal, section_key, heading, section_type, body_markdown",
    )
    .in("canonical_version_id", orderedVersionIds)
    .order("ordinal", { ascending: true });

  if (sectionsError) {
    throw new Error(sectionsError.message);
  }

  const sectionsByVersionId = new Map<string, SectionSnapshotInput[]>();
  for (const versionId of orderedVersionIds) {
    sectionsByVersionId.set(versionId, []);
  }
  for (const section of sectionRows ?? []) {
    const list = sectionsByVersionId.get(section.canonical_version_id);
    if (!list) continue;
    list.push({
      ordinal: section.ordinal,
      section_key: section.section_key,
      heading: section.heading,
      section_type: section.section_type,
      body_markdown: section.body_markdown,
    });
  }

  for (const versionId of orderedVersionIds) {
    if ((sectionsByVersionId.get(versionId) ?? []).length === 0) {
      throw new MultiSourceGenerateValidationError(
        `Canonical version has no sections: ${versionId}`,
      );
    }
  }

  const snapshotInputs = new Map<string, CanonicalVersionSnapshotInput>();
  for (const versionId of orderedVersionIds) {
    const row = versionsById.get(versionId)!;
    snapshotInputs.set(versionId, {
      id: row.id,
      canonical_markdown: row.canonical_markdown,
      canonical_content_checksum: row.canonical_content_checksum,
      sections_checksum: row.sections_checksum,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      model: row.model,
      prompt_version: row.prompt_version,
      parser_version: row.parser_version,
      generator_settings: (row.generator_settings ?? {}) as Record<
        string,
        unknown
      >,
      provenance: (row.provenance ?? {}) as Record<string, unknown>,
    });
  }

  const snapshots = buildOutputSourceSnapshots({
    orderedVersionIds,
    versionsById: snapshotInputs,
    sectionsByVersionId,
  });

  const assembled = assembleMultiSourceMarkdown(snapshots);
  const { markdown: truncatedMarkdown, warnings: truncationWarnings } =
    truncateCanonicalMarkdown(assembled.markdown);

  const allFacts: ReturnType<typeof validateAtomicFactArtifact>["facts"] = [];
  const allExtracted: SourceQuestionInput[] = [];
  const readinessReasons: string[] = [];
  let readinessPass = true;
  let language = "en";
  let maxSupportedFromMeta = 0;

  for (const snapshot of snapshots) {
    const metadata = snapshot.canonical_metadata as CanonicalMetadata;
    language = metadata.language ?? language;
    maxSupportedFromMeta = Math.max(
      maxSupportedFromMeta,
      metadata.max_supported_count ?? 0,
    );
    if (metadata.source_readiness && !metadata.source_readiness.pass) {
      readinessPass = false;
      readinessReasons.push(...(metadata.source_readiness.reasons ?? []));
    }
    const factArtifact = validateAtomicFactArtifact({
      rawFacts: metadata.atomic_facts ?? [],
      canonicalMarkdown: snapshot.canonical_markdown,
      sections: snapshot.sections.map((section) => ({
        section_key: section.section_key ?? "",
        body_markdown: section.body_markdown,
      })),
    });
    allFacts.push(...factArtifact.facts);
    if (factArtifact.reasons.length > 0) {
      readinessReasons.push(...factArtifact.reasons);
    }
    const extracted = (metadata.extracted_questions ?? []).filter(
      (question): question is SourceQuestionInput => {
        const candidate = question as Partial<SourceQuestionInput>;
        return Boolean(
          candidate.question &&
            candidate.section_id &&
            Array.isArray(candidate.options),
        );
      },
    );
    allExtracted.push(...extracted);
  }

  const hasSourceQuestions = allExtracted.length > 0;
  const maxSupportedCount =
    allFacts.length > 0 || hasSourceQuestions ? 40 : 0;

  if (
    (!readinessPass && !hasSourceQuestions) ||
    (allFacts.length === 0 && !hasSourceQuestions) ||
    maxSupportedCount < 1
  ) {
    const reasons = readinessReasons.join("; ") || "Atomic facts are missing.";
    throw new MultiSourceGenerateError(
      `Source is not ready for grounded quiz generation: ${reasons}`,
      422,
      "SOURCE_NOT_READY",
      { reason: reasons, maxSupportedCount },
    );
  }

  if (
    questionCountOverride !== undefined &&
    questionCountOverride > maxSupportedCount
  ) {
    throw new MultiSourceGenerateError(
      `Source supports at most ${maxSupportedCount} distinct grounded questions; requested ${questionCountOverride}.`,
      422,
      "SOURCE_CAPACITY_INSUFFICIENT",
      {
        requestedCount: questionCountOverride,
        maxSupportedCount,
        reason: "requested_count_exceeds_validated_fact_opportunities",
      },
    );
  }

  const defaultTarget = Math.min(
    Math.max(
      allExtracted.length,
      maxSupportedFromMeta || allFacts.length,
      1,
    ),
    40,
  );
  const capacityProbe = buildQuestionCandidates({
    facts: allFacts,
    extractedQuestions: allExtracted,
    modelOutput: null,
    targetCount: defaultTarget,
  });
  const targetCount =
    questionCountOverride ??
    (capacityProbe.questions.length > 0
      ? capacityProbe.questions.length
      : defaultTarget);

  const startedAt = Date.now();
  const generationWarnings: string[] = [...truncationWarnings];
  let resolvedSourceQuestions: ResolvedSourceQuestion[] = [];

  const answeredSourceOnly = buildQuestionCandidates({
    facts: allFacts,
    extractedQuestions: allExtracted,
    modelOutput: null,
    targetCount,
    fillDeterministically: false,
  });
  if (
    answeredSourceOnly.questions.length < targetCount &&
    allExtracted.length > 0 &&
    isAiProcessingConfigured()
  ) {
    try {
      const resolved = await resolveSourceQuestions({
        questions: allExtracted.slice(0, targetCount),
        user,
        deadlineAt: startedAt + QUIZ_AI_TOTAL_BUDGET_MS,
        language,
      });
      resolvedSourceQuestions = resolved.questions;
      generationWarnings.push(...resolved.warnings);
    } catch (error) {
      generationWarnings.push(
        `Source-question resolution failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  const sourceOnly = buildQuestionCandidates({
    facts: allFacts,
    extractedQuestions: allExtracted,
    resolvedSourceQuestions,
    modelOutput: null,
    targetCount,
    fillDeterministically: false,
  });

  let modelOutput: QuizModelOutput | null = null;
  const firstDocTitle =
    versionsById.get(orderedVersionIds[0]!)?.document_versions?.documents
      ?.title ?? "Workspace quiz";
  const title = params.title?.trim() || firstDocTitle;

  if (sourceOnly.questions.length < targetCount && isAiProcessingConfigured()) {
    try {
      modelOutput = await callQuizGenerator({
        studySetId: workspaceId,
        title,
        language,
        canonicalMarkdown: truncatedMarkdown,
        sectionsJson: JSON.stringify(assembled.sections),
        extractedQuestionsJson: JSON.stringify(allExtracted),
        atomicFactsJson: JSON.stringify(allFacts),
        maxSupportedCount: String(maxSupportedCount),
        requestedCount: String(targetCount),
        user,
        startedAt,
      });
    } catch (error) {
      generationWarnings.push(
        error instanceof Error
          ? `AI quiz generation failed; deterministic fill used: ${error.message}`
          : "AI quiz generation failed; deterministic fill used.",
      );
    }
  } else if (sourceOnly.questions.length < targetCount) {
    generationWarnings.push(
      "AI is not configured; deterministic quiz builder used.",
    );
  }

  const candidates = buildQuestionCandidates({
    facts: allFacts,
    extractedQuestions: allExtracted,
    resolvedSourceQuestions,
    modelOutput,
    targetCount,
  });
  const questions = candidates.questions.slice(0, targetCount);
  const generatedCount = questions.length;
  if (generatedCount !== targetCount) {
    throw new MultiSourceGenerateError(
      `Could not build ${targetCount} grounded questions from the accepted facts.`,
      422,
      "INSUFFICIENT_VALID_QUESTIONS",
      {
        requestedCount: targetCount,
        acceptedCount: generatedCount,
        missingCount: targetCount - generatedCount,
        reason: "deterministic_fill_exhausted",
      },
    );
  }

  const concepts = [
    ...new Map(
      questions.map((question) => [
        question.concept_id,
        {
          concept_id: question.concept_id,
          label: question.answer_text,
          section_key: question.section_key,
          importance: "medium" as const,
        },
      ]),
    ).values(),
  ];
  const acceptedOutput: QuizGeneratorOutput = {
    recommended_count: targetCount,
    concepts,
    questions,
    warnings: [...new Set([...generationWarnings, ...candidates.warnings])],
  };

  const quizResult = checkQuiz({
    canonical_markdown: truncatedMarkdown,
    concepts: acceptedOutput.concepts,
    questions,
    validSectionKeys: assembled.sectionKeys,
  });
  for (const warning of quizResult.warnings) {
    console.warn(`[multi-source quiz faithfulness] ${warning}`);
  }

  const promptVersion = QUIZ_PROMPT_VERSION || "1.0";
  // Placeholder bridge ID; RPC allocates the real output-specific bridge and
  // writes study_set_id + output_id onto every item row.
  const questionRows = mapQuizOutputToRows(questions, {
    userId,
    studySetId: "00000000-0000-4000-8000-000000000000",
    promptVersion,
  });

  const persisted = await createLearningOutputWithRetry(supabase, {
    workspaceId,
    title,
    generationProvenance: {
      kind: "quiz",
      prompt_version: promptVersion,
      source_canonical_version_ids: orderedVersionIds,
      generation_mode: resolveGenerationMode(candidates.modes),
      requested_count: targetCount,
    },
    snapshots,
    items: questionRows,
  });

  if (persisted.itemCount !== targetCount) {
    throw new MultiSourceGenerateError(
      `Expected to persist ${targetCount} questions; persisted ${String(persisted.itemCount)}.`,
      500,
      "PERSISTED_COUNT_MISMATCH",
      {
        requestedCount: targetCount,
        persistedCount: persisted.itemCount,
      },
    );
  }

  return {
    ok: true,
    requestedCount: targetCount,
    recommendedCount: targetCount,
    generatedCount,
    questionIds: questionRows.map((row) => row.id),
    generationMode: resolveGenerationMode(candidates.modes),
    factReuseCount:
      questions.length -
      new Set(questions.flatMap((question) => question.fact_ids)).size,
    warnings: acceptedOutput.warnings,
    rejectionSummary: candidates.rejectionSummary,
    outputId: persisted.outputId,
    bridgeStudySetId: persisted.bridgeStudySetId,
    studySetId: persisted.bridgeStudySetId,
    snapshotCount: persisted.snapshotCount,
  };
}
