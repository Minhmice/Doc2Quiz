import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  WorkspaceIngestConversionError,
  WorkspaceIngestValidationError,
} from "@/lib/workspaces/createWorkspaceIngest";

const runWorkspaceIngestMock = vi.fn();
const requireApiUserMock = vi.fn();
const resolveLegacyStudySetBridgeMock = vi.fn();
const resolveLegacyWorkspaceDocumentMock = vi.fn();

vi.mock("@/lib/workspaces/createWorkspaceIngest", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workspaces/createWorkspaceIngest")>();
  return {
    ...actual,
    runWorkspaceIngest: (...args: unknown[]) => runWorkspaceIngestMock(...args),
  };
});

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

vi.mock("@/lib/workspaces/legacyBridge", () => ({
  resolveLegacyStudySetBridge: (...args: unknown[]) =>
    resolveLegacyStudySetBridgeMock(...args),
  resolveLegacyWorkspaceDocument: (...args: unknown[]) =>
    resolveLegacyWorkspaceDocumentMock(...args),
}));

import { POST } from "@/app/api/study-sets/[id]/ingest/route";

const BRIDGE = {
  outputId: "out-1",
  workspaceId: "ws-1",
  bridgeStudySetId: "bridge-1",
  legacyParentStudySetId: "parent-1",
  kind: "quiz" as const,
  resolutionMode: "bridge" as const,
  historyStudySetId: "bridge-1",
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/study-sets/set-1/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/study-sets/[id]/ingest (legacy adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: { from: vi.fn() },
      user: { id: "user-1" },
    });
    resolveLegacyStudySetBridgeMock.mockResolvedValue(BRIDGE);
    resolveLegacyWorkspaceDocumentMock.mockResolvedValue({
      documentId: "doc-1",
      documentVersionId: "dv-1",
    });
    runWorkspaceIngestMock.mockResolvedValue({
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "dv-2",
      versionNumber: 2,
      conversionStatus: "ok",
      rawMarkdownLength: 42,
      title: "Biology",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
      { params: Promise.resolve({ id: "set-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when bridge inaccessible", async () => {
    resolveLegacyStudySetBridgeMock.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
      { params: Promise.resolve({ id: "set-1" }) },
    );

    expect(response.status).toBe(404);
    expect(resolveLegacyStudySetBridgeMock).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "ingest" }),
    );
    expect(runWorkspaceIngestMock).not.toHaveBeenCalled();
  });

  it("returns 400 for validation errors", async () => {
    runWorkspaceIngestMock.mockRejectedValue(
      new WorkspaceIngestValidationError("Unsupported file type"),
    );

    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
      { params: Promise.resolve({ id: "set-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/unsupported/i);
  });

  it("returns 422 for conversion errors", async () => {
    runWorkspaceIngestMock.mockRejectedValue(
      new WorkspaceIngestConversionError("Conversion failed"),
    );

    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
      { params: Promise.resolve({ id: "set-1" }) },
    );

    expect(response.status).toBe(422);
  });

  it("delegates to workspace ingest and preserves legacy DTO fields", async () => {
    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
      { params: Promise.resolve({ id: "set-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pipelineStage).toBe("raw");
    expect(body.rawMarkdownLength).toBe(42);
    expect(body.studySetId).toBe("set-1");
    expect(runWorkspaceIngestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        documentId: "doc-1",
      }),
    );
  });

  it("rejects ingest when source document is soft-deleted", async () => {
    resolveLegacyWorkspaceDocumentMock.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
      { params: Promise.resolve({ id: "set-1" }) },
    );

    expect(response.status).toBe(400);
    expect(runWorkspaceIngestMock).not.toHaveBeenCalled();
  });
});
