import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUserMock = vi.fn();
const resolveLegacyStudySetBridgeMock = vi.fn();
const resolveLegacyWorkspaceDocumentMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

vi.mock("@/lib/workspaces/legacyBridge", () => ({
  resolveLegacyStudySetBridge: (...args: unknown[]) =>
    resolveLegacyStudySetBridgeMock(...args),
  resolveLegacyWorkspaceDocument: (...args: unknown[]) =>
    resolveLegacyWorkspaceDocumentMock(...args),
}));

import { GET } from "@/app/api/study-sets/[id]/canonical/route";

const BRIDGE = {
  outputId: "out-1",
  workspaceId: "ws-1",
  bridgeStudySetId: "bridge-1",
  legacyParentStudySetId: "parent-1",
  kind: "quiz" as const,
  resolutionMode: "bridge" as const,
  historyStudySetId: "bridge-1",
};

function createSupabase(mode: "versioned" | "snapshot" = "versioned") {
  return {
    from: vi.fn((table: string) => {
      if (table === "study_sets") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "bridge-1",
                  title: "Biology",
                  pipeline_stage: "canonical",
                },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "document_versions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  raw_markdown: "# raw",
                  original_filename: "bio.md",
                },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "canonical_versions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data:
                        mode === "versioned"
                          ? {
                              id: "cv-1",
                              canonical_markdown: "# canon",
                              metadata: { title: "Biology" },
                              document_version_id: "dv-1",
                              version_number: 1,
                            }
                          : null,
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }
      if (table === "canonical_version_sections") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    id: "sec-1",
                    ordinal: 1,
                    heading: "Intro",
                    body_markdown: "body",
                    section_type: "content",
                    section_key: "intro",
                  },
                ],
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "output_source_snapshots") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      canonical_markdown: "# frozen",
                      sections: [
                        {
                          ordinal: 1,
                          heading: "Frozen",
                          body_markdown: "snap",
                          section_type: "content",
                          section_key: "f1",
                        },
                      ],
                      canonical_metadata: {},
                      canonical_version_id: "cv-old",
                      ordinal: 1,
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }
      if (table === "canonical_documents") {
        throw new Error("must not query mutable canonical_documents");
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("GET /api/study-sets/[id]/canonical (legacy adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: createSupabase("versioned"),
      user: { id: "user-1" },
    });
    resolveLegacyStudySetBridgeMock.mockResolvedValue(BRIDGE);
    resolveLegacyWorkspaceDocumentMock.mockResolvedValue({
      documentId: "doc-1",
      documentVersionId: "dv-1",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bridge-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when bridge inaccessible", async () => {
    resolveLegacyStudySetBridgeMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bridge-1" }),
    });

    expect(response.status).toBe(404);
    expect(resolveLegacyStudySetBridgeMock).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "canonical" }),
    );
  });

  it("returns legacy DTO from workspace canonical versions", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bridge-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.studySet.title).toBe("Biology");
    expect(body.data.document.canonicalMarkdown).toBe("# canon");
    expect(body.data.sections).toHaveLength(1);
    expect(body.data.sections[0].bodyMarkdown).toBe("body");
  });

  it("falls back to frozen snapshots after source soft delete", async () => {
    requireApiUserMock.mockResolvedValue({
      supabase: createSupabase("snapshot"),
      user: { id: "user-1" },
    });
    resolveLegacyWorkspaceDocumentMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bridge-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.document.canonicalMarkdown).toBe("# frozen");
    expect(body.data.sections[0].heading).toBe("Frozen");
  });

  it("does not query mutable canonical_documents", async () => {
    const supabase = createSupabase("versioned");
    requireApiUserMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
    });

    await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bridge-1" }),
    });

    expect(supabase.from).not.toHaveBeenCalledWith("canonical_documents");
  });
});
