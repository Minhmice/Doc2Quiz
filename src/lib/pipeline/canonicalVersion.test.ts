import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  checksumCanonicalMarkdown,
  checksumSections,
} from "@/lib/provenance/checksum";
import {
  CanonicalVersionError,
  CanonicalVersionPersistenceError,
  CanonicalVersionValidationError,
  runCanonicalVersion,
} from "@/lib/pipeline/canonicalVersion";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

const postChatCompletionAssistantTextMock = vi.fn();
const loadCanonicalPromptMock = vi.fn();
const buildCanonicalMessagesMock = vi.fn();
const isAiProcessingConfiguredMock = vi.fn();
const getAiProcessingConfigMock = vi.fn();
const resolveUserAiTierMock = vi.fn();

vi.mock("@/lib/server/openAiChatCompletion", () => ({
  postChatCompletionAssistantText: (...args: unknown[]) =>
    postChatCompletionAssistantTextMock(...args),
}));

vi.mock("@/lib/pipeline/canonicalPrompt", () => ({
  loadCanonicalPrompt: () => loadCanonicalPromptMock(),
  buildCanonicalMessages: (...args: unknown[]) =>
    buildCanonicalMessagesMock(...args),
  CANONICAL_PROMPT_VERSION: "1.0",
}));

vi.mock("@/lib/server/ai-processing-config", () => ({
  isAiProcessingConfigured: () => isAiProcessingConfiguredMock(),
  getAiProcessingConfig: (...args: unknown[]) =>
    getAiProcessingConfigMock(...args),
}));

vi.mock("@/lib/server/resolveUserAiTier", () => ({
  resolveUserAiTier: (...args: unknown[]) => resolveUserAiTierMock(...args),
}));

const validLlmOutput = {
  title: "Test Document",
  filename: "test-document.md",
  language: "en",
  document_type: "theory",
  topics: ["biology"],
  canonical_markdown: "# Test Document\n\nBody content.",
  sections: [
    {
      id: "sec_001",
      title: "Introduction",
      content: "Body content.",
      content_type: "theory",
    },
  ],
  extracted_questions: [],
  atomic_facts: [
    {
      fact_id: "fact_001",
      section_key: "sec_001",
      statement: "Body content.",
      source_excerpt: "Body content.",
      answer_text: "Body content.",
      fact_type: "property",
      entities: ["Body"],
      conditions: [],
      question_opportunities: ["match_property"],
      answerable: true,
    },
  ],
  source_readiness: { pass: true, reasons: [] },
  max_supported_count: 1,
  warnings: [],
};

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

function createMockSupabase(
  options: {
    role?: string | null;
    documentVersion?: Record<string, unknown> | null;
    rpcResults?: Array<{
      data: Record<string, unknown> | null;
      error: { message: string } | null;
    }>;
  } = {},
): MockSupabase {
  const {
    role = "editor",
    documentVersion = {
      id: "ver-1",
      document_id: "doc-1",
      version_number: 1,
      raw_markdown: "# Raw content\n\nSome text.",
      original_filename: "notes.md",
      deleted_at: null,
      conversion_provenance: {
        input_type: "paste",
        conversion_status: "ok",
        markitdown_version: "0.1.6",
      },
      documents: {
        id: "doc-1",
        workspace_id: "ws-1",
        title: "Notes",
        deleted_at: null,
      },
    },
    rpcResults = [
      {
        data: {
          canonicalVersionId: "cv-1",
          versionNumber: 1,
          sectionCount: 1,
        },
        error: null,
      },
    ],
  } = options;

  const memberMaybeSingle = vi.fn(async () => ({
    data: role ? { role } : null,
    error: null,
  }));

  const versionMaybeSingle = vi.fn(async () => ({
    data: documentVersion,
    error: null,
  }));

  const from = vi.fn((table: string) => {
    if (table === "workspace_members") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: memberMaybeSingle,
            })),
          })),
        })),
      };
    }
    if (table === "document_versions") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle: versionMaybeSingle,
            })),
          })),
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  const rpc = vi.fn(async () => {
    return rpcResults.shift() ?? {
      data: {
        canonicalVersionId: "cv-next",
        versionNumber: 2,
        sectionCount: 1,
      },
      error: null,
    };
  });

  return { from, rpc };
}

const mockUser = { id: "user-1" } as never;

