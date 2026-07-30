import { parseApiError } from "@/lib/client/apiResponse";

export type WorkspaceMemberRole = "editor" | "viewer";
export type WorkspaceMembershipRole = "owner" | WorkspaceMemberRole;

export type WorkspaceMember = {
  userId: string;
  role: WorkspaceMembershipRole;
  joinedAt: string;
};

export type WorkspaceInvitation = {
  id: string;
  recipientUserId: string;
  role: WorkspaceMemberRole;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
};

export type WorkspaceShare = {
  id: string;
  targetKind: "workspace" | "quiz" | "flashcard";
  targetId: string;
  permission: "view" | "study";
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
};

export type CreateWorkspaceShareResult = WorkspaceShare & {
  shareUrl: string;
};

const GENERIC_UNAVAILABLE = "Workspace collaboration is unavailable.";

type ApiEnvelope<T> = { data: T };

function mapNetworkError(error: unknown): Error {
  if (error instanceof TypeError) {
    return new Error("Connection lost. Check your network and try again.");
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error("Request failed.");
}

export function mapCollaborationHttpError(
  status: number,
  fallback: string,
  serverMessage?: string,
): Error {
  if (status === 401 || status === 403 || status === 404) {
    return new Error(fallback);
  }
  return new Error(serverMessage ?? fallback);
}

function buildPublicShareUrl(token: string): string {
  return `/share/${token}`;
}

async function collaborationRequest<T>(
  url: string,
  init?: RequestInit,
  fallback = GENERIC_UNAVAILABLE,
): Promise<T> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        throw mapCollaborationHttpError(response.status, fallback);
      }
      throw await parseApiError(response, fallback);
    }
    const body = (await response.json()) as ApiEnvelope<T>;
    return body.data;
  } catch (error) {
    throw mapNetworkError(error);
  }
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const data = await collaborationRequest<WorkspaceMember[]>(
    `/api/workspaces/${workspaceId}/members`,
  );
  return Array.isArray(data) ? data : [];
}

export async function changeWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceMemberRole,
): Promise<WorkspaceMember> {
  return collaborationRequest<WorkspaceMember>(
    `/api/workspaces/${workspaceId}/members`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    },
  );
}

export async function revokeWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<{ userId: string; revoked: boolean }> {
  return collaborationRequest<{ userId: string; revoked: boolean }>(
    `/api/workspaces/${workspaceId}/members`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    },
  );
}

export async function listWorkspaceInvitations(
  workspaceId: string,
): Promise<WorkspaceInvitation[]> {
  const data = await collaborationRequest<WorkspaceInvitation[]>(
    `/api/workspaces/${workspaceId}/invitations`,
  );
  return Array.isArray(data) ? data : [];
}

export async function createWorkspaceInvitation(
  workspaceId: string,
  body: { recipientUserId: string; role: WorkspaceMemberRole },
): Promise<WorkspaceInvitation> {
  return collaborationRequest<WorkspaceInvitation>(
    `/api/workspaces/${workspaceId}/invitations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export async function revokeWorkspaceInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<{ id: string; revoked: boolean }> {
  return collaborationRequest<{ id: string; revoked: boolean }>(
    `/api/workspaces/${workspaceId}/invitations`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    },
  );
}

export async function listWorkspaceShares(workspaceId: string): Promise<WorkspaceShare[]> {
  const data = await collaborationRequest<WorkspaceShare[]>(
    `/api/workspaces/${workspaceId}/shares`,
  );
  return Array.isArray(data) ? data : [];
}

export async function createWorkspaceShare(
  workspaceId: string,
  body: {
    targetKind: WorkspaceShare["targetKind"];
    targetId: string;
  },
): Promise<CreateWorkspaceShareResult> {
  const data = await collaborationRequest<
    WorkspaceShare & { token?: string }
  >(`/api/workspaces/${workspaceId}/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const token = data.token;
  if (!token) {
    throw new Error(GENERIC_UNAVAILABLE);
  }

  return {
    id: data.id,
    targetKind: data.targetKind,
    targetId: data.targetId,
    permission: data.permission,
    expiresAt: data.expiresAt,
    revokedAt: data.revokedAt,
    createdAt: data.createdAt,
    shareUrl: buildPublicShareUrl(token),
  };
}

export async function revokeWorkspaceShare(
  workspaceId: string,
  shareId: string,
): Promise<{ id: string; revoked: boolean }> {
  return collaborationRequest<{ id: string; revoked: boolean }>(
    `/api/workspaces/${workspaceId}/shares`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId }),
    },
  );
}

export function canManageWorkspaceCollaboration(
  role: WorkspaceMembershipRole,
): boolean {
  return role === "owner";
}
