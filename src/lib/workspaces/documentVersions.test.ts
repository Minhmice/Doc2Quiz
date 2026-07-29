import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
  WorkspaceValidationError,
} from "@/lib/workspaces/errors";
import {
  appendDocumentVersion,
  patchDocumentMetadata,
  patchWorkspaceMetadata,
  resolveLegacyStudySetBridge,
  softDeleteDocument,
  softDeleteDocumentVersion,
} from "@/lib/workspaces/documentVersions";

const runWorkspaceIngestMock = vi.fn();

vi.mock("@/lib/workspaces/createWorkspaceIngest", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workspaces/createWorkspaceIngest")>();
  return {
    ...actual,
    runWorkspaceIngest: (...args: unknown[]) => runWorkspaceIngestMock(...args),
  };
});

type ChainResult = { data: unknown; error: { message: string } | null };

function createUpdateChain(result: ChainResult) {
  const maybeSingle = vi.fn(async () => result);
  const select = vi.fn(() => ({ maybeSingle }));
  const isNull = vi.fn(() => ({ select, maybeSingle }));
  const eq2 = vi.fn(() => ({ is: isNull, select, maybeSingle, eq: eq3 }));
  const eq3 = vi.fn(() => ({ is: isNull, select, maybeSingle }));
  const eq1 = vi.fn(() => ({ eq: eq2, is: isNull, select, maybeSingle }));
  const update = vi.fn(() => ({ eq: eq1, is: isNull, select }));
  return { update, eq1, eq2, isNull, select, maybeSingle };
}

describe("documentVersions metadata and soft delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("patchWorkspaceMetadata updates only title/subtitle fields", async () => {
    const chain = createUpdateChain({
      data: { id: "ws-1", title: "Renamed", subtitle: "sub" },
      error: null,
    });
    const membershipMaybeSingle = vi.fn(async () => ({
      data: { role: "owner" },
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === "workspace_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: membershipMaybeSingle,
              })),
            })),
          })),
        };
      }
      if (table === "workspaces") {
        return chain;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await patchWorkspaceMetadata({
      supabase: { from } as never,
      userId: "user-1",
      workspaceId: "ws-1",
      patch: { title: "Renamed", subtitle: "sub" },
    });

    expect(chain.update).toHaveBeenCalledWith({
      title: "Renamed",
      subtitle: "sub",
    });
    expect(result).toMatchObject({ id: "ws-1", title: "Renamed" });
  });

  it("patchDocumentMetadata never accepts source fields", async () => {
    await expect(
      patchDocumentMetadata({
        supabase: { from: vi.fn() } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        documentId: "doc-1",
        patch: {
          title: "Doc",
          raw_markdown: "tamper",
        } as never,
      }),
    ).rejects.toBeInstanceOf(WorkspaceValidationError);
  });

  it("patchDocumentMetadata updates title/description only", async () => {
    const chain = createUpdateChain({
      data: { id: "doc-1", title: "Doc", description: "d" },
      error: null,
    });
    const membershipMaybeSingle = vi.fn(async () => ({
      data: { role: "editor" },
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === "workspace_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: membershipMaybeSingle,
              })),
            })),
          })),
        };
      }
      if (table === "documents") {
        return chain;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await patchDocumentMetadata({
      supabase: { from } as never,
      userId: "user-1",
      workspaceId: "ws-1",
      documentId: "doc-1",
      patch: { title: "Doc", description: "d" },
    });

    expect(chain.update).toHaveBeenCalledWith({
      title: "Doc",
      description: "d",
    });
  });

  it("softDeleteDocument sets deleted_at and never deletes learning_outputs", async () => {
    const chain = createUpdateChain({
      data: { id: "doc-1" },
      error: null,
    });
    const membershipMaybeSingle = vi.fn(async () => ({
      data: { role: "owner" },
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === "workspace_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: membershipMaybeSingle,
              })),
            })),
          })),
        };
      }
      if (table === "documents") {
        return chain;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await softDeleteDocument({
      supabase: { from } as never,
      userId: "user-1",
      workspaceId: "ws-1",
      documentId: "doc-1",
    });

    const updateCalls = chain.update.mock.calls as unknown as Array<
      [{ deleted_at: string }]
    >;
    const updateArg = updateCalls[0]?.[0];
    expect(updateArg?.deleted_at).toEqual(expect.any(String));
    expect(from).not.toHaveBeenCalledWith("learning_outputs");
    expect(from).not.toHaveBeenCalledWith("output_source_snapshots");
  });

  it("softDeleteDocumentVersion sets deleted_at without touching outputs", async () => {
    const chain = createUpdateChain({
      data: { id: "ver-1" },
      error: null,
    });
    const membershipMaybeSingle = vi.fn(async () => ({
      data: { role: "editor" },
      error: null,
    }));
    const documentLookup = vi.fn(async () => ({
      data: { id: "doc-1", workspace_id: "ws-1" },
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === "workspace_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: membershipMaybeSingle,
              })),
            })),
          })),
        };
      }
      if (table === "documents") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: documentLookup,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "document_versions") {
        return chain;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await softDeleteDocumentVersion({
      supabase: { from } as never,
      userId: "user-1",
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "ver-1",
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
    expect(from).not.toHaveBeenCalledWith("learning_outputs");
  });

  it("viewer write attempts raise WorkspaceForbiddenError", async () => {
    const membershipMaybeSingle = vi.fn(async () => ({
      data: { role: "viewer" },
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === "workspace_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: membershipMaybeSingle,
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      softDeleteDocument({
        supabase: { from } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        documentId: "doc-1",
      }),
    ).rejects.toBeInstanceOf(WorkspaceForbiddenError);
  });

  it("missing membership raises WorkspaceNotFoundError", async () => {
    const membershipMaybeSingle = vi.fn(async () => ({
      data: null,
      error: null,
    }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: membershipMaybeSingle,
          })),
        })),
      })),
    }));

    await expect(
      patchWorkspaceMetadata({
        supabase: { from } as never,
        userId: "user-1",
        workspaceId: "ws-missing",
        patch: { title: "x" },
      }),
    ).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });

  it("appendDocumentVersion delegates to runWorkspaceIngest with IDs", async () => {
    runWorkspaceIngestMock.mockResolvedValue({
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "ver-2",
      versionNumber: 2,
      conversionStatus: "ok",
      rawMarkdownLength: 10,
      title: "Pasted source",
    });

    const result = await appendDocumentVersion({
      supabase: {} as never,
      userId: "user-1",
      workspaceId: "ws-1",
      documentId: "doc-1",
      payload: { kind: "paste", text: "a".repeat(50) },
    });

    expect(runWorkspaceIngestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        documentId: "doc-1",
      }),
    );
    expect(result.versionNumber).toBe(2);
  });

  it("resolveLegacyStudySetBridge looks up learning_outputs.legacy_study_set_id", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        workspace_id: "ws-1",
        legacy_study_set_id: "set-1",
        id: "out-1",
      },
      error: null,
    }));
    const from = vi.fn((table: string) => {
      expect(table).toBe("learning_outputs");
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
      };
    });

    const result = await resolveLegacyStudySetBridge({
      supabase: { from } as never,
      legacyStudySetId: "set-1",
    });

    expect(result).toEqual({
      workspaceId: "ws-1",
      legacyStudySetId: "set-1",
      learningOutputId: "out-1",
    });
  });
});
