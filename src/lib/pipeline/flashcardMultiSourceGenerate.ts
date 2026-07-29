import type { SupabaseClient, User } from "@supabase/supabase-js";

import { dedupeAndCapFlashcards } from "@/lib/pipeline/dedupeAndCapFlashcards";
import { checkFlashcard } from "@/lib/pipeline/faithfulness";
import {
  callFlashcardGenerator,
  filterSectionsByCoverage,
  resolveCoverageMode,
  resolveRequestedCount,
  truncateCanonicalMarkdown,
  type FlashcardGenerateSuccess,
} from "@/lib/pipeline/flashcardGenerate";
import { FLASHCARD_PROMPT_VERSION } from "@/lib/pipeline/flashcardPrompt";
import type { FlashcardGenerateBody } from "@/lib/pipeline/flashcardSchemas";
import { mapFlashcardOutputToRows } from "@/lib/pipeline/mapFlashcardOutputToRows";
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

const SUPABASE_WRITE_MAX_ATTEMPTS = 3;
const PLACEHOLDER_BRIDGE_STUDY_SET_ID =
  "00000000-0000-4000-8000-000000000000";

export class MultiSourceFlashcardValidationError extends Error {
  readonly name = "MultiSourceFlashcardValidationError";
}

export class MultiSourceFlashcardGenerateError extends Error {
  readonly name = "MultiSourceFlashcardGenerateError";
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, number | string>;

