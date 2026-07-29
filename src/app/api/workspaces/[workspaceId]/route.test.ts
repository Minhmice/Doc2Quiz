import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

const patchWorkspaceMetadataMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/lib/workspaces/documentVersions", () => ({
  patchWorkspaceMetadata: (...args: unknown[]) =>
    patchWorkspaceMetadataMock(...args),
}));

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

import { PATCH } from "@/app/api/workspaces/[workspaceId]/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/workspaces/ws-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/workspaces/[workspaceId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    patchWorkspaceMetadataMock.mockResolvedValue({
      id: "ws-1",
      title: "Renamed",
      subtitle: null,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await PATCH(jsonRequest({ title: "Renamed" }), {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/workspaces/ws-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{bad",
      }),
      { params: Promise.resolve({ workspaceId: "ws-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when patch includes no metadata fields", async () => {
    const response = await PATCH(jsonRequest({}), {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 404 for inaccessible workspace", async () => {
    patchWorkspaceMetadataMock.mockRejectedValue(
      new WorkspaceNotFoundError("Workspace not found"),
    );

    const response = await PATCH(jsonRequest({ title: "Renamed" }), {
      params: Promise.resolve({ workspaceId: "ws-missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 403 for viewer writes", async () => {
    patchWorkspaceMetadataMock.mockRejectedValue(
      new WorkspaceForbiddenError("Viewer cannot modify this workspace"),
    );

    const response = await PATCH(jsonRequest({ title: "Renamed" }), {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });
    expect(response.status).toBe(403);
  });

  it("returns updated workspace metadata on success", async () => {
    const response = await PATCH(jsonRequest({ title: "Renamed" }), {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      id: "ws-1",
      title: "Renamed",
      subtitle: null,
    });
    expect(patchWorkspaceMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        patch: { title: "Renamed" },
      }),
    );
  });
});
