import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  CanonicalVersionError,
  CanonicalVersionPersistenceError,
  CanonicalVersionValidationError,
} from "@/lib/pipeline/canonicalVersion";

const runCanonicalVersionMock = vi.fn();
const requireApiUserMock = vi.fn();
const resolveLegacyStudySetBridgeMock = vi.fn();
const resolveLegacyWorkspaceDocumentMock = vi.fn();

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

vi.mock("@/lib/workspaces/legacyBridge", () => ({
  resolveLegacyStudySetBridge: (...args: unknown[]) =>
    resolveLegacyStudySetBridgeMock(...args),
  resolveLegacyWorkspaceDocument: (...args: unknown[]) =>
    resolveLegacyWorkspaceDocumentMock(...args),
}));

import { POST } from "@/app/api/study-sets/[id]/canonicalize/route";

const BRIDGE = {
  outputId: "out-1",
  workspaceId: "ws-1",
  bridgeStudySetId: "bridge-1",
  legacyParentStudySetId: "parent-1",
  kind: "quiz" as const,
  resolutionMode: "bridge" as const,
  historyStudySetId: "bridge-1",
};

describe("POST /api/study-sets/[id]/canonicalize (legacy adapter)", () => {
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
    runCanonicalVersionMock.mockResolvedValue({
      canonicalVersionId: "cv-2",
      versionNumber: 2,
      sectionCount: 2,
      title: "Canonical Title",
      model: "gpt",
      promptVersion: "1",
      parserVersion: "1.0",
      createdAt: "2026-07-30T00:00:00.000Z",
      provenance: {},
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when bridge inaccessible", async () => {
    resolveLegacyStudySetBridgeMock.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(404);
    expect(resolveLegacyStudySetBridgeMock).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "canonicalize" }),
    );
    expect(runCanonicalVersionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for validation errors", async () => {
    runCanonicalVersionMock.mockRejectedValue(
      new CanonicalVersionValidationError("raw_markdown is empty."),
    );

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("validation_error");
    expect(body.message).toMatch(/empty/i);
  });

  it("returns 422 for canonicalize errors", async () => {
    runCanonicalVersionMock.mockRejectedValue(
      new CanonicalVersionError("Canonical builder output failed validation"),
    );

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("canonicalize_error");
  });

  it("returns 503 for persistence network errors", async () => {
    runCanonicalVersionMock.mockRejectedValue(
      new CanonicalVersionPersistenceError("Cannot reach Supabase."),
    );

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("persistence_unavailable");
  });

  it("delegates to runCanonicalVersion and preserves legacy DTO", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pipelineStage).toBe("canonical");
    expect(body.sectionCount).toBe(2);
    expect(body.title).toBe("Canonical Title");
    expect(body.studySetId).toBe("set-1");
    expect(runCanonicalVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        documentId: "doc-1",
        documentVersionId: "dv-1",
      }),
    );
  });

  it("does not call replace_canonical_content or runCanonicalize", async () => {
    await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(runCanonicalVersionMock).toHaveBeenCalled();
  });
});
