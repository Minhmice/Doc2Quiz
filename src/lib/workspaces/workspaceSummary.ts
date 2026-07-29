import type { SupabaseClient } from "@supabase/supabase-js";

import {
  WorkspaceNotFoundError,
  WorkspaceValidationError,
} from "@/lib/workspaces/errors";

export type WorkspaceRole = "owner" | "editor" | "viewer";

export type RecentOutputSummary = {
  id: string;
  kind: "quiz" | "flashcards";
  title: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  /** Bridge study-set id for `/quiz/[setId]` and `/flashcard/[setId]` routes. */
  bridgeStudySetId: string;
};

export type WorkspaceSummary = {
  id: string;
  title: string;
  subtitle: string | null;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
  canonicalVersionCount: number;
  quizOutputCount: number;
  flashcardOutputCount: number;
  recentOutputs: RecentOutputSummary[];
};

export type WorkspaceDetailCanonicalVersion = {
  id: string;
  documentVersionId: string;
  versionNumber: number;
  status: string;
  model: string | null;
  promptVersion: string | null;
  parserVersion: string | null;
  createdAt: string;
  provenanceLabel: string;
};

export type WorkspaceDetailDocumentVersion = {
  id: string;
  versionNumber: number;
  sourceKind: string;
  originalFilename: string | null;
  createdAt: string;
  canonicalVersions: WorkspaceDetailCanonicalVersion[];
};

export type WorkspaceDetailDocument = {
  id: string;
  title: string;
  description: string | null;
  updatedAt: string;
  versions: WorkspaceDetailDocumentVersion[];
};

export type WorkspaceDetail = {
  id: string;
  title: string;
  subtitle: string | null;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
  documents: WorkspaceDetailDocument[];
  outputs: RecentOutputSummary[];
};

const RECENT_OUTPUTS_PER_WORKSPACE = 5;

const FORBIDDEN_MARKDOWN_SELECT_FRAGMENTS = [
  "canonical_markdown",
  "raw_markdown",
  "body_markdown",
] as const;

/** Guard used by tests and callers to ensure list/detail never request body markdown. */
export function assertNoMarkdownSelection(selectClause: string): void {
  const normalized = selectClause.toLowerCase();
  for (const fragment of FORBIDDEN_MARKDOWN_SELECT_FRAGMENTS) {
    if (normalized.includes(fragment)) {
      throw new WorkspaceValidationError(
        `Workspace summary/detail must not select ${fragment}`,
      );
    }
  }
}

function provenanceLabel(params: {
  model: string | null;
  promptVersion: string | null;
  parserVersion: string | null;
  provenance: Record<string, unknown> | null | undefined;
}): string {
  const mode =
    typeof params.provenance?.mode === "string" ? params.provenance.mode : null;
  const parts = [
    mode,
    params.model,
    params.promptVersion ? `prompt ${params.promptVersion}` : null,
    params.parserVersion ? `parser ${params.parserVersion}` : null,
  ].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length > 0 ? parts.join(" · ") : "Canonical version";
}

function mapOutputRow(row: {
  id: string;
  kind: string;
  title: string;
  status: string;
  updated_at: string;
  created_at: string;
  legacy_study_set_id: string;
}): RecentOutputSummary {
  return {
    id: row.id,
    kind: row.kind === "flashcards" ? "flashcards" : "quiz",
    title: row.title,
    status: row.status,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    bridgeStudySetId: row.legacy_study_set_id,
  };
}

