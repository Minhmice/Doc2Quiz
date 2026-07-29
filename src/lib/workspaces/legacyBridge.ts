import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kind-aware legacy study-set → learning-output bridge resolver.
 *
 * Contract (mirrors public.resolve_learning_output_bridge):
 * - Bridge ID: own output + bridge-keyed history; never falls back to parent history.
 * - Historic parent ID: requires route kind; selects matching child only;
 *   history stays on the immutable parent id (quota/session/mistake rows are not
 *   duplicated or rekeyed).
 * - Unknown / inaccessible / cross-kind / cross-workspace → null.
 */

export type LegacyBridgeOutputKind = "quiz" | "flashcards";

export type LegacyBridgeRouteKind =
  | LegacyBridgeOutputKind
  | "flashcard"
  | "canonical"
  | "ingest"
  | "canonicalize"
  | "metadata";

export type LegacyBridgeResolutionMode = "bridge" | "parent";

export type LegacyBridgeResolution = {
  outputId: string;
  workspaceId: string;
  bridgeStudySetId: string;
  legacyParentStudySetId: string | null;
  kind: LegacyBridgeOutputKind;
  resolutionMode: LegacyBridgeResolutionMode;
  /** Study set id used for quota/session/mistake lookups — never rewritten. */
  historyStudySetId: string;
};

type LearningOutputRow = {
  id: string;
  workspace_id: string;
  legacy_study_set_id: string;
  legacy_parent_study_set_id: string | null;
  kind: string;
};

const OUTPUT_SELECT =
  "id, workspace_id, legacy_study_set_id, legacy_parent_study_set_id, kind";

export function normalizeLegacyBridgeRouteKind(
  routeKind: LegacyBridgeRouteKind,
): LegacyBridgeRouteKind {
  if (routeKind === "flashcard") {
    return "flashcards";
  }
  return routeKind;
}

function toOutputKind(kind: string): LegacyBridgeOutputKind | null {
  if (kind === "quiz" || kind === "flashcards") {
    return kind;
  }
  return null;
}

/**
 * Parent-path storage kind for output matching.
 * Lifecycle routes (canonical/ingest/…) locate workspace via any child; prefer quiz.
 */
function parentMatchKind(
  routeKind: LegacyBridgeRouteKind,
): LegacyBridgeOutputKind | "any" {
  const normalized = normalizeLegacyBridgeRouteKind(routeKind);
  if (normalized === "quiz" || normalized === "flashcards") {
    return normalized;
  }
  return "any";
}

async function isWorkspaceMember(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return Boolean(data);
}

function toResolution(
  row: LearningOutputRow,
  mode: LegacyBridgeResolutionMode,
): LegacyBridgeResolution | null {
  const kind = toOutputKind(row.kind);
  if (!kind) {
    return null;
  }

  const bridgeStudySetId = row.legacy_study_set_id;
  const legacyParentStudySetId = row.legacy_parent_study_set_id;

  return {
    outputId: row.id,
    workspaceId: row.workspace_id,
    bridgeStudySetId,
    legacyParentStudySetId,
    kind,
    resolutionMode: mode,
    historyStudySetId:
      mode === "bridge"
        ? bridgeStudySetId
        : (legacyParentStudySetId ?? bridgeStudySetId),
  };
}

async function loadBridgeOutput(
  supabase: SupabaseClient,
  studySetId: string,
): Promise<LearningOutputRow | null> {
  const { data, error } = await supabase
    .from("learning_outputs")
    .select(OUTPUT_SELECT)
    .eq("legacy_study_set_id", studySetId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as LearningOutputRow | null) ?? null;
}

async function loadParentOutput(
  supabase: SupabaseClient,
  studySetId: string,
  matchKind: LegacyBridgeOutputKind | "any",
): Promise<LearningOutputRow | null> {
  if (matchKind === "any") {
    const { data, error } = await supabase
      .from("learning_outputs")
      .select(OUTPUT_SELECT)
      .eq("legacy_parent_study_set_id", studySetId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return (data as LearningOutputRow | null) ?? null;
  }

  const { data, error } = await supabase
    .from("learning_outputs")
    .select(OUTPUT_SELECT)
    .eq("legacy_parent_study_set_id", studySetId)
    .eq("kind", matchKind)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as LearningOutputRow | null) ?? null;
}

/**
 * Resolve a legacy set ID to a workspace learning output under membership scope.
 * Does not duplicate, rewrite, or rekey quota/session/mistake rows.
 */
export async function resolveLegacyStudySetBridge(params: {
  supabase: SupabaseClient;
  studySetId: string;
  routeKind: LegacyBridgeRouteKind;
  userId: string;
}): Promise<LegacyBridgeResolution | null> {
  const { supabase, studySetId, routeKind, userId } = params;

  if (!studySetId || !userId) {
    return null;
  }

  const bridgeRow = await loadBridgeOutput(supabase, studySetId);
  if (bridgeRow) {
    const allowed = await isWorkspaceMember(
      supabase,
      bridgeRow.workspace_id,
      userId,
    );
    if (!allowed) {
      return null;
    }
    return toResolution(bridgeRow, "bridge");
  }

  const parentRow = await loadParentOutput(
    supabase,
    studySetId,
    parentMatchKind(routeKind),
  );
  if (!parentRow) {
    return null;
  }

  const allowed = await isWorkspaceMember(
    supabase,
    parentRow.workspace_id,
    userId,
  );
  if (!allowed) {
    return null;
  }

  return toResolution(parentRow, "parent");
}

/**
 * Locate the primary active document (+ latest version) for a resolved workspace.
 * Soft-deleted documents are skipped so snapshot study can still rely on outputs.
 */
export async function resolveLegacyWorkspaceDocument(params: {
  supabase: SupabaseClient;
  workspaceId: string;
}): Promise<{
  documentId: string;
  documentVersionId: string | null;
} | null> {
  const { supabase, workspaceId } = params;

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }
  if (!document) {
    return null;
  }

  const { data: version, error: versionError } = await supabase
    .from("document_versions")
    .select("id")
    .eq("document_id", document.id)
    .is("deleted_at", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    throw new Error(versionError.message);
  }

  return {
    documentId: document.id as string,
    documentVersionId: (version?.id as string | undefined) ?? null,
  };
}
