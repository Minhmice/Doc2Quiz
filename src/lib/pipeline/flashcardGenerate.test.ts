import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FlashcardGenerateError,
  FlashcardGenerateValidationError,
  runFlashcardGenerate,
} from "@/lib/pipeline/flashcardGenerate";

const postChatCompletionAssistantTextMock = vi.fn();
const loadFlashcardPromptMock = vi.fn();
const buildFlashcardGeneratorMessagesMock = vi.fn();
const isAiProcessingConfiguredMock = vi.fn();
const getAiProcessingConfigMock = vi.fn();
const resolveUserAiTierMock = vi.fn();
const createRandomUuidMock = vi.fn();

vi.mock("@/lib/server/openAiChatCompletion", () => ({
  postChatCompletionAssistantText: (...args: unknown[]) =>
    postChatCompletionAssistantTextMock(...args),
}));

vi.mock("@/lib/pipeline/flashcardPrompt", () => ({
  loadFlashcardPrompt: () => loadFlashcardPromptMock(),
  buildFlashcardGeneratorMessages: (...args: unknown[]) =>
    buildFlashcardGeneratorMessagesMock(...args),
  FLASHCARD_PROMPT_VERSION: "1.0",
}));

vi.mock("@/lib/server/ai-processing-config", () => ({
  isAiProcessingConfigured: () => isAiProcessingConfiguredMock(),
  getAiProcessingConfig: (...args: unknown[]) =>
    getAiProcessingConfigMock(...args),
}));

vi.mock("@/lib/server/resolveUserAiTier", () => ({
  resolveUserAiTier: (...args: unknown[]) => resolveUserAiTierMock(...args),
}));

vi.mock("@/lib/ids/createRandomUuid", () => ({
  createRandomUuid: () => createRandomUuidMock(),
}));

const validLlmOutput = {
  detected_format: "term_definition",
  recommended_count: 2,
  concepts: [
    { concept_id: "concept_001", label: "One" },
    { concept_id: "concept_002", label: "Two" },
  ],
  cards: [
    {
      concept_id: "concept_001",
      front: "Front one",
      back: "Back one",
      format: "term_definition",
      section_key: "sec_001",
      source_excerpt: "one excerpt",
    },
    {
      concept_id: "concept_002",
      front: "Front two",
      back: "Back two",
      format: "term_definition",
      section_key: "sec_002",
      source_excerpt: "two excerpt",
    },
  ],
  warnings: [],
};

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

function createMockSupabase(
  options: {
    pipelineStage?: string;
    canonicalMarkdown?: string;
    metadata?: Record<string, unknown>;
    sections?: Array<{
      ordinal: number;
      heading: string;
      body_markdown: string;
      section_key: string;
    }>;
  } = {},
): MockSupabase {
  const {
    pipelineStage = "canonical",
    canonicalMarkdown = "# Canonical\n\nBody.",
    metadata = { extracted_questions: [] },
    sections = [
      {
        ordinal: 1,
        heading: "Intro",
        body_markdown: "Body.",
        section_key: "sec_001",
      },
      {
        ordinal: 2,
        heading: "Chapter",
        body_markdown: "More.",
        section_key: "sec_002",
      },
    ],
  } = options;

  const flashcardDelete = vi.fn(async () => ({ error: null }));
  const flashcardInsert = vi.fn(async () => ({ error: null }));
  const questionDelete = vi.fn(async () => ({ error: null }));
  const studySetUpdate = vi.fn(async () => ({ error: null }));

  const from = vi.fn((table: string) => {
    if (table === "study_sets") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "set-1",
                  pipeline_stage: pipelineStage,
                  title: "My Set",
                },
                error: null,
              })),
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
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "doc-1",
                  canonical_markdown: canonicalMarkdown,
                  metadata,
                },
                error: null,
              })),
            })),
          })),
        })),
      };
    }
    if (table === "canonical_sections") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: sections,
                error: null,
              })),
            })),
          })),
        })),
      };
    }
    if (table === "approved_flashcards") {
      return {
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: flashcardDelete,
          })),
        })),
        insert: flashcardInsert,
      };
    }
    if (table === "approved_questions") {
      return {
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: questionDelete,
          })),
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { from };
}

const mockUser = { id: "user-1" } as never;

const defaultParams = {
  learningGoal: "memorize" as const,
  coverage: "entire_document" as const,
  amount: "recommended" as const,
};

