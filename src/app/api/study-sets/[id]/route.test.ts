import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUserMock = vi.fn();
const resolveLegacyStudySetBridgeMock = vi.fn();
const resolveLegacyWorkspaceDocumentMock = vi.fn();
const patchWorkspaceMetadataMock = vi.fn();
const softDeleteDocumentMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

vi.mock("@/lib/workspaces/legacyBridge", () => ({
  resolveLegacyStudySetBridge: (...args: unknown[]) =>
    resolveLegacyStudySetBridgeMock(...args),
  resolveLegacyWorkspaceDocument: (...args: unknown[]) =>
    resolveLegacyWorkspaceDocumentMock(...args),
}));

vi.mock("@/lib/workspaces/documentVersions", () => ({
  patchWorkspaceMetadata: (...args: unknown[]) =>
    patchWorkspaceMetadataMock(...args),
  softDeleteDocument: (...args: unknown[]) => softDeleteDocumentMock(...args),
}));

import { DELETE, GET, PATCH } from "@/app/api/study-sets/[id]/route";

const BRIDGE = {
  outputId: "out-1",
  workspaceId: "ws-1",
  bridgeStudySetId: "bridge-1",
  legacyParentStudySetId: "parent-1",
  kind: "quiz" as const,
  resolutionMode: "bridge" as const,
  historyStudySetId: "bridge-1",
};

const STUDY_SET_ROW = {
  id: "bridge-1",
  title: "Biology",
  subtitle: null,
  pipeline_stage: "quiz",
  content_kind: "quiz",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-02T00:00:00.000Z",
};

function createSupabase(options?: { row?: typeof STUDY_SET_ROW | null }) {
  const row = options?.row === undefined ? STUDY_SET_ROW : options.row;
  return {
    from: vi.fn((table: string) => {
      if (table !== "study_sets") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: row, error: null })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { ...STUDY_SET_ROW, title: "Renamed" },
                error: null,
              })),
            })),
          })),
        })),
      };
    }),
  };
}

describe("GET/PATCH/DELETE /api/study-sets/[id] (legacy metadata adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: createSupabase(),
      user: { id: "user-1" },
    });
    resolveLegacyStudySetBridgeMock.mockResolvedValue(BRIDGE);
    resolveLegacyWorkspaceDocumentMock.mockResolvedValue({
      documentId: "doc-1",
      documentVersionId: "dv-1",
    });
    softDeleteDocumentMock.mockResolvedValue({ id: "doc-1" });
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

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bridge-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when bridge is inaccessible", async () => {
    resolveLegacyStudySetBridgeMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bridge-1" }),
    });

    expect(response.status).toBe(404);
    expect(resolveLegacyStudySetBridgeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studySetId: "bridge-1",
        routeKind: "metadata",
        userId: "user-1",
      }),
    );
  });

  it("returns legacy study-set DTO after bridge resolution", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bridge-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: "bridge-1",
      title: "Biology",
      pipeline_stage: "quiz",
    });
  });

  it("PATCH updates workspace metadata and returns legacy DTO", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Renamed" }),
      }),
      { params: Promise.resolve({ id: "bridge-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(patchWorkspaceMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        patch: { title: "Renamed" },
      }),
    );
    expect(body.data.title).toBe("Renamed");
  });

  it("DELETE soft-deletes document and never hard-deletes study_sets", async () => {
    const supabase = createSupabase();
    requireApiUserMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
    });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bridge-1" }),
    });

    expect(response.status).toBe(204);
    expect(softDeleteDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        documentId: "doc-1",
      }),
    );
    expect(supabase.from).not.toHaveBeenCalledWith("study_sets");
  });

  it("parent metadata resolution uses history on parent without duplicating rows", async () => {
    resolveLegacyStudySetBridgeMock.mockResolvedValue({
      ...BRIDGE,
      resolutionMode: "parent",
      historyStudySetId: "parent-1",
      legacyParentStudySetId: "parent-1",
    });

    await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "parent-1" }),
    });

    expect(resolveLegacyStudySetBridgeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studySetId: "parent-1",
        routeKind: "metadata",
      }),
    );
  });
});
