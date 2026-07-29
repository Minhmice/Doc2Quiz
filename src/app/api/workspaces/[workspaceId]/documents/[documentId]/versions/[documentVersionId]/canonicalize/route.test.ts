import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  CanonicalVersionError,
  CanonicalVersionPersistenceError,
  CanonicalVersionValidationError,
} from "@/lib/pipeline/canonicalVersion";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

const runCanonicalVersionMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/lib/pipeline/canonicalVersion", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/pipeline/canonicalVersion")>();
  return {
    ...actual,
    runCanonicalVersion: (...args: unknown[]) =>
      runCanonicalVersionMock(...args),
  };
});

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

import { POST } from "@/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/[documentVersionId]/canonicalize/route";

const params = Promise.resolve({
  workspaceId: "ws-1",
  documentId: "doc-1",
  documentVersionId: "ver-1",
});

describe("POST .../canonicalize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    runCanonicalVersionMock.mockResolvedValue({
      canonicalVersionId: "cv-1",
      versionNumber: 1,
      sectionCount: 3,
      title: "Doc",
      model: "m",
      promptVersion: "1.0",
      parserVersion: "1.0",
      createdAt: "2026-07-30T00:00:00Z",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await POST(new Request("http://localhost"), { params });
    expect(response.status).toBe(401);
  });

  it("returns new canonical version identity for editor", async () => {
    const response = await POST(new Request("http://localhost"), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.canonicalVersionId).toBe("cv-1");
    expect(body.sectionCount).toBe(3);
    expect(runCanonicalVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        documentId: "doc-1",
        documentVersionId: "ver-1",
      }),
    );
  });

  it("returns 403 for viewer", async () => {
    runCanonicalVersionMock.mockRejectedValue(
      new WorkspaceForbiddenError("Workspace editor access required"),
    );

    const response = await POST(new Request("http://localhost"), { params });
    expect(response.status).toBe(403);
  });

  it("returns 404 when version inaccessible", async () => {
    runCanonicalVersionMock.mockRejectedValue(
      new WorkspaceNotFoundError("Document version not found."),
    );

    const response = await POST(new Request("http://localhost"), { params });
    expect(response.status).toBe(404);
  });

  it("returns 400 for validation errors", async () => {
    runCanonicalVersionMock.mockRejectedValue(
      new CanonicalVersionValidationError("raw_markdown is empty."),
    );

    const response = await POST(new Request("http://localhost"), { params });
    expect(response.status).toBe(400);
  });

  it("returns 422 for canonicalize failures", async () => {
    runCanonicalVersionMock.mockRejectedValue(
      new CanonicalVersionError("AI processing is not configured."),
    );

    const response = await POST(new Request("http://localhost"), { params });
    expect(response.status).toBe(422);
  });

  it("returns 503 for persistence failures", async () => {
    runCanonicalVersionMock.mockRejectedValue(
      new CanonicalVersionPersistenceError("db down"),
    );

    const response = await POST(new Request("http://localhost"), { params });
    expect(response.status).toBe(503);
  });
});
