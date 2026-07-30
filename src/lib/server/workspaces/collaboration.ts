import type { SupabaseClient } from "@supabase/supabase-js";

import type { InviteRole } from "./permissions";

export type CollaborationErrorCode =
  | "invalid"
  | "forbidden"
  | "not_found"
  | "expired"
  | "invitation_exists";

export class CollaborationError extends Error {
  constructor(readonly code: CollaborationErrorCode) {
    super(code);
    this.name = "CollaborationError";
  }
}

const RPC_ERROR_CODES: CollaborationErrorCode[] = [
  "invalid",
  "forbidden",
  "not_found",
  "expired",
  "invitation_exists",
];

type RpcClient = Pick<SupabaseClient, "rpc">;

function mapRpcError(error: { message: string }): CollaborationError {
  const code =
    RPC_ERROR_CODES.find((candidate) => error.message.includes(candidate)) ??
    "not_found";
  return new CollaborationError(code);
}

async function callRpc<T>(rpc: RpcClient["rpc"], fn: string, args: Record<string, unknown>) {
  const { data, error } = await rpc(fn, args);
  if (error) {
    throw mapRpcError(error);
  }
  if (data === null) {
    throw new CollaborationError("not_found");
  }
  return data as T;
}

export type WorkspaceInvitationDto = {
  id: string;
  recipientUserId: string;
  role: InviteRole;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
};

export type WorkspaceMemberDto = {
  userId: string;
  role: InviteRole | "owner";
  joinedAt: string;
};

export type WorkspaceShareDto = {
  id: string;
  targetKind: "workspace" | "quiz" | "flashcard";
  targetId: string;
  permission: "view" | "study";
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
};

export async function createWorkspaceInvitation(
  supabase: RpcClient,
  workspaceId: string,
  recipientUserId: string,
  role: InviteRole,
) {
  return callRpc<WorkspaceInvitationDto>(supabase.rpc, "create_workspace_invitation", {
    p_workspace_id: workspaceId,
    p_recipient_user_id: recipientUserId,
    p_role: role,
  });
}

export async function listWorkspaceInvitations(supabase: RpcClient, workspaceId: string) {
  const result = await callRpc<{ invitations: WorkspaceInvitationDto[] }>(
    supabase.rpc,
    "list_workspace_invitations",
    { p_workspace_id: workspaceId },
  );
  return result.invitations;
}

export async function revokeWorkspaceInvitation(supabase: RpcClient, invitationId: string) {
  return callRpc<{ id: string; revoked: boolean }>(
    supabase.rpc,
    "revoke_workspace_invitation",
    { p_invitation_id: invitationId },
  );
}

export async function acceptWorkspaceInvitation(supabase: RpcClient, invitationId: string) {
  return callRpc<{
    workspaceId: string;
    role: InviteRole;
    alreadyAccepted: boolean;
  }>(supabase.rpc, "accept_workspace_invitation", { p_invitation_id: invitationId });
}

export async function listWorkspaceMembers(supabase: RpcClient, workspaceId: string) {
  const result = await callRpc<{ members: WorkspaceMemberDto[] }>(
    supabase.rpc,
    "list_workspace_members",
    { p_workspace_id: workspaceId },
  );
  return result.members;
}

export async function changeWorkspaceMemberRole(
  supabase: RpcClient,
  workspaceId: string,
  userId: string,
  role: InviteRole,
) {
  return callRpc<{ userId: string; role: InviteRole }>(
    supabase.rpc,
    "change_workspace_member_role",
    {
      p_workspace_id: workspaceId,
      p_user_id: userId,
      p_role: role,
    },
  );
}

export async function revokeWorkspaceMember(
  supabase: RpcClient,
  workspaceId: string,
  userId: string,
) {
  return callRpc<{ userId: string; revoked: boolean }>(
    supabase.rpc,
    "revoke_workspace_member",
    {
      p_workspace_id: workspaceId,
      p_user_id: userId,
    },
  );
}

export async function createWorkspaceShare(
  supabase: RpcClient,
  workspaceId: string,
  targetKind: WorkspaceShareDto["targetKind"],
  targetId: string,
  tokenDigest: Uint8Array,
) {
  return callRpc<WorkspaceShareDto>(supabase.rpc, "create_workspace_share", {
    p_workspace_id: workspaceId,
    p_target_kind: targetKind,
    p_target_id: targetId,
    p_token_digest: `\\x${Buffer.from(tokenDigest).toString("hex")}`,
  });
}

export async function listWorkspaceShares(supabase: RpcClient, workspaceId: string) {
  const result = await callRpc<{ shares: WorkspaceShareDto[] }>(
    supabase.rpc,
    "list_workspace_shares",
    { p_workspace_id: workspaceId },
  );
  return result.shares;
}

export async function revokeWorkspaceShare(supabase: RpcClient, shareId: string) {
  return callRpc<{ id: string; revoked: boolean }>(
    supabase.rpc,
    "revoke_workspace_share",
    { p_share_id: shareId },
  );
}
