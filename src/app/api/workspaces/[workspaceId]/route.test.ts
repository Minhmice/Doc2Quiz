import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

const patchWorkspaceMetadataMock = vi.fn();
const getWorkspaceDetailMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/lib/workspaces/documentVersions", () => ({
  patchWorkspaceMetadata: (...args: unknown[]) =>
    patchWorkspaceMetadataMock(...args),
}));

vi.mock("@/lib/workspaces/workspaceSummary", () => ({
  getWorkspaceDetail: (...args: unknown[]) => getWorkspaceDetailMock(...args),
}));

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

import { GET, PATCH } from "@/app/api/workspaces/[workspaceId]/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/workspaces/ws-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const detailFixture = {
  id: "ws-1",
  title: "Biology",
  subtitle: null,
  role: "owner",
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-30T00:00:00Z",
  documents: [
    {
      id: "doc-1",
      title: "Chapter 1",
      description: null,
      updatedAt: "2026-07-30T00:00:00Z",
      versions: [
        {
          id: "ver-1",
          versionNumber: 1,
          sourceKind: "upload",
          originalFilename: "ch1.pdf",
          createdAt: "2026-07-29T00:00:00Z",
          canonicalVersions: [
            {
              id: "cv-1",
              documentVersionId: "ver-1",
              versionNumber: 1,
              status: "completed",
              model: "test-model",
              promptVersion: "1.0",
              parserVersion: "1.0",
              createdAt: "2026-07-29T01:00:00Z",
              provenanceLabel: "ai · test-model",
            },
          ],
        },
      ],
    },
  ],
  outputs: [
    {
      id: "out-1",
      kind: "quiz" as const,
      title: "Quiz A",
      status: "ready",
      updatedAt: "2026-07-30T12:00:00Z",
      createdAt: "2026-07-30T10:00:00Z",
      bridgeStudySetId: "bridge-1",
    },
  ],
};

describe("GET /api/workspaces/[workspaceId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    getWorkspaceDetailMock.mockResolvedValue(detailFixture);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await GET(new Request("http://localhost/api/workspaces/ws-1"), {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });
    expect(response.status).toBe(401);
    expect(getWorkspaceDetailMock).not.toHaveBeenCalled();
  });

  it("returns 404 for inaccessible workspace", async () => {
    getWorkspaceDetailMock.mockRejectedValue(
      new WorkspaceNotFoundError("Workspace not found"),
    );

    const response = await GET(new Request("http://localhost/api/workspaces/ws-missing"), {
      params: Promise.resolve({ workspaceId: "ws-missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns detail navigation DTO without body markdown", async () => {
    const response = await GET(new Request("http://localhost/api/workspaces/ws-1"), {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(detailFixture);
    expect(JSON.stringify(body)).not.toMatch(
      /canonical_markdown|raw_markdown|body_markdown/,
    );
    expect(getWorkspaceDetailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        userId: "user-1",
      }),
    );
  });
});

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
