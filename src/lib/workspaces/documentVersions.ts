import type { SupabaseClient } from "@supabase/supabase-js";

import {
  runWorkspaceIngest,
  type WorkspaceIngestPayload,
  type WorkspaceIngestResult,
} from "@/lib/workspaces/createWorkspaceIngest";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
  WorkspaceValidationError,
} from "@/lib/workspaces/errors";
import type { DocumentPatch, WorkspacePatch } from "@/lib/workspaces/schemas";

type WorkspaceRole = "owner" | "editor" | "viewer";

async function requireWorkspaceEditor(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole> {
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
    throw new WorkspaceForbiddenError("Viewer cannot modify this workspace");
  }
  return data.role as WorkspaceRole;
}

export async function patchWorkspaceMetadata(params: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  patch: WorkspacePatch;
}): Promise<{ id: string; title: string; subtitle: string | null }> {
  const { supabase, userId, workspaceId, patch } = params;
  await requireWorkspaceEditor(supabase, userId, workspaceId);

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    update.title = patch.title;
  }
  if (patch.subtitle !== undefined) {
    update.subtitle =
      typeof patch.subtitle === "string"
        ? patch.subtitle.trim() || null
        : patch.subtitle;
  }

  if (Object.keys(update).length === 0) {
    throw new WorkspaceValidationError("No valid fields to update");
  }

  const { data, error } = await supabase
    .from("workspaces")
    .update(update)
    .eq("id", workspaceId)
    .is("deleted_at", null)
    .select("id, title, subtitle")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new WorkspaceNotFoundError("Workspace not found");
  }

  return data;
}

export async function patchDocumentMetadata(params: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  documentId: string;
  patch: DocumentPatch & Record<string, unknown>;
}): Promise<{
  id: string;
  title: string;
  description: string | null;
}> {
  const { supabase, userId, workspaceId, documentId, patch } = params;

  const forbiddenKeys = Object.keys(patch).filter(
    (key) => key !== "title" && key !== "description",
  );
  if (forbiddenKeys.length > 0) {
    throw new WorkspaceValidationError(
      `Document metadata cannot include: ${forbiddenKeys.join(", ")}`,
    );
  }

  await requireWorkspaceEditor(supabase, userId, workspaceId);

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    update.title = patch.title;
  }
  if (patch.description !== undefined) {
    update.description =
      typeof patch.description === "string"
        ? patch.description.trim() || null
        : patch.description;
  }

  if (Object.keys(update).length === 0) {
    throw new WorkspaceValidationError("No valid fields to update");
  }

  const { data, error } = await supabase
    .from("documents")
    .update(update)
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select("id, title, description")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new WorkspaceNotFoundError("Document not found");
  }

  return data;
}

export async function softDeleteDocument(params: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  documentId: string;
}): Promise<{ id: string }> {
  const { supabase, userId, workspaceId, documentId } = params;
  await requireWorkspaceEditor(supabase, userId, workspaceId);

  const { data, error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new WorkspaceNotFoundError("Document not found");
  }

  return data;
}

export async function softDeleteDocumentVersion(params: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  documentId: string;
  documentVersionId: string;
}): Promise<{ id: string }> {
  const {
    supabase,
    userId,
    workspaceId,
    documentId,
    documentVersionId,
  } = params;
  await requireWorkspaceEditor(supabase, userId, workspaceId);

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, workspace_id")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }
  if (!document) {
    throw new WorkspaceNotFoundError("Document not found");
  }

  const { data, error } = await supabase
    .from("document_versions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentVersionId)
    .eq("document_id", documentId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new WorkspaceNotFoundError("Document version not found");
  }

  return data;
}

/** Replacement: appends document version N+1 via workspace-native ingest. */
export async function appendDocumentVersion(params: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  documentId: string;
  payload: WorkspaceIngestPayload;
}): Promise<WorkspaceIngestResult> {
  return runWorkspaceIngest({
    supabase: params.supabase,
    userId: params.userId,
    workspaceId: params.workspaceId,
    documentId: params.documentId,
    payload: params.payload,
  });
}

/**
 * Narrow legacy adapter: resolve workspace identity from
 * `learning_outputs.legacy_study_set_id`. Full study-set route adapters land in 09-07/09-08.
 * Does not delete study_sets or rewrite session/quota FK behavior.
 */
export async function resolveLegacyStudySetBridge(params: {
  supabase: SupabaseClient;
  legacyStudySetId: string;
}): Promise<{
  workspaceId: string;
  legacyStudySetId: string;
  learningOutputId: string;
} | null> {
  const { data, error } = await params.supabase
    .from("learning_outputs")
    .select("id, workspace_id, legacy_study_set_id")
    .eq("legacy_study_set_id", params.legacyStudySetId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  return {
    workspaceId: data.workspace_id,
    legacyStudySetId: data.legacy_study_set_id,
    learningOutputId: data.id,
  };
}
