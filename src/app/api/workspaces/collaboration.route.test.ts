import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import { CollaborationError } from "@/lib/server/workspaces/collaboration";
import { WorkspacePermissionError } from "@/lib/server/workspaces/permissions";

const requireApiUserMock = vi.fn();
const requireWorkspacePermissionMock = vi.fn();
const createWorkspaceInvitationMock = vi.fn();
const listWorkspaceInvitationsMock = vi.fn();
const revokeWorkspaceInvitationMock = vi.fn();
const acceptWorkspaceInvitationMock = vi.fn();
const listWorkspaceMembersMock = vi.fn();
const changeWorkspaceMemberRoleMock = vi.fn();
const revokeWorkspaceMemberMock = vi.fn();
const createWorkspaceShareMock = vi.fn();
const listWorkspaceSharesMock = vi.fn();
const revokeWorkspaceShareMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

vi.mock("@/lib/server/workspaces/permissions", () => ({
  requireWorkspacePermission: (...args: unknown[]) =>
    requireWorkspacePermissionMock(...args),
  WorkspacePermissionError: class WorkspacePermissionError extends Error {
    constructor(readonly code: "not_found" | "forbidden") {
      super(code);
      this.name = "WorkspacePermissionError";
    }
  },
}));

vi.mock("@/lib/server/workspaces/collaboration", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/server/workspaces/collaboration")
  >();
  return {
    ...actual,
    createWorkspaceInvitation: (...args: unknown[]) =>
      createWorkspaceInvitationMock(...args),
    listWorkspaceInvitations: (...args: unknown[]) =>
      listWorkspaceInvitationsMock(...args),
    revokeWorkspaceInvitation: (...args: unknown[]) =>
      revokeWorkspaceInvitationMock(...args),
    acceptWorkspaceInvitation: (...args: unknown[]) =>
      acceptWorkspaceInvitationMock(...args),
    listWorkspaceMembers: (...args: unknown[]) =>
      listWorkspaceMembersMock(...args),
    changeWorkspaceMemberRole: (...args: unknown[]) =>
      changeWorkspaceMemberRoleMock(...args),
    revokeWorkspaceMember: (...args: unknown[]) =>
      revokeWorkspaceMemberMock(...args),
    createWorkspaceShare: (...args: unknown[]) =>
      createWorkspaceShareMock(...args),
    listWorkspaceShares: (...args: unknown[]) =>
      listWorkspaceSharesMock(...args),
    revokeWorkspaceShare: (...args: unknown[]) =>
      revokeWorkspaceShareMock(...args),
  };
});

