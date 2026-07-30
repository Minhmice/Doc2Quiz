import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type WorkspaceRole,
  workspaceSchemaContract,
} from "./schemaContract";

export type WorkspacePermissionIntent =
  | "view"
  | "edit"
  | "manage_members"
  | "manage_shares";

export type InviteRole = "editor" | "viewer";

const memberTable = workspaceSchemaContract.memberRelation;

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

const INTENT_MIN_ROLE: Record<WorkspacePermissionIntent, WorkspaceRole> = {
  view: "viewer",
  edit: "editor",
  manage_members: "owner",
  manage_shares: "owner",
};

export class WorkspacePermissionError extends Error {
  constructor(readonly code: "not_found" | "forbidden") {
    super(code);
    this.name = "WorkspacePermissionError";
  }
}

function hasIntent(role: WorkspaceRole, intent: WorkspacePermissionIntent): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[INTENT_MIN_ROLE[intent]];
}

/**
 * Intent guard for workspace routes. RLS remains the authority; this queries
 * membership through the authenticated client only.
 */
export async function requireWorkspacePermission(
  supabase: SupabaseClient,
  workspaceId: string,
  intent: WorkspacePermissionIntent,
  userId: string,
): Promise<{ role: WorkspaceRole }> {
  const { data, error } = await supabase
    .from(memberTable)
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const role = data?.role as WorkspaceRole | undefined;
  if (!role) {
    throw new WorkspacePermissionError("not_found");
  }

  if (!hasIntent(role, intent)) {
    throw new WorkspacePermissionError("forbidden");
  }

  return { role };
}

export function canWorkspaceRole(
  role: WorkspaceRole,
  intent: WorkspacePermissionIntent,
): boolean {
  return hasIntent(role, intent);
}