  constructor(
    message: string,
    statusCode = 422,
    code = "FLASHCARD_GENERATION_FAILED",
    details?: Record<string, number | string>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export type MultiSourceFlashcardGenerateSuccess = FlashcardGenerateSuccess & {
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
  extracted_questions?: unknown[];
  language?: string;
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
    heading: string;
    body_markdown: string;
    section_key: string;
  }>;
  sectionKeys: string[];
} {
  const parts: string[] = [];
  const sections: Array<{
    ordinal: number;
    heading: string;
    body_markdown: string;
    section_key: string;
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
        heading: section.heading ?? "",
        body_markdown: section.body_markdown,
        section_key: sectionKey,
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
    throw new WorkspaceForbiddenError(
      "Viewer cannot generate flashcard outputs",
    );
  }
}

async function createLearningOutputWithRetry(
  supabase: SupabaseClient,
  args: {
    workspaceId: string;
    title: string;
    generationProvenance: Record<string, unknown>;
    snapshots: OutputSourceSnapshot[];
    items: ReturnType<typeof mapFlashcardOutputToRows>;
  },
): Promise<{
  outputId: string;
  bridgeStudySetId: string;
  itemCount: number;
  snapshotCount: number;
}> {
  const rpcArgs = {
    p_workspace_id: args.workspaceId,
    p_kind: "flashcards",
    p_title: args.title,
    p_generation_provenance: args.generationProvenance,
    p_snapshots: args.snapshots,
    p_expected_item_count: args.items.length,
    p_items: args.items.map((item) => ({
      id: item.id,
      front: item.front,
      back: item.back,
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
        throw new MultiSourceFlashcardGenerateError(
          "create_learning_output returned an incomplete bridge/output payload.",
          500,
          "FLASHCARD_PERSISTENCE_FAILED",
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
      throw new MultiSourceFlashcardGenerateError(
        formatSupabaseNetworkError(error.message),
        isSupabaseNetworkError(error.message) ? 503 : 500,
        "FLASHCARD_PERSISTENCE_FAILED",
      );
    }
    await sleep(750 * attempt);
  }

  throw new MultiSourceFlashcardGenerateError(
    "create_learning_output failed after retries.",
    503,
    "FLASHCARD_PERSISTENCE_FAILED",
  );
}

/**
 * Workspace-native multi-source flashcard generation.
 * Never deletes quiz or prior flashcard outputs (no cross-mode cleanup).
 */
export async function runMultiSourceFlashcardGenerate(params: {
  supabase: SupabaseClient;
  user: User;
  userId: string;
  workspaceId: string;
  canonicalVersionIds: string[];
  learningGoal: FlashcardGenerateBody["learningGoal"];
  coverage: FlashcardGenerateBody["coverage"];
  amount: FlashcardGenerateBody["amount"];
  /** Optional title override; defaults to first document title. */
  title?: string;
}): Promise<MultiSourceFlashcardGenerateSuccess> {
  const {
    supabase,
    user,
    userId,
    workspaceId,
    learningGoal,
    coverage,
    amount,
  } = params;

  await requireWorkspaceEditor(supabase, userId, workspaceId);

  const orderedVersionIds = dedupeCanonicalVersionIds(
    params.canonicalVersionIds,
  );
  if (orderedVersionIds.length === 0) {
    throw new MultiSourceFlashcardValidationError(
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
      throw new MultiSourceFlashcardValidationError(
        `Canonical version not found: ${versionId}`,
      );
    }
    if (row.deleted_at != null) {
      throw new MultiSourceFlashcardValidationError(
        `Canonical version is deleted: ${versionId}`,
      );
    }
    if (row.status !== "completed") {
      throw new MultiSourceFlashcardValidationError(
        `Canonical version is not completed: ${versionId}`,
      );
    }
    const documentVersion = row.document_versions;
    const document = documentVersion?.documents ?? null;
    if (!documentVersion || documentVersion.deleted_at != null) {
      throw new MultiSourceFlashcardValidationError(
        `Document version is deleted for canonical version: ${versionId}`,
      );
    }
    if (!document || document.deleted_at != null) {
      throw new MultiSourceFlashcardValidationError(
        `Document is deleted for canonical version: ${versionId}`,
      );
    }
    if (document.workspace_id !== workspaceId) {
      throw new MultiSourceFlashcardValidationError(
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
      throw new MultiSourceFlashcardValidationError(
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

  if (coverage !== "entire_document") {
    const available = new Set(assembled.sectionKeys);
    const missing = coverage.sectionKeys.filter((key) => !available.has(key));
    if (missing.length > 0) {
      throw new MultiSourceFlashcardValidationError(
        `Coverage section keys are not in selected sources: ${missing.join(", ")}`,
      );
    }
  }

  const filteredSections = filterSectionsByCoverage(
    assembled.sections,
    coverage,
  );
  if (filteredSections.length === 0) {
    throw new MultiSourceFlashcardValidationError(
      "No sections remain after applying coverage to selected sources.",
    );
  }

  if (!isAiProcessingConfigured()) {
    throw new MultiSourceFlashcardGenerateError(
      "AI processing is not configured.",
      503,
      "AI_NOT_CONFIGURED",
    );
  }

  const { markdown: truncatedMarkdown } = truncateCanonicalMarkdown(
    assembled.markdown,
  );

  const allExtracted: unknown[] = [];
  let language = "en";
  for (const snapshot of snapshots) {
    const metadata = snapshot.canonical_metadata as CanonicalMetadata;
    language = metadata.language ?? language;
    if (Array.isArray(metadata.extracted_questions)) {
      allExtracted.push(...metadata.extracted_questions);
    }
  }

  const firstDocTitle =
    versionsById.get(orderedVersionIds[0]!)?.document_versions?.documents
      ?.title ?? "Workspace flashcards";
  const title = params.title?.trim() || firstDocTitle;

  let output;
  try {
    output = await callFlashcardGenerator({
      studySetId: workspaceId,
      title,
      language,
      learningGoal,
      canonicalMarkdown: truncatedMarkdown,
      sectionsJson: JSON.stringify(filteredSections),
      extractedQuestionsJson: JSON.stringify(allExtracted),
      requestedCount: resolveRequestedCount(amount),
      coverageMode: resolveCoverageMode(coverage),
      user,
    });
  } catch (error) {
    if (error instanceof MultiSourceFlashcardGenerateError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Flashcard generation failed.";
    const statusCode =
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 422;
    throw new MultiSourceFlashcardGenerateError(
      message,
      statusCode,
      statusCode === 503 ? "AI_NOT_CONFIGURED" : "FLASHCARD_GENERATION_FAILED",
    );
  }

  const {
    cards,
    recommendedCount,
    generatedCount,
    detectedFormat,
  } = dedupeAndCapFlashcards(output, amount);

  const flashcardResult = checkFlashcard({
    concepts: output.concepts,
    cards,
    validSectionKeys: assembled.sectionKeys,
  });
  for (const warning of flashcardResult.warnings) {
    console.warn(`[multi-source flashcard faithfulness] ${warning}`);
  }

  const promptVersion = FLASHCARD_PROMPT_VERSION || "1.0";
  // Placeholder bridge ID; RPC allocates the real output-specific bridge and
  // writes study_set_id + output_id onto every item row.
  const rows = mapFlashcardOutputToRows(cards, {
    userId,
    studySetId: PLACEHOLDER_BRIDGE_STUDY_SET_ID,
    promptVersion,
    detectedFormat,
    learningGoal,
  });

  if (rows.length === 0) {
    throw new MultiSourceFlashcardGenerateError(
      "Flashcard generation produced no cards to persist.",
      422,
      "INSUFFICIENT_VALID_FLASHCARDS",
    );
  }

  const persisted = await createLearningOutputWithRetry(supabase, {
    workspaceId,
    title,
    generationProvenance: {
      kind: "flashcards",
      prompt_version: promptVersion,
      source_canonical_version_ids: orderedVersionIds,
      learning_goal: learningGoal,
      coverage_mode: resolveCoverageMode(coverage),
      detected_format: detectedFormat,
    },
    snapshots,
    items: rows,
  });

  if (persisted.itemCount !== rows.length) {
    throw new MultiSourceFlashcardGenerateError(
      `Expected to persist ${rows.length} cards; persisted ${String(persisted.itemCount)}.`,
      500,
      "PERSISTED_COUNT_MISMATCH",
      {
        requestedCount: rows.length,
        persistedCount: persisted.itemCount,
      },
    );
  }

  return {
    ok: true,
    recommendedCount,
    generatedCount,
    detectedFormat,
    cardIds: rows.map((row) => row.id),
    outputId: persisted.outputId,
    bridgeStudySetId: persisted.bridgeStudySetId,
    studySetId: persisted.bridgeStudySetId,
    snapshotCount: persisted.snapshotCount,
  };
}
