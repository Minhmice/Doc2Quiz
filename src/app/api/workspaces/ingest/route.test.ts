import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  WorkspaceIngestConversionError,
  WorkspaceIngestValidationError,
} from "@/lib/workspaces/createWorkspaceIngest";

const runWorkspaceIngestMock = vi.fn();
const requireApiUserMock = vi.fn();

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

import { POST } from "@/app/api/workspaces/ingest/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/workspaces/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/workspaces/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    runWorkspaceIngestMock.mockResolvedValue({
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "ver-1",
      versionNumber: 1,
      conversionStatus: "ok",
      rawMarkdownLength: 42,
      title: "Pasted source",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/workspaces/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("validation_error");
  });

  it("returns 400 for invalid Zod body", async () => {
    const response = await POST(jsonRequest({ kind: "paste" }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("validation_error");
  });

  it("returns 400 for service validation errors", async () => {
    runWorkspaceIngestMock.mockRejectedValue(
      new WorkspaceIngestValidationError("Unsupported file type"),
    );

    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
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
    );
    expect(response.status).toBe(422);
  });

  it("returns workspace/document/version identity on success", async () => {
    const response = await POST(
      jsonRequest({ kind: "paste", text: "x".repeat(30) }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "ver-1",
      versionNumber: 1,
      conversionStatus: "ok",
      rawMarkdownLength: 42,
      title: "Pasted source",
    });
    expect(runWorkspaceIngestMock).toHaveBeenCalled();
  });
});
