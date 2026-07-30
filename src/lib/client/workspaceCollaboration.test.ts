import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createWorkspaceInvitation,
  createWorkspaceShare,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  listWorkspaceShares,
  mapCollaborationHttpError,
  revokeWorkspaceInvitation,
  revokeWorkspaceMember,
  revokeWorkspaceShare,
  changeWorkspaceMemberRole,
} from "./workspaceCollaboration";

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const INVITATION_ID = "00000000-0000-4000-8000-000000000003";
const SHARE_ID = "00000000-0000-4000-8000-000000000004";

describe("mapCollaborationHttpError", () => {
  it("maps 401, 403, and 404 to the same generic message", () => {
    const message = "Workspace collaboration is unavailable.";
    for (const status of [401, 403, 404]) {
      const error = mapCollaborationHttpError(status, message);
      expect(error.message).toBe(message);
      expect(error.message).not.toMatch(/401|403|404|forbidden|not_found/i);
    }
  });

  it("preserves server message for other statuses when present", () => {
    const error = mapCollaborationHttpError(500, "fallback", "server exploded");
    expect(error.message).toBe("server exploded");
  });
});

describe("workspace collaboration client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists members with GET only", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ userId: USER_ID, role: "editor", joinedAt: "2026-01-01" }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const members = await listWorkspaceMembers(WORKSPACE_ID);
    expect(members).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/workspaces/${WORKSPACE_ID}/members`,
      undefined,
    );
  });

  it("creates invitations with allowed body fields only", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: INVITATION_ID,
          recipientUserId: USER_ID,
          role: "viewer",
          expiresAt: "2026-12-01",
          createdAt: "2026-01-01",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await createWorkspaceInvitation(WORKSPACE_ID, {
      recipientUserId: USER_ID,
      role: "viewer",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/workspaces/${WORKSPACE_ID}/invitations`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ recipientUserId: USER_ID, role: "viewer" }),
      }),
    );
  });

  it("returns shareUrl only from create and omits token from the result", async () => {
    const token = "share-secret-token";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: SHARE_ID,
          targetKind: "workspace",
          targetId: WORKSPACE_ID,
          permission: "view",
          createdAt: "2026-01-01",
          token,
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await createWorkspaceShare(WORKSPACE_ID, {
      targetKind: "workspace",
      targetId: WORKSPACE_ID,
    });

    expect(result.shareUrl).toBe(`/share/${token}`);
    expect("token" in result).toBe(false);
    expect(listWorkspaceShares).toBeDefined();
  });

  it("maps forbidden list responses to generic errors", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "forbidden" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(listWorkspaceInvitations(WORKSPACE_ID)).rejects.toThrow(
      "Workspace collaboration is unavailable.",
    );
  });

  it("revokes members, invitations, and shares with JSON bodies", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal("fetch", mockFetch);

    await revokeWorkspaceMember(WORKSPACE_ID, USER_ID);
    await revokeWorkspaceInvitation(WORKSPACE_ID, INVITATION_ID);
    await revokeWorkspaceShare(WORKSPACE_ID, SHARE_ID);

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/workspaces/${WORKSPACE_ID}/members`,
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ userId: USER_ID }),
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/workspaces/${WORKSPACE_ID}/invitations`,
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ invitationId: INVITATION_ID }),
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/workspaces/${WORKSPACE_ID}/shares`,
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ shareId: SHARE_ID }),
      }),
    );
  });

  it("patches member roles with allowed fields only", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { userId: USER_ID, role: "viewer" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await changeWorkspaceMemberRole(WORKSPACE_ID, USER_ID, "viewer");

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/workspaces/${WORKSPACE_ID}/members`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ userId: USER_ID, role: "viewer" }),
      }),
    );
  });
});
