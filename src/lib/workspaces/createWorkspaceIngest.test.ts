import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  WorkspaceIngestConversionError,
  WorkspaceIngestValidationError,
  buildImmutableStoragePath,
  deriveSourceTitle,
  runWorkspaceIngest,
} from "@/lib/workspaces/createWorkspaceIngest";
import {
  convertPasteWithMarkItDown,
  convertUrlWithMarkItDown,
  convertWithMarkItDown,
} from "@/lib/pipeline/markitdown";

vi.mock("@/lib/pipeline/markitdown", () => ({
  MARKITDOWN_VERSION: "0.1.6",
  convertWithMarkItDown: vi.fn(async () => "# converted"),
  convertPasteWithMarkItDown: vi.fn(async () => "# pasted"),
  convertUrlWithMarkItDown: vi.fn(async () => "# youtube"),
}));

type MockSupabase = {
  storage: { from: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

function createMockSupabase(options?: {
  rpcResult?: Record<string, unknown>;
  rpcError?: { message: string } | null;
}): MockSupabase {
  const download = vi.fn(async () => ({
    data: {
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    },
    error: null,
  }));
  const upload = vi.fn(async () => ({ error: null }));
  const storageFrom = vi.fn(() => ({ download, upload }));

  const rpc = vi.fn(async () => ({
    data: options?.rpcResult ?? {
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "ver-1",
      versionNumber: 1,
    },
    error: options?.rpcError ?? null,
  }));

  const versionUpdate = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => {
    if (table === "document_versions") {
      return {
        update: vi.fn(() => ({
          eq: versionUpdate,
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    storage: { from: storageFrom },
    from,
    rpc,
  };
}

describe("deriveSourceTitle", () => {
  it("derives title from filename without extension", () => {
    expect(
      deriveSourceTitle({
        kind: "multipart_file",
        file: new File(["x"], "Biology Notes.PDF"),
      }),
    ).toBe("Biology Notes");
  });

  it("uses pasted source for paste payloads", () => {
    expect(deriveSourceTitle({ kind: "paste", text: "a".repeat(40) })).toBe(
      "Pasted source",
    );
  });

  it("uses YouTube source for youtube payloads", () => {
    expect(
      deriveSourceTitle({
        kind: "youtube",
        url: "https://www.youtube.com/watch?v=abc",
      }),
    ).toBe("YouTube source");
  });
});

describe("buildImmutableStoragePath", () => {
  it("builds workspace/document/version path", () => {
    expect(
      buildImmutableStoragePath("ws-1", "doc-1", "ver-1", "Report.pdf"),
    ).toBe("ws-1/doc-1/ver-1/Report.pdf");
  });
});

describe("runWorkspaceIngest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid paste before RPC or storage work", async () => {
    const supabase = createMockSupabase();

    await expect(
      runWorkspaceIngest({
        supabase: supabase as never,
        userId: "user-1",
        payload: { kind: "paste", text: "short" },
      }),
    ).rejects.toBeInstanceOf(WorkspaceIngestValidationError);

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("rejects invalid youtube URL before RPC", async () => {
    const supabase = createMockSupabase();

    await expect(
      runWorkspaceIngest({
        supabase: supabase as never,
        userId: "user-1",
        payload: { kind: "youtube", url: "https://example.com/video" },
      }),
    ).rejects.toBeInstanceOf(WorkspaceIngestValidationError);

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects staging file_ref outside owner ingest-staging prefix", async () => {
    const supabase = createMockSupabase();

    await expect(
      runWorkspaceIngest({
        supabase: supabase as never,
        userId: "user-1",
        payload: {
          kind: "file_ref",
          storagePath: "user-1/other/file.pdf",
          mimeType: "application/pdf",
          filename: "file.pdf",
          sizeBytes: 100,
        },
      }),
    ).rejects.toBeInstanceOf(WorkspaceIngestValidationError);

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("creates workspace document version and returns IDs on first paste ingest", async () => {
    const supabase = createMockSupabase();
    const text = "a".repeat(50);

    const result = await runWorkspaceIngest({
      supabase: supabase as never,
      userId: "user-1",
      payload: { kind: "paste", text },
    });

    expect(convertPasteWithMarkItDown).toHaveBeenCalledWith(text);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_workspace_document_version",
      expect.objectContaining({
        p_workspace_id: null,
        p_document_id: null,
        p_source_kind: "paste",
        p_workspace_title: "Pasted source",
        p_document_title: "Pasted source",
      }),
    );
    expect(result).toMatchObject({
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "ver-1",
      versionNumber: 1,
      conversionStatus: "ok",
    });
  });

  it("appends a version when workspace and document IDs are provided", async () => {
    const supabase = createMockSupabase({
      rpcResult: {
        workspaceId: "ws-1",
        documentId: "doc-1",
        documentVersionId: "ver-2",
        versionNumber: 2,
      },
    });

    const result = await runWorkspaceIngest({
      supabase: supabase as never,
      userId: "user-1",
      workspaceId: "ws-1",
      documentId: "doc-1",
      payload: { kind: "paste", text: "a".repeat(50) },
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_workspace_document_version",
      expect.objectContaining({
        p_workspace_id: "ws-1",
        p_document_id: "doc-1",
      }),
    );
    expect(result.versionNumber).toBe(2);
    expect(result.documentVersionId).toBe("ver-2");
  });

  it("persists failed conversion as an explicit failed version then throws", async () => {
    const supabase = createMockSupabase();
    vi.mocked(convertPasteWithMarkItDown).mockRejectedValueOnce(
      new Error("markitdown failed"),
    );

    await expect(
      runWorkspaceIngest({
        supabase: supabase as never,
        userId: "user-1",
        payload: { kind: "paste", text: "a".repeat(50) },
      }),
    ).rejects.toBeInstanceOf(WorkspaceIngestConversionError);

    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_workspace_document_version",
      expect.objectContaining({
        p_raw_markdown: "",
        p_conversion_provenance: expect.objectContaining({
          conversion_status: "failed",
        }),
      }),
    );
  });

  it("calls create_workspace_document_version only after youtube validation", async () => {
    const supabase = createMockSupabase();
    const url = "https://www.youtube.com/watch?v=abc12345678";

    await runWorkspaceIngest({
      supabase: supabase as never,
      userId: "user-1",
      payload: { kind: "youtube", url },
    });

    expect(convertUrlWithMarkItDown).toHaveBeenCalledWith(url);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_workspace_document_version",
      expect.objectContaining({
        p_source_kind: "url",
        p_source_url: url,
      }),
    );
  });

  it("uploads original bytes to immutable path after RPC for file_ref", async () => {
    const supabase = createMockSupabase();
    const stagingPath = "user-1/ingest-staging/stage-1/report.pdf";

    await runWorkspaceIngest({
      supabase: supabase as never,
      userId: "user-1",
      payload: {
        kind: "file_ref",
        storagePath: stagingPath,
        mimeType: "application/pdf",
        filename: "report.pdf",
        sizeBytes: 100,
      },
    });

    expect(convertWithMarkItDown).toHaveBeenCalled();
    const storageApi = supabase.storage.from.mock.results.at(-1)?.value as {
      upload: ReturnType<typeof vi.fn>;
    };
    expect(storageApi.upload).toHaveBeenCalledWith(
      "ws-1/doc-1/ver-1/report.pdf",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/pdf" }),
    );
  });
});