import { POST as acceptInvitation } from "@/app/api/invitations/[id]/accept/route";
import {
  DELETE as deleteInvitation,
  GET as getInvitations,
  POST as postInvitation,
} from "@/app/api/workspaces/[id]/invitations/route";
import {
  DELETE as deleteMember,
  GET as getMembers,
  PATCH as patchMember,
} from "@/app/api/workspaces/[id]/members/route";
import {
  DELETE as deleteShare,
  GET as getShares,
  POST as postShare,
} from "@/app/api/workspaces/[id]/shares/route";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const recipientId = "00000000-0000-4000-8000-000000000002";
const invitationId = "00000000-0000-4000-8000-000000000003";
const shareId = "00000000-0000-4000-8000-000000000004";
const outputId = "00000000-0000-4000-8000-000000000005";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("collaboration API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: { tag: "client" },
      user: { id: "owner-1" },
    });
    requireWorkspacePermissionMock.mockResolvedValue({ role: "owner" });
    createWorkspaceInvitationMock.mockResolvedValue({
      id: invitationId,
      recipientUserId: recipientId,
      role: "editor",
    });
    listWorkspaceInvitationsMock.mockResolvedValue([]);
    revokeWorkspaceInvitationMock.mockResolvedValue({ id: invitationId, revoked: true });
    acceptWorkspaceInvitationMock.mockResolvedValue({
      workspaceId,
      role: "editor",
      alreadyAccepted: false,
    });
    listWorkspaceMembersMock.mockResolvedValue([]);
    changeWorkspaceMemberRoleMock.mockResolvedValue({
      userId: recipientId,
      role: "viewer",
    });
    revokeWorkspaceMemberMock.mockResolvedValue({
      userId: recipientId,
      revoked: true,
    });
    createWorkspaceShareMock.mockResolvedValue({
      id: shareId,
      targetKind: "quiz",
      targetId: outputId,
      permission: "study",
      createdAt: "2026-07-30T00:00:00Z",
    });
    listWorkspaceSharesMock.mockResolvedValue([]);
    revokeWorkspaceShareMock.mockResolvedValue({ id: shareId, revoked: true });
  });

  it("returns 401 for unauthenticated mutations", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = (await postInvitation(
      jsonRequest("http://localhost/api/workspaces/ws/invitations", "POST", {
        recipientUserId: recipientId,
        role: "editor",
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;

    expect(response.status).toBe(401);
    expect(createWorkspaceInvitationMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed invitation bodies", async () => {
    const response = (await postInvitation(
      jsonRequest("http://localhost/api/workspaces/ws/invitations", "POST", {
        recipientUserId: "not-a-uuid",
        role: "owner",
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid" });
  });

  it("lets owner create and revoke editor invitations", async () => {
    const createResponse = (await postInvitation(
      jsonRequest("http://localhost/api/workspaces/ws/invitations", "POST", {
        recipientUserId: recipientId,
        role: "editor",
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;
    expect(createResponse.status).toBe(200);
    expect(createWorkspaceInvitationMock).toHaveBeenCalledWith(
      { tag: "client" },
      workspaceId,
      recipientId,
      "editor",
    );

    const revokeResponse = (await deleteInvitation(
      jsonRequest("http://localhost/api/workspaces/ws/invitations", "DELETE", {
        invitationId,
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;
    expect(revokeResponse.status).toBe(200);
    expect(revokeWorkspaceInvitationMock).toHaveBeenCalledWith(
      { tag: "client" },
      invitationId,
    );
  });

  it("returns consistent forbidden for editor membership management", async () => {
    requireWorkspacePermissionMock.mockRejectedValue(
      new WorkspacePermissionError("forbidden"),
    );

    const membersResponse = (await getMembers(
      new Request("http://localhost/api/workspaces/ws/members"),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;
    expect(membersResponse.status).toBe(403);
    expect(await membersResponse.json()).toEqual({ error: "forbidden" });
    expect(listWorkspaceMembersMock).not.toHaveBeenCalled();
  });

  it("accepts invitation only through authenticated recipient-bound RPC", async () => {
    const response = (await acceptInvitation(
      new Request("http://localhost/api/invitations/inv/accept", { method: "POST" }),
      { params: Promise.resolve({ id: invitationId }) },
    )) as Response;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        workspaceId,
        role: "editor",
        alreadyAccepted: false,
      },
    });
    expect(acceptWorkspaceInvitationMock).toHaveBeenCalledWith(
      { tag: "client" },
      invitationId,
    );
    expect(acceptWorkspaceInvitationMock.mock.calls[0][1]).not.toMatch(/token/i);
  });

  it("maps wrong-recipient acceptance to forbidden", async () => {
    acceptWorkspaceInvitationMock.mockRejectedValue(
      new CollaborationError("forbidden"),
    );

    const response = (await acceptInvitation(
      new Request("http://localhost/api/invitations/inv/accept", { method: "POST" }),
      { params: Promise.resolve({ id: invitationId }) },
    )) as Response;

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
  });

  it("owner can manage members and shares metadata without exposing digest", async () => {
    const patchResponse = (await patchMember(
      jsonRequest("http://localhost/api/workspaces/ws/members", "PATCH", {
        userId: recipientId,
        role: "viewer",
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;
    expect(patchResponse.status).toBe(200);

    const shareResponse = (await postShare(
      jsonRequest("http://localhost/api/workspaces/ws/shares", "POST", {
        targetKind: "quiz",
        targetId: outputId,
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;
    expect(shareResponse.status).toBe(200);
    const shareBody = await shareResponse.json();
    expect(shareBody.data.id).toBe(shareId);
    expect(JSON.stringify(shareBody)).not.toMatch(/digest/i);
    expect(shareBody.data.token).toEqual(expect.any(String));

    const listSharesResponse = (await getShares(
      new Request("http://localhost/api/workspaces/ws/shares"),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;
    expect(listSharesResponse.status).toBe(200);

    const revokeShareResponse = (await deleteShare(
      jsonRequest("http://localhost/api/workspaces/ws/shares", "DELETE", {
        shareId,
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;
    expect(revokeShareResponse.status).toBe(200);
  });

  it("returns not_found for viewer listing invitations", async () => {
    requireWorkspacePermissionMock.mockRejectedValue(
      new WorkspacePermissionError("not_found"),
    );

    const response = (await getInvitations(
      new Request("http://localhost/api/workspaces/ws/invitations"),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;
    expect(response.status).toBe(404);
  });

  it("returns 400 for malformed member revoke body", async () => {
    const response = (await deleteMember(
      jsonRequest("http://localhost/api/workspaces/ws/members", "DELETE", {}),
      { params: Promise.resolve({ id: workspaceId }) },
    )) as Response;
    expect(response.status).toBe(400);
  });
});
