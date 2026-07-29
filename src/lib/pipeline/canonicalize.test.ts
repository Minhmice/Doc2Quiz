import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CanonicalizeError,
  CanonicalizePersistenceError,
  CanonicalizeValidationError,
  runCanonicalize,
} from "@/lib/pipeline/canonicalize";

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
    pipelineStage?: string;
    studySetTitle?: string;
    rawMarkdown?: string;
    docId?: string;
    metadata?: Record<string, unknown>;
    rpcResults?: Array<{
      data: number | null;
      error: { message: string } | null;
    }>;
  } = {},
): MockSupabase {
  const {
    pipelineStage = "raw",
    studySetTitle = "My Study Set",
    rawMarkdown = "# Raw content\n\nSome text.",
    docId = "doc-1",
    metadata = { input_type: "paste" },
    rpcResults = [{ data: 1, error: null }],
  } = options;

  const studySetSelect = vi.fn(async () => ({
    data: { id: "set-1", pipeline_stage: pipelineStage, title: studySetTitle },
    error: null,
  }));

  const docSelect = vi.fn(async () => ({
    data: {
      id: docId,
      raw_markdown: rawMarkdown,
      original_filename: "notes.md",
      metadata,
    },
    error: null,
  }));

  const docUpdate = vi.fn(async () => ({ error: null }));
  const sectionsDelete = vi.fn(async () => ({ error: null }));
  const sectionsInsert = vi.fn(async () => ({ error: null }));
  const studySetUpdate = vi.fn(async () => ({ error: null }));

  const from = vi.fn((table: string) => {
    if (table === "study_sets") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: studySetSelect,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: studySetUpdate,
          })),
        })),
      };
    }
    if (table === "canonical_documents") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: docSelect,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: docUpdate,
          })),
        })),
      };
    }
    if (table === "canonical_sections") {
      return {
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: sectionsDelete,
          })),
        })),
        insert: sectionsInsert,
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  const rpc = vi.fn(async () => {
    return rpcResults.shift() ?? { data: 1, error: null };
  });

  return { from, rpc };
}

const mockUser = { id: "user-1" } as never;

describe("runCanonicalize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAiProcessingConfiguredMock.mockReturnValue(true);
    resolveUserAiTierMock.mockReturnValue("free");
    getAiProcessingConfigMock.mockReturnValue({
      url: "https://api.example.com",
      key: "test-key",
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

  it("throws CanonicalizeValidationError when pipeline_stage is input", async () => {
    const supabase = createMockSupabase({ pipelineStage: "input" });

    await expect(
      runCanonicalize({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(CanonicalizeValidationError);

    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("throws CanonicalizeValidationError when raw_markdown is empty", async () => {
    const supabase = createMockSupabase({ rawMarkdown: "   " });

    await expect(
      runCanonicalize({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(CanonicalizeValidationError);

    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("throws CanonicalizeError when AI is not configured", async () => {
    isAiProcessingConfiguredMock.mockReturnValue(false);
    const supabase = createMockSupabase();

    await expect(
      runCanonicalize({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(CanonicalizeError);
  });

  it("returns canonical result and persists sections on success", async () => {
    const supabase = createMockSupabase();

    const result = await runCanonicalize({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    });

    expect(result).toMatchObject({
      studySetId: "set-1",
      pipelineStage: "canonical",
      sectionCount: 1,
      title: "Test Document",
    });
    expect(postChatCompletionAssistantTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        responseFormatJsonObject: true,
        temperature: 0,
      }),
    );
    expect(supabase.from).toHaveBeenCalledWith("canonical_documents");
    expect(supabase.rpc).toHaveBeenCalledWith(
      "replace_canonical_content",
      expect.objectContaining({
        p_study_set_id: "set-1",
        p_expected_section_count: 1,
        p_metadata: expect.objectContaining({
          canonicalization_mode: "ai",
          warnings: expect.arrayContaining([
            expect.stringMatching(/Title "Test Document" may be invented/),
          ]),
        }),
      }),
    );
  });

  it("merges deterministically recovered exam questions when AI under-extracts", async () => {
    const rawMarkdown = [
      "PHẦN I. Chọn một phương án.",
      "Câu 1. Câu hỏi thứ nhất?",
      "A. Một.",
      "B. Hai.",
      "Câu 2. Câu hỏi thứ hai?",
      "A. Ba.",
      "B. Bốn.",
      "PHẦN II. Đúng sai.",
      "Câu 1. Không lấy câu này?",
    ].join("\n");
    const supabase = createMockSupabase({ rawMarkdown });

    await runCanonicalize({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "replace_canonical_content",
      expect.objectContaining({
        p_metadata: expect.objectContaining({
          extracted_questions: expect.arrayContaining([
            expect.objectContaining({ question: "Câu hỏi thứ nhất?" }),
            expect.objectContaining({ question: "Câu hỏi thứ hai?" }),
          ]),
          warnings: expect.arrayContaining([
            expect.stringContaining("Recovered 2 source questions deterministically"),
          ]),
        }),
      }),
    );
  });

  it("caps each canonical AI request at 90 seconds", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const supabase = createMockSupabase();

    await runCanonicalize({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    });

    expect(timeoutSpy).toHaveBeenCalledWith(90_000);
    timeoutSpy.mockRestore();
  });

  it("falls back to heuristic canonicalization when LLM validation fails", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ invalid: true }),
    });
    const supabase = createMockSupabase();

    const result = await runCanonicalize({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    });

    expect(result.pipelineStage).toBe("canonical");
    expect(supabase.rpc).toHaveBeenCalledWith(
      "replace_canonical_content",
      expect.objectContaining({
        p_metadata: expect.objectContaining({
          canonicalization_mode: "heuristic",
          canonicalization_upstream_error: expect.any(String),
        }),
      }),
    );
  });

  it("uses heuristic fallback when AI upstream fails", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: false,
      status: 524,
      body: "524: A timeout occurred",
    });
    const supabase = createMockSupabase();

    const result = await runCanonicalize({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    });

    expect(result.pipelineStage).toBe("canonical");
    expect(result.sectionCount).toBeGreaterThan(0);
  });

  it("retries transient Supabase network failures and then succeeds", async () => {
    const supabase = createMockSupabase({
      rpcResults: [
        { data: null, error: { message: "TypeError: fetch failed" } },
        { data: null, error: { message: "network request failed" } },
        { data: 1, error: null },
      ],
    });

    await expect(
      runCanonicalize({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
      }),
    ).resolves.toMatchObject({ pipelineStage: "canonical" });

    expect(supabase.rpc).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-network persistence errors", async () => {
    const supabase = createMockSupabase({
      rpcResults: [
        { data: null, error: { message: "permission denied for function" } },
      ],
    });

    await expect(
      runCanonicalize({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(CanonicalizePersistenceError);

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("returns a persistence error after three network failures", async () => {
    const supabase = createMockSupabase({
      rpcResults: Array.from({ length: 3 }, () => ({
        data: null,
        error: { message: "fetch failed" },
      })),
    });

    await expect(
      runCanonicalize({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
      }),
    ).rejects.toThrow(/Cannot reach Supabase/);

    expect(supabase.rpc).toHaveBeenCalledTimes(3);
  });
});
