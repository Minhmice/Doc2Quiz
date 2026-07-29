import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

const appendDocumentVersionMock = vi.fn();
const softDeleteDocumentVersionMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/lib/workspaces/documentVersions", () => ({
  appendDocumentVersion: (...args: unknown[]) =>
    appendDocumentVersionMock(...args),
  softDeleteDocumentVersion: (...args: unknown[]) =>
    softDeleteDocumentVersionMock(...args),
}));

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

import {
  DELETE,
  POST,
} from "@/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/route";

const params = Promise.resolve({
  workspaceId: "ws-1",
  documentId: "doc-1",
});

const VERSION_ID = "550e8400-e29b-41d4-a716-446655440000";

function jsonRequest(body: unknown) {
  return new Request(
    "http://localhost/api/workspaces/ws-1/documents/doc-1/versions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/workspaces/.../versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    appendDocumentVersionMock.mockResolvedValue({
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "ver-2",
      versionNumber: 2,
      conversionStatus: "ok",
      rawMarkdownLength: 10,
      title: "Pasted source",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
      { params },
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid Zod body", async () => {
    const response = await POST(jsonRequest({ kind: "paste" }), { params });
    expect(response.status).toBe(400);
  });

  it("returns new version identity on replacement success", async () => {
    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
      { params },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.versionNumber).toBe(2);
    expect(body.documentVersionId).toBe("ver-2");
    expect(appendDocumentVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        documentId: "doc-1",
      }),
    );
  });

  it("returns 404 when document inaccessible", async () => {
    appendDocumentVersionMock.mockRejectedValue(
      new WorkspaceNotFoundError("Document not found"),
    );

    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
      { params },
    );
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/workspaces/.../versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    softDeleteDocumentVersionMock.mockResolvedValue({ id: VERSION_ID });
  });

  it("returns 400 without documentVersionId", async () => {
    const response = await DELETE(
      new Request(
        "http://localhost/api/workspaces/ws-1/documents/doc-1/versions",
        { method: "DELETE" },
      ),
      { params },
    );
    expect(response.status).toBe(400);
  });

  it("returns 403 for viewer soft delete", async () => {
    softDeleteDocumentVersionMock.mockRejectedValue(
      new WorkspaceForbiddenError("Viewer cannot modify this workspace"),
    );

    const response = await DELETE(
      new Request(
        `http://localhost/api/workspaces/ws-1/documents/doc-1/versions?documentVersionId=${VERSION_ID}`,
        { method: "DELETE" },
      ),
      { params },
    );
    expect(response.status).toBe(403);
  });

  it("returns 204 on soft delete success", async () => {
    const response = await DELETE(
      new Request(
        `http://localhost/api/workspaces/ws-1/documents/doc-1/versions?documentVersionId=${VERSION_ID}`,
        { method: "DELETE" },
      ),
      { params },
    );
    expect(response.status).toBe(204);
    expect(softDeleteDocumentVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentVersionId: VERSION_ID,
      }),
    );
  });
});
