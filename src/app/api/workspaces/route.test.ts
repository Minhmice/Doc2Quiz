import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const listWorkspaceSummariesMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/lib/workspaces/workspaceSummary", () => ({
  listWorkspaceSummaries: (...args: unknown[]) =>
    listWorkspaceSummariesMock(...args),
}));

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

import { GET } from "@/app/api/workspaces/route";

describe("GET /api/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: { tag: "client" },
      user: { id: "user-1" },
    });
    listWorkspaceSummariesMock.mockResolvedValue([
      {
        id: "ws-1",
        title: "Biology",
        subtitle: null,
        role: "owner",
        createdAt: "2026-07-01T00:00:00Z",
        updatedAt: "2026-07-30T00:00:00Z",
        documentCount: 2,
        canonicalVersionCount: 1,
        quizOutputCount: 1,
        flashcardOutputCount: 0,
        recentOutputs: [
          {
            id: "out-1",
            kind: "quiz",
            title: "Quiz A",
            status: "ready",
            updatedAt: "2026-07-30T12:00:00Z",
            createdAt: "2026-07-30T10:00:00Z",
            bridgeStudySetId: "bridge-1",
          },
        ],
      },
    ]);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await GET();
    expect(response.status).toBe(401);
    expect(listWorkspaceSummariesMock).not.toHaveBeenCalled();
  });

  it("returns workspace summary DTO on success", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "ws-1",
      role: "owner",
      documentCount: 2,
      quizOutputCount: 1,
      recentOutputs: [
        expect.objectContaining({ bridgeStudySetId: "bridge-1" }),
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(
      /canonical_markdown|raw_markdown|body_markdown/,
    );
    expect(listWorkspaceSummariesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        supabase: { tag: "client" },
      }),
    );
  });

  it("returns 500 when summary service fails", async () => {
    listWorkspaceSummariesMock.mockRejectedValue(new Error("db down"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("internal_error");
  });
});
