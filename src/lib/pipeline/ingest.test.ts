import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IngestConversionError,
  IngestValidationError,
  runIngest,
} from "@/lib/pipeline/ingest";
import {
  convertPasteWithMarkItDown,
  convertUrlWithMarkItDown,
  convertWithMarkItDown,
} from "@/lib/pipeline/markitdown";
import { SUPPORTED_MIME_TYPES } from "@/lib/pipeline/validation";

vi.mock("@/lib/pipeline/markitdown", () => ({
  MARKITDOWN_VERSION: "0.1.6",
  convertWithMarkItDown: vi.fn(async () => "# converted"),
  convertPasteWithMarkItDown: vi.fn(async () => "# pasted"),
  convertUrlWithMarkItDown: vi.fn(async () => "# youtube"),
}));

type MockSupabase = {
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

function createMockSupabase(): MockSupabase {
  const download = vi.fn(async () => ({
    data: {
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    },
    error: null,
  }));
  const upload = vi.fn(async () => ({ error: null }));
  const canonicalUpsert = vi.fn(async () => ({ error: null }));
  const studySetUpdate = vi.fn(async () => ({ error: null }));

  const storageFrom = vi.fn(() => ({
    download,
    upload,
  }));

  const from = vi.fn((table: string) => {
    if (table === "canonical_documents") {
      return { upsert: canonicalUpsert };
    }
    if (table === "study_sets") {
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: studySetUpdate,
          })),
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    storage: { from: storageFrom },
    from,
  };
}

describe("runIngest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws validation error before storage is called for invalid paste", async () => {
    const supabase = createMockSupabase();

    await expect(
      runIngest({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        payload: { kind: "paste", text: "short" },
      }),
    ).rejects.toBeInstanceOf(IngestValidationError);

    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("rejects file_ref paths outside the owner prefix", async () => {
    const supabase = createMockSupabase();

    await expect(
      runIngest({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        payload: {
          kind: "file_ref",
          storagePath: "other-user/set-1/file.pdf",
          mimeType: "application/pdf",
          filename: "file.pdf",
          sizeBytes: 100,
        },
      }),
    ).rejects.toBeInstanceOf(IngestValidationError);
  });

  it("converts paste input and advances pipeline_stage to raw", async () => {
    const supabase = createMockSupabase();
    const text = "a".repeat(50);

    const result = await runIngest({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      payload: { kind: "paste", text },
    });

    expect(convertPasteWithMarkItDown).toHaveBeenCalledWith(text);
    expect(result.pipelineStage).toBe("raw");
    expect(result.rawMarkdownLength).toBeGreaterThan(0);
    expect(supabase.from).toHaveBeenCalledWith("canonical_documents");
    expect(supabase.from).toHaveBeenCalledWith("study_sets");
  });

  it("calls convertUrlWithMarkItDown for youtube payloads", async () => {
    const supabase = createMockSupabase();
    const url = "https://www.youtube.com/watch?v=abc12345678";

    await runIngest({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      payload: { kind: "youtube", url },
    });

    expect(convertUrlWithMarkItDown).toHaveBeenCalledWith(url);
  });

  it("does not advance pipeline_stage when conversion fails", async () => {
    const supabase = createMockSupabase();
    vi.mocked(convertPasteWithMarkItDown).mockRejectedValueOnce(
      new Error("markitdown failed"),
    );

    await expect(
      runIngest({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        payload: { kind: "paste", text: "a".repeat(50) },
      }),
    ).rejects.toBeInstanceOf(IngestConversionError);

    expect(supabase.from).toHaveBeenCalledWith("canonical_documents");
    expect(supabase.from).not.toHaveBeenCalledWith("study_sets");
  });

  it.each(SUPPORTED_MIME_TYPES)(
    "accepts MIME %s through file_ref ingest",
    async (mimeType) => {
      const supabase = createMockSupabase();

      await runIngest({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        payload: {
          kind: "file_ref",
          storagePath: "user-1/set-1/sample.bin",
          mimeType,
          filename: "sample.bin",
          sizeBytes: 1,
        },
      });

      expect(convertWithMarkItDown).toHaveBeenCalled();
    },
  );

  it("stores original_storage_path for file_ref success", async () => {
    const supabase = createMockSupabase();
    const storagePath = "user-1/set-1/report.pdf";

    await runIngest({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      payload: {
        kind: "file_ref",
        storagePath,
        mimeType: "application/pdf",
        filename: "report.pdf",
        sizeBytes: 100,
      },
    });

    const canonicalCall = supabase
      .from("canonical_documents")
      .upsert.mock.calls.at(-1)?.[0];
    expect(canonicalCall).toMatchObject({
      original_storage_path: storagePath,
      metadata: expect.objectContaining({ input_type: "file" }),
    });
  });

  it("stores metadata.input_type paste for paste success", async () => {
    const supabase = createMockSupabase();

    await runIngest({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      payload: { kind: "paste", text: "a".repeat(50) },
    });

    const canonicalCall = supabase
      .from("canonical_documents")
      .upsert.mock.calls.at(-1)?.[0];
    expect(canonicalCall).toMatchObject({
      metadata: expect.objectContaining({ input_type: "paste" }),
    });
  });
});
