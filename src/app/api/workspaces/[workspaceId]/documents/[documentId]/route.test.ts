import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

const patchDocumentMetadataMock = vi.fn();
const softDeleteDocumentMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/lib/workspaces/documentVersions", () => ({
  patchDocumentMetadata: (...args: unknown[]) =>
    patchDocumentMetadataMock(...args),
  softDeleteDocument: (...args: unknown[]) => softDeleteDocumentMock(...args),
}));

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

import {
  DELETE,
  PATCH,
} from "@/app/api/workspaces/[workspaceId]/documents/[documentId]/route";

const params = Promise.resolve({
  workspaceId: "ws-1",
  documentId: "doc-1",
});

function jsonRequest(body: unknown) {
  return new Request(
    "http://localhost/api/workspaces/ws-1/documents/doc-1",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("PATCH /api/workspaces/[workspaceId]/documents/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    patchDocumentMetadataMock.mockResolvedValue({
      id: "doc-1",
      title: "Doc",
      description: null,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await PATCH(jsonRequest({ title: "Doc" }), { params });
    expect(response.status).toBe(401);
  });

  it("rejects source fields in patch body with 400", async () => {
    const response = await PATCH(
      jsonRequest({ title: "Doc", raw_markdown: "nope" }),
      { params },
    );
    expect(response.status).toBe(400);
    expect(patchDocumentMetadataMock).not.toHaveBeenCalled();
  });

  it("returns 404 for inaccessible document", async () => {
    patchDocumentMetadataMock.mockRejectedValue(
      new WorkspaceNotFoundError("Document not found"),
    );

    const response = await PATCH(jsonRequest({ title: "Doc" }), { params });
    expect(response.status).toBe(404);
  });

  it("returns success payload without source data", async () => {
    const response = await PATCH(jsonRequest({ title: "Doc" }), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      id: "doc-1",
      title: "Doc",
      description: null,
    });
  });
});

describe("DELETE /api/workspaces/[workspaceId]/documents/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    softDeleteDocumentMock.mockResolvedValue({ id: "doc-1" });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await DELETE(
      new Request("http://localhost/api/workspaces/ws-1/documents/doc-1", {
        method: "DELETE",
      }),
      { params },
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 for viewer soft delete", async () => {
    softDeleteDocumentMock.mockRejectedValue(
      new WorkspaceForbiddenError("Viewer cannot modify this workspace"),
    );

    const response = await DELETE(
      new Request("http://localhost/api/workspaces/ws-1/documents/doc-1", {
        method: "DELETE",
      }),
      { params },
    );
    expect(response.status).toBe(403);
  });

  it("returns 204 on soft delete success", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/workspaces/ws-1/documents/doc-1", {
        method: "DELETE",
      }),
      { params },
    );
    expect(response.status).toBe(204);
    expect(softDeleteDocumentMock).toHaveBeenCalled();
  });
});