describe("runCanonicalVersion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    isAiProcessingConfiguredMock.mockReturnValue(true);
    resolveUserAiTierMock.mockReturnValue("free");
    getAiProcessingConfigMock.mockReturnValue({
      url: "https://api.example.com/v1",
      key: "secret-api-key-do-not-persist",
      model: "test-model",
      tier: "free",
    });
    loadCanonicalPromptMock.mockResolvedValue({
      name: "canonical_knowledge_builder",
      version: "1.0",
      system: "system",
      input: {},
      tasks: [],
      output_schema: {},
      constraints: [],
    });
    buildCanonicalMessagesMock.mockReturnValue({
      system: "system prompt",
      user: '{"raw_markdown":"test"}',
    });
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify(validLlmOutput),
    });
  });

  it("throws when workspace member is missing", async () => {
    const supabase = createMockSupabase({ role: null });

    await expect(
      runCanonicalVersion({
        supabase: supabase as never,
        userId: "user-1",
        workspaceId: "ws-1",
        documentId: "doc-1",
        documentVersionId: "ver-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(WorkspaceNotFoundError);

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("throws when viewer cannot canonicalize", async () => {
    const supabase = createMockSupabase({ role: "viewer" });

    await expect(
      runCanonicalVersion({
        supabase: supabase as never,
        userId: "user-1",
        workspaceId: "ws-1",
        documentId: "doc-1",
        documentVersionId: "ver-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(WorkspaceForbiddenError);

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("throws when active document version is missing", async () => {
    const supabase = createMockSupabase({ documentVersion: null });

    await expect(
      runCanonicalVersion({
        supabase: supabase as never,
        userId: "user-1",
        workspaceId: "ws-1",
        documentId: "doc-1",
        documentVersionId: "ver-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(WorkspaceNotFoundError);

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("throws when raw markdown is empty and never persists", async () => {
    const supabase = createMockSupabase({
      documentVersion: {
        id: "ver-1",
        document_id: "doc-1",
        version_number: 1,
        raw_markdown: "   ",
        original_filename: "notes.md",
        deleted_at: null,
        conversion_provenance: { input_type: "paste" },
        documents: {
          id: "doc-1",
          workspace_id: "ws-1",
          title: "Notes",
          deleted_at: null,
        },
      },
    });

    await expect(
      runCanonicalVersion({
        supabase: supabase as never,
        userId: "user-1",
        workspaceId: "ws-1",
        documentId: "doc-1",
        documentVersionId: "ver-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(CanonicalVersionValidationError);

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("appends via persist_canonical_version with checksums and never replace_canonical_content", async () => {
    const supabase = createMockSupabase();

    const result = await runCanonicalVersion({
      supabase: supabase as never,
      userId: "user-1",
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "ver-1",
      user: mockUser,
    });

    expect(result).toMatchObject({
      canonicalVersionId: "cv-1",
      versionNumber: 1,
      sectionCount: 1,
      title: "Test Document",
      model: "test-model",
      promptVersion: "1.0",
      parserVersion: expect.any(String),
    });
    expect(result.createdAt).toEqual(expect.any(String));

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "persist_canonical_version",
      expect.objectContaining({
        p_document_version_id: "ver-1",
        p_canonical_markdown: validLlmOutput.canonical_markdown,
        p_model: "test-model",
        p_prompt_version: "1.0",
        p_expected_section_count: 1,
      }),
    );

    const rpcArgs = supabase.rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(rpcArgs.p_canonical_content_checksum).toBe(
      checksumCanonicalMarkdown(validLlmOutput.canonical_markdown),
    );
    expect(rpcArgs.p_sections_checksum).toBe(
      checksumSections([
        {
          ordinal: 1,
          section_key: "sec_001",
          heading: "Introduction",
          section_type: "theory",
          body_markdown: "Body content.",
        },
      ]),
    );

    const provenance = rpcArgs.p_provenance as Record<string, unknown>;
    expect(JSON.stringify(provenance)).not.toContain("secret-api-key");
    expect(provenance).toMatchObject({
      mode: "ai",
      markitdown_version: "0.1.6",
      prompt_version: "1.0",
    });

    const rpcName = supabase.rpc.mock.calls[0][0];
    expect(rpcName).not.toBe("replace_canonical_content");
    expect(supabase.from).not.toHaveBeenCalledWith("canonical_documents");
  });

  it("reruns append another immutable canonical version", async () => {
    const supabase = createMockSupabase({
      rpcResults: [
        {
          data: {
            canonicalVersionId: "cv-1",
            versionNumber: 1,
            sectionCount: 1,
          },
          error: null,
        },
        {
          data: {
            canonicalVersionId: "cv-2",
            versionNumber: 2,
            sectionCount: 1,
          },
          error: null,
        },
      ],
    });

    const first = await runCanonicalVersion({
      supabase: supabase as never,
      userId: "user-1",
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "ver-1",
      user: mockUser,
    });
    const second = await runCanonicalVersion({
      supabase: supabase as never,
      userId: "user-1",
      workspaceId: "ws-1",
      documentId: "doc-1",
      documentVersionId: "ver-1",
      user: mockUser,
    });

    expect(first.versionNumber).toBe(1);
    expect(second.versionNumber).toBe(2);
    expect(second.canonicalVersionId).toBe("cv-2");
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc.mock.calls.every(([name]) => name === "persist_canonical_version")).toBe(
      true,
    );
  });

  it("does not persist a partial version when builder output is invalid", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ title: "broken" }),
    });
    const heuristic = await import("@/lib/pipeline/heuristicCanonicalBuilder");
    vi.spyOn(heuristic, "buildHeuristicCanonicalOutput").mockImplementation(
      () => {
        throw new Error("heuristic boom");
      },
    );

    const supabase = createMockSupabase();

    await expect(
      runCanonicalVersion({
        supabase: supabase as never,
        userId: "user-1",
        workspaceId: "ws-1",
        documentId: "doc-1",
        documentVersionId: "ver-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(CanonicalVersionError);

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("maps persistence failures without inventing a version", async () => {
    const supabase = createMockSupabase({
      rpcResults: [{ data: null, error: { message: "db down" } }],
    });

    await expect(
      runCanonicalVersion({
        supabase: supabase as never,
        userId: "user-1",
        workspaceId: "ws-1",
        documentId: "doc-1",
        documentVersionId: "ver-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(CanonicalVersionPersistenceError);

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});
