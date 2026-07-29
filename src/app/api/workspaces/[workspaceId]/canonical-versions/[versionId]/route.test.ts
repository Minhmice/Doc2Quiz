import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import { WorkspaceNotFoundError } from "@/lib/workspaces/errors";

const getCanonicalVersionMetadataMock = vi.fn();
const getCanonicalSectionPageMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/lib/workspaces/canonicalReader", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workspaces/canonicalReader")>();
  return {
    ...actual,
    getCanonicalVersionMetadata: (...args: unknown[]) =>
      getCanonicalVersionMetadataMock(...args),
    getCanonicalSectionPage: (...args: unknown[]) =>
      getCanonicalSectionPageMock(...args),
  };
});

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

import { GET as GET_META } from "@/app/api/workspaces/[workspaceId]/canonical-versions/[versionId]/route";
import { GET as GET_SECTIONS } from "@/app/api/workspaces/[workspaceId]/canonical-versions/[versionId]/sections/route";

const params = Promise.resolve({
  workspaceId: "ws-1",
  versionId: "cv-1",
});

describe("GET /api/workspaces/.../canonical-versions/:versionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    getCanonicalVersionMetadataMock.mockResolvedValue({
      id: "cv-1",
      documentVersionId: "ver-1",
      versionNumber: 2,
      status: "completed",
      model: "test-model",
      promptVersion: "1.0",
      parserVersion: "1.0",
      createdAt: "2026-07-30T00:00:00Z",
      canonicalContentChecksum: "abc",
      sectionsChecksum: "def",
      provenance: { mode: "ai" },
      sectionCount: 1,
      sections: [
        {
          id: "s1",
          ordinal: 1,
          heading: "Intro",
          sectionType: "theory",
          sectionKey: "sec_001",
        },
      ],
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await GET_META(new Request("http://localhost"), {
      params,
    });
    expect(response.status).toBe(401);
  });

  it("returns metadata without full content fields", async () => {
    const response = await GET_META(new Request("http://localhost"), {
      params,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.versionNumber).toBe(2);
    expect(body.data.sections[0].heading).toBe("Intro");
    expect(body.data).not.toHaveProperty("canonicalMarkdown");
    expect(body.data).not.toHaveProperty("rawMarkdown");
    expect(body.data.sections[0]).not.toHaveProperty("bodyMarkdown");
  });

  it("returns 404 when inaccessible", async () => {
    getCanonicalVersionMetadataMock.mockRejectedValue(
      new WorkspaceNotFoundError("Canonical version not found"),
    );

    const response = await GET_META(new Request("http://localhost"), {
      params,
    });
    expect(response.status).toBe(404);
  });
});

describe("GET /api/workspaces/.../canonical-versions/:versionId/sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    getCanonicalSectionPageMock.mockResolvedValue({
      sections: [
        {
          id: "s2",
          ordinal: 2,
          heading: "Two",
          sectionType: "theory",
          sectionKey: "sec_002",
          bodyMarkdown: "Body",
        },
      ],
      nextAfterOrdinal: null,
      limit: 20,
    });
  });

  it("returns 400 for invalid limit", async () => {
    const response = await GET_SECTIONS(
      new Request(
        "http://localhost/api/workspaces/ws-1/canonical-versions/cv-1/sections?limit=0",
      ),
      { params },
    );
    expect(response.status).toBe(400);
    expect(getCanonicalSectionPageMock).not.toHaveBeenCalled();
  });

  it("passes cursor and clamped page to service", async () => {
    const response = await GET_SECTIONS(
      new Request(
        "http://localhost/api/workspaces/ws-1/canonical-versions/cv-1/sections?afterOrdinal=1&limit=10",
      ),
      { params },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.sections[0].bodyMarkdown).toBe("Body");
    expect(body.data).not.toHaveProperty("canonicalMarkdown");
    expect(getCanonicalSectionPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        afterOrdinal: 1,
        limit: 10,
        versionId: "cv-1",
        workspaceId: "ws-1",
      }),
    );
  });

  it("returns 404 for missing version", async () => {
    getCanonicalSectionPageMock.mockRejectedValue(
      new WorkspaceNotFoundError("Canonical version not found"),
    );

    const response = await GET_SECTIONS(
      new Request(
        "http://localhost/api/workspaces/ws-1/canonical-versions/cv-1/sections",
      ),
      { params },
    );
    expect(response.status).toBe(404);
  });
});
