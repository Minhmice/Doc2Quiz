import { describe, expect, it, vi } from "vitest";

import {
  acceptWorkspaceInvitation,
  CollaborationError,
  createWorkspaceInvitation,
  createWorkspaceShare,
  revokeWorkspaceInvitation,
} from "./collaboration";
import {
  canWorkspaceRole,
  requireWorkspacePermission,
  WorkspacePermissionError,
} from "./permissions";

describe("requireWorkspacePermission", () => {
  function memberClient(role: string | null) {
    return {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: role ? { role } : null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
  }

  it("permits owner-only membership and share management", async () => {
    const supabase = memberClient("owner");
    await expect(
      requireWorkspacePermission(supabase as never, "ws-1", "manage_members", "user-1"),
    ).resolves.toEqual({ role: "owner" });
    await expect(
      requireWorkspacePermission(supabase as never, "ws-1", "manage_shares", "user-1"),
    ).resolves.toEqual({ role: "owner" });
  });

  it("permits editor edit but denies membership and share management", async () => {
    const supabase = memberClient("editor");
    await expect(
      requireWorkspacePermission(supabase as never, "ws-1", "edit", "user-1"),
    ).resolves.toEqual({ role: "editor" });
    await expect(
      requireWorkspacePermission(supabase as never, "ws-1", "manage_members", "user-1"),
    ).rejects.toEqual(new WorkspacePermissionError("forbidden"));
    await expect(
      requireWorkspacePermission(supabase as never, "ws-1", "manage_shares", "user-1"),
    ).rejects.toEqual(new WorkspacePermissionError("forbidden"));
  });

  it("permits viewer read only", async () => {
    const supabase = memberClient("viewer");
    await expect(
      requireWorkspacePermission(supabase as never, "ws-1", "view", "user-1"),
    ).resolves.toEqual({ role: "viewer" });
    await expect(
      requireWorkspacePermission(supabase as never, "ws-1", "edit", "user-1"),
    ).rejects.toEqual(new WorkspacePermissionError("forbidden"));
    expect(canWorkspaceRole("viewer", "manage_members")).toBe(false);
  });
});

describe("collaboration RPC wrappers", () => {
  it("maps invitation acceptance errors for wrong recipient, revoked, and owner role", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "forbidden" } })
      .mockResolvedValueOnce({ data: null, error: { message: "not_found" } })
      .mockResolvedValueOnce({ data: null, error: { message: "expired" } })
      .mockResolvedValueOnce({ data: null, error: { message: "invalid" } });

    await expect(
      acceptWorkspaceInvitation({ rpc }, "inv-1"),
    ).rejects.toEqual(new CollaborationError("forbidden"));
    await expect(
      acceptWorkspaceInvitation({ rpc }, "inv-2"),
    ).rejects.toEqual(new CollaborationError("not_found"));
    await expect(
      acceptWorkspaceInvitation({ rpc }, "inv-3"),
    ).rejects.toEqual(new CollaborationError("expired"));
    await expect(
      acceptWorkspaceInvitation({ rpc }, "inv-4"),
    ).rejects.toEqual(new CollaborationError("invalid"));
  });

  it("enforces one live invitation per workspace recipient", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "invitation_exists" },
    });

    await expect(
      createWorkspaceInvitation({ rpc }, "ws-1", "user-2", "editor"),
    ).rejects.toEqual(new CollaborationError("invitation_exists"));
  });

  it("accepts valid invitation with stored role and remains idempotent on retry", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          workspaceId: "ws-1",
          role: "viewer",
          alreadyAccepted: false,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          workspaceId: "ws-1",
          role: "viewer",
          alreadyAccepted: true,
        },
        error: null,
      });

    await expect(acceptWorkspaceInvitation({ rpc }, "inv-1")).resolves.toEqual({
      workspaceId: "ws-1",
      role: "viewer",
      alreadyAccepted: false,
    });
    await expect(acceptWorkspaceInvitation({ rpc }, "inv-1")).resolves.toEqual({
      workspaceId: "ws-1",
      role: "viewer",
      alreadyAccepted: true,
    });
    expect(rpc).toHaveBeenCalledWith("accept_workspace_invitation", {
      p_invitation_id: "inv-1",
    });
  });

  it("revokes invitation without accepting share token path", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: "inv-1", revoked: true },
      error: null,
    });

    await expect(revokeWorkspaceInvitation({ rpc }, "inv-1")).resolves.toEqual({
      id: "inv-1",
      revoked: true,
    });
    expect(rpc).toHaveBeenCalledWith("revoke_workspace_invitation", {
      p_invitation_id: "inv-1",
    });
  });

  it("creates share metadata with digest only, never returning digest in DTO", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "share-1",
        targetKind: "quiz",
        targetId: "out-1",
        permission: "study",
        createdAt: "2026-07-30T00:00:00Z",
      },
      error: null,
    });
    const digest = new Uint8Array(32).fill(7);

    const result = await createWorkspaceShare(
      { rpc },
      "ws-1",
      "quiz",
      "out-1",
      digest,
    );

    expect(result).toEqual({
      id: "share-1",
      targetKind: "quiz",
      targetId: "out-1",
      permission: "study",
      createdAt: "2026-07-30T00:00:00Z",
    });
    expect(JSON.stringify(result)).not.toMatch(/tokenDigest|digest/i);
  });
});