describe("runFlashcardGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createRandomUuidMock
      .mockReturnValueOnce("card-id-1")
      .mockReturnValueOnce("card-id-2");
    isAiProcessingConfiguredMock.mockReturnValue(true);
    resolveUserAiTierMock.mockReturnValue("free");
    getAiProcessingConfigMock.mockReturnValue({
      url: "https://api.example.com",
      key: "test-key",
      model: "test-model",
      tier: "free",
    });
    loadFlashcardPromptMock.mockResolvedValue({
      name: "flashcard_generator",
      version: "1.0",
      system: "system",
      input: {},
      tasks: [],
      output_schema: {},
      constraints: [],
    });
    buildFlashcardGeneratorMessagesMock.mockReturnValue({
      system: "system prompt",
      user: '{"canonical_markdown":"test"}',
    });
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify(validLlmOutput),
    });
  });

  it("throws FlashcardGenerateValidationError when pipeline_stage is raw", async () => {
    const supabase = createMockSupabase({ pipelineStage: "raw" });

    await expect(
      runFlashcardGenerate({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
        ...defaultParams,
      }),
    ).rejects.toBeInstanceOf(FlashcardGenerateValidationError);

    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("throws FlashcardGenerateValidationError when canonical_markdown is empty", async () => {
    const supabase = createMockSupabase({ canonicalMarkdown: "   " });

    await expect(
      runFlashcardGenerate({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
        ...defaultParams,
      }),
    ).rejects.toBeInstanceOf(FlashcardGenerateValidationError);

    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("throws FlashcardGenerateError with status 503 when AI is not configured", async () => {
    isAiProcessingConfiguredMock.mockReturnValue(false);
    const supabase = createMockSupabase();

    await expect(
      runFlashcardGenerate({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
        ...defaultParams,
      }),
    ).rejects.toMatchObject({
      name: "FlashcardGenerateError",
      statusCode: 503,
    });
  });

  it("builds flashcard messages from canonical inputs only", async () => {
    const supabase = createMockSupabase();

    await runFlashcardGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      learningGoal: "understand",
      coverage: "entire_document",
      amount: "recommended",
    });

    expect(buildFlashcardGeneratorMessagesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        study_set_id: "set-1",
        canonical_markdown: "# Canonical\n\nBody.",
        sections_json: expect.any(String),
        extracted_questions_json: expect.any(String),
        learning_goal: "understand",
        coverage_mode: "entire_document",
      }),
    );
    expect(
      buildFlashcardGeneratorMessagesMock.mock.calls[0]?.[1],
    ).not.toHaveProperty("raw_markdown");
  });

  it("filters sections_json when coverage uses sectionKeys", async () => {
    const supabase = createMockSupabase();

    await runFlashcardGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      learningGoal: "memorize",
      coverage: { sectionKeys: ["sec_002"] },
      amount: "recommended",
    });

    const sectionsJson = buildFlashcardGeneratorMessagesMock.mock.calls[0]?.[1]
      ?.sections_json as string;
    const parsed = JSON.parse(sectionsJson) as Array<{ section_key: string }>;

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.section_key).toBe("sec_002");
    expect(buildFlashcardGeneratorMessagesMock.mock.calls[0]?.[1]).toMatchObject({
      coverage_mode: "selected_sections",
    });
  });

  it("deletes flashcards and questions then inserts before updating study set", async () => {
    const supabase = createMockSupabase();
    const callOrder: string[] = [];

    supabase.from.mockImplementation((table: string) => {
      if (table === "approved_flashcards") {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => {
                callOrder.push("flashcard_delete");
                return { error: null };
              }),
            })),
          })),
          insert: vi.fn(async () => {
            callOrder.push("flashcard_insert");
            return { error: null };
          }),
        };
      }
      if (table === "approved_questions") {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => {
                callOrder.push("question_delete");
                return { error: null };
              }),
            })),
          })),
        };
      }
      if (table === "study_sets") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "set-1",
                    pipeline_stage: "canonical",
                    title: "My Set",
                  },
                  error: null,
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => {
                callOrder.push("study_set_update");
                return { error: null };
              }),
            })),
          })),
        };
      }
      if (table === "canonical_documents") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "doc-1",
                    canonical_markdown: "# Canonical\n\nBody.",
                    metadata: { extracted_questions: [] },
                  },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "canonical_sections") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [
                    {
                      ordinal: 1,
                      heading: "Intro",
                      body_markdown: "Body.",
                      section_key: "sec_001",
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await runFlashcardGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      ...defaultParams,
    });

    expect(callOrder).toEqual([
      "flashcard_delete",
      "question_delete",
      "flashcard_insert",
      "study_set_update",
    ]);
    expect(result).toEqual({
      ok: true,
      recommendedCount: 2,
      generatedCount: 2,
      detectedFormat: "term_definition",
      cardIds: ["card-id-1", "card-id-2"],
    });
  });

  it("does not insert flashcards when LLM validation fails", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ invalid: true }),
    });
    const supabase = createMockSupabase();

    await expect(
      runFlashcardGenerate({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
        ...defaultParams,
      }),
    ).rejects.toBeInstanceOf(FlashcardGenerateError);

    const flashcardCalls = supabase.from.mock.calls.filter(
      ([table]) => table === "approved_flashcards",
    );
    expect(flashcardCalls).toHaveLength(0);
  });
});