type MembershipRow = {
  role: string;
  workspace_id: string;
  workspaces: {
    id: string;
    title: string;
    subtitle: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
};

/**
 * Membership-authorized aggregate dashboard read model.
 * Soft-deleted sources are excluded from document/canonical counts;
 * active learning outputs remain counted even when their sources were deleted.
 * Never selects canonical/raw/section body markdown.
 */
export async function listWorkspaceSummaries(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<WorkspaceSummary[]> {
  const { supabase, userId } = params;

  const membershipSelect =
    "role, workspace_id, workspaces!inner(id, title, subtitle, created_at, updated_at, deleted_at)";
  assertNoMarkdownSelection(membershipSelect);

  const { data: membershipRows, error: membershipError } = await supabase
    .from("workspace_members")
    .select(membershipSelect)
    .eq("user_id", userId)
    .is("workspaces.deleted_at", null);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const memberships = (membershipRows ?? []) as unknown as MembershipRow[];
  if (memberships.length === 0) {
    return [];
  }

  const workspaceIds = memberships.map((row) => row.workspaces.id);

  const documentsSelect = "id, workspace_id";
  assertNoMarkdownSelection(documentsSelect);
  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select(documentsSelect)
    .in("workspace_id", workspaceIds)
    .is("deleted_at", null);

  if (documentsError) {
    throw new Error(documentsError.message);
  }

  const activeDocuments = documents ?? [];
  const documentIds = activeDocuments.map((doc) => doc.id as string);

  const versionsSelect = "id, document_id";
  assertNoMarkdownSelection(versionsSelect);
  const versionToDocument = new Map<string, string>();
  const documentToWorkspace = new Map<string, string>();
  for (const doc of activeDocuments) {
    documentToWorkspace.set(doc.id as string, doc.workspace_id as string);
  }

  let activeVersionIds: string[] = [];
  if (documentIds.length > 0) {
    const { data: versions, error: versionsError } = await supabase
      .from("document_versions")
      .select(versionsSelect)
      .in("document_id", documentIds)
      .is("deleted_at", null);

    if (versionsError) {
      throw new Error(versionsError.message);
    }
    for (const row of versions ?? []) {
      const versionId = row.id as string;
      versionToDocument.set(versionId, row.document_id as string);
      activeVersionIds.push(versionId);
    }
  }

  const canonicalSelect = "id, document_version_id, status";
  assertNoMarkdownSelection(canonicalSelect);
  const canonicalByVersion = new Map<string, number>();
  if (activeVersionIds.length > 0) {
    const { data: canonicals, error: canonicalError } = await supabase
      .from("canonical_versions")
      .select(canonicalSelect)
      .in("document_version_id", activeVersionIds)
      .is("deleted_at", null);

    if (canonicalError) {
      throw new Error(canonicalError.message);
    }
    for (const row of canonicals ?? []) {
      const versionId = row.document_version_id as string;
      canonicalByVersion.set(
        versionId,
        (canonicalByVersion.get(versionId) ?? 0) + 1,
      );
    }
  }

  const documentCountByWorkspace = new Map<string, number>();
  for (const doc of activeDocuments) {
    const workspaceId = doc.workspace_id as string;
    documentCountByWorkspace.set(
      workspaceId,
      (documentCountByWorkspace.get(workspaceId) ?? 0) + 1,
    );
  }

  const canonicalCountByWorkspace = new Map<string, number>();
  for (const [versionId, count] of canonicalByVersion) {
    const documentId = versionToDocument.get(versionId);
    if (!documentId) continue;
    const workspaceId = documentToWorkspace.get(documentId);
    if (!workspaceId) continue;
    canonicalCountByWorkspace.set(
      workspaceId,
      (canonicalCountByWorkspace.get(workspaceId) ?? 0) + count,
    );
  }

  const outputsSelect =
    "id, workspace_id, kind, title, status, updated_at, created_at, legacy_study_set_id";
  assertNoMarkdownSelection(outputsSelect);
  const { data: outputs, error: outputsError } = await supabase
    .from("learning_outputs")
    .select(outputsSelect)
    .in("workspace_id", workspaceIds)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (outputsError) {
    throw new Error(outputsError.message);
  }

  const quizCountByWorkspace = new Map<string, number>();
  const flashcardCountByWorkspace = new Map<string, number>();
  const recentByWorkspace = new Map<string, RecentOutputSummary[]>();

  for (const row of outputs ?? []) {
    const workspaceId = row.workspace_id as string;
    const mapped = mapOutputRow({
      id: row.id as string,
      kind: row.kind as string,
      title: row.title as string,
      status: row.status as string,
      updated_at: row.updated_at as string,
      created_at: row.created_at as string,
      legacy_study_set_id: row.legacy_study_set_id as string,
    });

    if (mapped.kind === "flashcards") {
      flashcardCountByWorkspace.set(
        workspaceId,
        (flashcardCountByWorkspace.get(workspaceId) ?? 0) + 1,
      );
    } else {
      quizCountByWorkspace.set(
        workspaceId,
        (quizCountByWorkspace.get(workspaceId) ?? 0) + 1,
      );
    }

    const recent = recentByWorkspace.get(workspaceId) ?? [];
    if (recent.length < RECENT_OUTPUTS_PER_WORKSPACE) {
      recent.push(mapped);
      recentByWorkspace.set(workspaceId, recent);
    }
  }

  const summaries = memberships.map((row) => {
    const workspace = row.workspaces;
    return {
      id: workspace.id,
      title: workspace.title,
      subtitle: workspace.subtitle,
      role: row.role as WorkspaceRole,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
      documentCount: documentCountByWorkspace.get(workspace.id) ?? 0,
      canonicalVersionCount: canonicalCountByWorkspace.get(workspace.id) ?? 0,
      quizOutputCount: quizCountByWorkspace.get(workspace.id) ?? 0,
      flashcardOutputCount: flashcardCountByWorkspace.get(workspace.id) ?? 0,
      recentOutputs: recentByWorkspace.get(workspace.id) ?? [],
    } satisfies WorkspaceSummary;
  });

  summaries.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return summaries;
}

/**
 * Membership-authorized workspace detail index: documents, immutable versions,
 * and outputs — never canonical/raw body markdown.
 */
export async function getWorkspaceDetail(params: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}): Promise<WorkspaceDetail> {
  const { supabase, userId, workspaceId } = params;

  const membershipSelect = "role";
  assertNoMarkdownSelection(membershipSelect);
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select(membershipSelect)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }
  if (!membership) {
    throw new WorkspaceNotFoundError("Workspace not found");
  }

  const workspaceSelect = "id, title, subtitle, created_at, updated_at, deleted_at";
  assertNoMarkdownSelection(workspaceSelect);
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select(workspaceSelect)
    .eq("id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (workspaceError) {
    throw new Error(workspaceError.message);
  }
  if (!workspace) {
    throw new WorkspaceNotFoundError("Workspace not found");
  }

  const documentsSelect = "id, title, description, updated_at";
  assertNoMarkdownSelection(documentsSelect);
  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select(documentsSelect)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (documentsError) {
    throw new Error(documentsError.message);
  }

  const activeDocuments = documents ?? [];
  const documentIds = activeDocuments.map((doc) => doc.id as string);

  const versionsSelect =
    "id, document_id, version_number, source_kind, original_filename, created_at";
  assertNoMarkdownSelection(versionsSelect);
  let versionRows: Array<Record<string, unknown>> = [];
  if (documentIds.length > 0) {
    const { data: versions, error: versionsError } = await supabase
      .from("document_versions")
      .select(versionsSelect)
      .in("document_id", documentIds)
      .is("deleted_at", null)
      .order("version_number", { ascending: false });

    if (versionsError) {
      throw new Error(versionsError.message);
    }
    versionRows = (versions ?? []) as Array<Record<string, unknown>>;
  }

  const versionIds = versionRows.map((row) => row.id as string);
  const canonicalSelect =
    "id, document_version_id, version_number, status, model, prompt_version, parser_version, created_at, provenance";
  assertNoMarkdownSelection(canonicalSelect);

  let canonicalRows: Array<Record<string, unknown>> = [];
  if (versionIds.length > 0) {
    const { data: canonicals, error: canonicalError } = await supabase
      .from("canonical_versions")
      .select(canonicalSelect)
      .in("document_version_id", versionIds)
      .is("deleted_at", null)
      .order("version_number", { ascending: false });

    if (canonicalError) {
      throw new Error(canonicalError.message);
    }
    canonicalRows = (canonicals ?? []) as Array<Record<string, unknown>>;
  }

  const canonicalByDocumentVersion = new Map<
    string,
    WorkspaceDetailCanonicalVersion[]
  >();
  for (const row of canonicalRows) {
    const documentVersionId = row.document_version_id as string;
    const entry: WorkspaceDetailCanonicalVersion = {
      id: row.id as string,
      documentVersionId,
      versionNumber: row.version_number as number,
      status: row.status as string,
      model: (row.model as string | null) ?? null,
      promptVersion: (row.prompt_version as string | null) ?? null,
      parserVersion: (row.parser_version as string | null) ?? null,
      createdAt: row.created_at as string,
      provenanceLabel: provenanceLabel({
        model: (row.model as string | null) ?? null,
        promptVersion: (row.prompt_version as string | null) ?? null,
        parserVersion: (row.parser_version as string | null) ?? null,
        provenance: row.provenance as Record<string, unknown> | null,
      }),
    };
    const list = canonicalByDocumentVersion.get(documentVersionId) ?? [];
    list.push(entry);
    canonicalByDocumentVersion.set(documentVersionId, list);
  }

  const versionsByDocument = new Map<string, WorkspaceDetailDocumentVersion[]>();
  for (const row of versionRows) {
    const documentId = row.document_id as string;
    const entry: WorkspaceDetailDocumentVersion = {
      id: row.id as string,
      versionNumber: row.version_number as number,
      sourceKind: row.source_kind as string,
      originalFilename: (row.original_filename as string | null) ?? null,
      createdAt: row.created_at as string,
      canonicalVersions: canonicalByDocumentVersion.get(row.id as string) ?? [],
    };
    const list = versionsByDocument.get(documentId) ?? [];
    list.push(entry);
    versionsByDocument.set(documentId, list);
  }

  const detailDocuments: WorkspaceDetailDocument[] = activeDocuments.map(
    (doc) => ({
      id: doc.id as string,
      title: doc.title as string,
      description: (doc.description as string | null) ?? null,
      updatedAt: doc.updated_at as string,
      versions: versionsByDocument.get(doc.id as string) ?? [],
    }),
  );

  const outputsSelect =
    "id, workspace_id, kind, title, status, updated_at, created_at, legacy_study_set_id";
  assertNoMarkdownSelection(outputsSelect);
  const { data: outputs, error: outputsError } = await supabase
    .from("learning_outputs")
    .select(outputsSelect)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (outputsError) {
    throw new Error(outputsError.message);
  }

  return {
    id: workspace.id as string,
    title: workspace.title as string,
    subtitle: (workspace.subtitle as string | null) ?? null,
    role: membership.role as WorkspaceRole,
    createdAt: workspace.created_at as string,
    updatedAt: workspace.updated_at as string,
    documents: detailDocuments,
    outputs: (outputs ?? []).map((row) =>
      mapOutputRow({
        id: row.id as string,
        kind: row.kind as string,
        title: row.title as string,
        status: row.status as string,
        updated_at: row.updated_at as string,
        created_at: row.created_at as string,
        legacy_study_set_id: row.legacy_study_set_id as string,
      }),
    ),
  };
}
