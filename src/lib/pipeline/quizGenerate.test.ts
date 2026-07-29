import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  QuizGenerateValidationError,
  runQuizGenerate,
} from "@/lib/pipeline/quizGenerate";

const postChatCompletionAssistantTextMock = vi.fn();
const loadQuizPromptMock = vi.fn();
const buildQuizGeneratorMessagesMock = vi.fn();
const isAiProcessingConfiguredMock = vi.fn();
const getAiProcessingConfigMock = vi.fn();
const resolveUserAiTierMock = vi.fn();
const createRandomUuidMock = vi.fn();

vi.mock("@/lib/server/openAiChatCompletion", () => ({
  postChatCompletionAssistantText: (...args: unknown[]) =>
    postChatCompletionAssistantTextMock(...args),
}));

vi.mock("@/lib/pipeline/quizPrompt", () => ({
  loadQuizPrompt: () => loadQuizPromptMock(),
  buildQuizGeneratorMessages: (...args: unknown[]) =>
    buildQuizGeneratorMessagesMock(...args),
  QUIZ_PROMPT_VERSION: "1.0",
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
  recommended_count: 2,
  concepts: [
    { concept_id: "concept_001", label: "One", section_key: "sec_001" },
    { concept_id: "concept_002", label: "Two", section_key: "sec_002" },
  ],
  questions: [
    {
      concept_id: "concept_001",
      prompt: "What is concept one?",
      choices: ["one excerpt", "B", "C", "D"],
      correct_index: 0,
      explanation: "Because one.",
      section_key: "sec_001",
      source_excerpt: "one excerpt",
      fact_ids: ["fact_001"],
      semantic_intent: "match_property",
      answer_text: "one excerpt",
    },
    {
      concept_id: "concept_002",
      prompt: "What is concept two?",
      choices: ["A", "two excerpt", "C", "D"],
      correct_index: 1,
      explanation: "Because two.",
      section_key: "sec_002",
      source_excerpt: "two excerpt",
      fact_ids: ["fact_002"],
      semantic_intent: "match_property",
      answer_text: "two excerpt",
    },
  ],
  warnings: [],
};

const groundedMetadata = {
  extracted_questions: [],
  atomic_facts: [
    {
      fact_id: "fact_001",
      section_key: "sec_001",
      statement: "one excerpt",
      source_excerpt: "one excerpt",
      answer_text: "one excerpt",
      fact_type: "property",
      entities: ["concept one"],
      conditions: [],
      question_opportunities: ["match_property"],
      answerable: true,
    },
    {
      fact_id: "fact_002",
      section_key: "sec_002",
      statement: "two excerpt",
      source_excerpt: "two excerpt",
      answer_text: "two excerpt",
      fact_type: "property",
      entities: ["concept two"],
      conditions: [],
      question_opportunities: ["match_property"],
      answerable: true,
    },
    {
      fact_id: "fact_003",
      section_key: "sec_003",
      statement: "three excerpt",
      source_excerpt: "three excerpt",
      answer_text: "three excerpt",
      fact_type: "property",
      entities: ["concept three"],
      conditions: [],
      question_opportunities: ["match_property"],
      answerable: true,
    },
    {
      fact_id: "fact_004",
      section_key: "sec_004",
      statement: "four excerpt",
      source_excerpt: "four excerpt",
      answer_text: "four excerpt",
      fact_type: "property",
      entities: ["concept four"],
      conditions: [],
      question_opportunities: ["match_property"],
      answerable: true,
    },
  ],
  source_readiness: { pass: true, reasons: [] },
  max_supported_count: 2,
};

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
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
    canonicalMarkdown =
      "# Canonical\n\none excerpt\n\ntwo excerpt\n\nthree excerpt\n\nfour excerpt",
    metadata = groundedMetadata,
    sections = [
      {
        ordinal: 1,
        heading: "Intro",
        body_markdown: "one excerpt",
        section_key: "sec_001",
      },
      {
        ordinal: 2,
        heading: "More",
        body_markdown: "two excerpt",
        section_key: "sec_002",
      },
      {
        ordinal: 3,
        heading: "Third",
        body_markdown: "three excerpt",
        section_key: "sec_003",
      },
      {
        ordinal: 4,
        heading: "Fourth",
        body_markdown: "four excerpt",
        section_key: "sec_004",
      },
    ],
  } = options;

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
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    from,
    rpc: vi.fn(async (_name: string, args: { p_expected_count: number }) => ({
      data: args.p_expected_count,
      error: null,
    })),
  };
}

const mockUser = { id: "user-1" } as never;

describe("runQuizGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let uuidIndex = 0;
    createRandomUuidMock.mockImplementation(() => `q-id-${++uuidIndex}`);
    isAiProcessingConfiguredMock.mockReturnValue(true);
    resolveUserAiTierMock.mockReturnValue("free");
    getAiProcessingConfigMock.mockReturnValue({
      url: "https://api.example.com",
      key: "test-key",
      model: "test-model",
      tier: "free",
    });
    loadQuizPromptMock.mockResolvedValue({
      name: "quiz_generator",
      version: "1.0",
      system: "system",
      input: {},
      tasks: [],
      output_schema: {},
      constraints: [],
    });
    buildQuizGeneratorMessagesMock.mockReturnValue({
      system: "system prompt",
      user: '{"canonical_markdown":"test"}',
    });
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify(validLlmOutput),
    });
  });

  it("throws QuizGenerateValidationError when pipeline_stage is raw", async () => {
    const supabase = createMockSupabase({ pipelineStage: "raw" });

    await expect(
      runQuizGenerate({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(QuizGenerateValidationError);

    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("throws QuizGenerateValidationError when canonical_markdown is empty", async () => {
    const supabase = createMockSupabase({ canonicalMarkdown: "   " });

    await expect(
      runQuizGenerate({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
      }),
    ).rejects.toBeInstanceOf(QuizGenerateValidationError);

    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("uses deterministic generation when AI is not configured", async () => {
    isAiProcessingConfiguredMock.mockReturnValue(false);
    const supabase = createMockSupabase();

    await expect(runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    })).resolves.toMatchObject({
      generationMode: "deterministic",
      generatedCount: 2,
    });
  });

  it("builds quiz messages from canonical inputs only", async () => {
    const supabase = createMockSupabase();

    await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    });

    expect(buildQuizGeneratorMessagesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        study_set_id: "set-1",
        canonical_markdown:
          "# Canonical\n\none excerpt\n\ntwo excerpt\n\nthree excerpt\n\nfour excerpt",
        sections_json: expect.any(String),
        extracted_questions_json: expect.any(String),
        atomic_facts_json: JSON.stringify(groundedMetadata.atomic_facts),
        max_supported_count: "40",
      }),
    );
    expect(buildQuizGeneratorMessagesMock.mock.calls[0]?.[1]).not.toHaveProperty(
      "raw_markdown",
    );
  });

  it("rejects a source without validated atomic facts before generation", async () => {
    const supabase = createMockSupabase({
      metadata: {
        extracted_questions: [],
        atomic_facts: [],
        source_readiness: {
          pass: false,
          reasons: ["No self-contained facts."],
        },
        max_supported_count: 0,
      },
    });

    await expect(
      runQuizGenerate({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
        questionCountOverride: 1,
      }),
    ).rejects.toMatchObject({
      code: "SOURCE_NOT_READY",
      statusCode: 422,
    });
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("reuses facts to satisfy a count above unique fact count", async () => {
    const supabase = createMockSupabase();

    await expect(runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 3,
    })).resolves.toMatchObject({
      requestedCount: 3,
      generatedCount: 3,
      factReuseCount: 1,
    });
  });

  it("repairs a correct choice that is not anchored to the fact answer", async () => {
    const unsupportedOutput = {
      ...validLlmOutput,
      recommended_count: 1,
      questions: [
        {
          ...validLlmOutput.questions[0],
          choices: ["wrong answer", "B", "C", "D"],
        },
      ],
    };
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify(unsupportedOutput),
    });
    const supabase = createMockSupabase();

    await expect(runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 1,
    })).resolves.toMatchObject({
      generatedCount: 1,
    });
    const rows = supabase.rpc.mock.calls[0]?.[1].p_questions;
    expect(rows[0].choices[rows[0].correct_index]).toBe("one excerpt");
  });

  it("removes a distractor that equals a referenced fact answer", async () => {
    const invalidOutput = {
      ...validLlmOutput,
      recommended_count: 1,
      questions: [
        {
          ...validLlmOutput.questions[0],
          fact_ids: ["fact_001", "fact_002"],
          choices: ["one excerpt", "two excerpt", "C", "D"],
          correct_index: 0,
          answer_text: "one excerpt",
        },
      ],
    };
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify(invalidOutput),
    });

    const supabase = createMockSupabase();
    await expect(runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 1,
    })).resolves.toMatchObject({
      generatedCount: 1,
    });
    const rows = supabase.rpc.mock.calls[0]?.[1].p_questions;
    expect(rows[0].choices.filter((choice: string) => choice === "one excerpt")).toHaveLength(1);
  });

  it("atomically replaces the validated batch", async () => {
    const supabase = createMockSupabase();
    const callOrder: string[] = [];
    supabase.rpc = vi.fn(async () => {
      callOrder.push("atomic_replace");
      return { data: 2, error: null };
    });

    supabase.from.mockImplementation((table: string) => {
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
                    canonical_markdown:
                      "# Canonical\n\none excerpt\n\ntwo excerpt",
                    metadata: {
                      ...groundedMetadata,
                      atomic_facts: groundedMetadata.atomic_facts.slice(0, 2),
                    },
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
                      body_markdown: "one excerpt",
                      section_key: "sec_001",
                    },
                    {
                      ordinal: 2,
                      heading: "More",
                      body_markdown: "two excerpt",
                      section_key: "sec_002",
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

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    });

    expect(callOrder).toEqual(["atomic_replace"]);
    expect(result).toMatchObject({
      ok: true,
      requestedCount: 2,
      recommendedCount: 2,
      generatedCount: 2,
      questionIds: ["q-id-1", "q-id-2"],
      generationMode: "ai",
    });
  });

  it("fills a short AI batch deterministically without another AI call", async () => {
    const firstOutput = {
      ...validLlmOutput,
      questions: [validLlmOutput.questions[0]],
    };
    postChatCompletionAssistantTextMock.mockResolvedValueOnce({
      ok: true,
      text: JSON.stringify(firstOutput),
    });
    const supabase = createMockSupabase();

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 2,
    });

    expect(postChatCompletionAssistantTextMock).toHaveBeenCalledTimes(1);
    expect(result.generatedCount).toBe(2);
    expect(result.generationMode).toBe("hybrid");
    expect(supabase.rpc).toHaveBeenCalledWith(
      "replace_quiz_questions",
      expect.objectContaining({ p_expected_count: 2 }),
    );
  });

  it("uses a grounded source question before calling AI", async () => {
    const supabase = createMockSupabase({
      metadata: {
        ...groundedMetadata,
        extracted_questions: [{
          question: "Which excerpt describes concept one?",
          options: ["one excerpt", "B", "C", "D"],
          answer: "one excerpt",
          section_id: "sec_001",
        }],
      },
    });

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 1,
    });

    expect(result).toMatchObject({
      requestedCount: 1,
      generatedCount: 1,
      generationMode: "source",
    });
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("uses an answered English source MCQ without requiring an atomic fact", async () => {
    const supabase = createMockSupabase({
      canonicalMarkdown: "# English exam\n\nWhich word is closest in meaning to appealing?",
      metadata: {
        language: "en",
        extracted_questions: [{
          question: "Which word is closest in meaning to appealing?",
          options: ["attractive", "boring", "ineffective", "limited"],
          answer: "attractive",
          section_id: "sec_001",
        }],
        atomic_facts: [],
        source_readiness: { pass: true, reasons: [] },
        max_supported_count: 1,
      },
      sections: [{
        ordinal: 1,
        heading: "English exam",
        body_markdown: "Which word is closest in meaning to appealing?",
        section_key: "sec_001",
      }],
    });

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 1,
    });

    expect(result).toMatchObject({
      generatedCount: 1,
      generationMode: "source",
    });
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "replace_quiz_questions",
      expect.objectContaining({
        p_questions: [
          expect.objectContaining({
            prompt: "Which word is closest in meaning to appealing?",
            choices: ["attractive", "boring", "ineffective", "limited"],
            correct_index: 0,
            source: expect.objectContaining({
              answer_text: "attractive",
              resolution: expect.objectContaining({ basis: "source_answer" }),
            }),
          }),
        ],
      }),
    );
  });

  it("resolves and atomically persists all 24 unanswered source questions", async () => {
    const extractedQuestions = Array.from({ length: 24 }, (_, index) => ({
      question: `Nội dung câu hỏi lịch sử số ${index + 1}?`,
      options: [`Phương án A${index + 1}`, `Phương án B${index + 1}`],
      answer: null,
      section_id: "sec_001",
    }));
    const resolverOutput = {
      questions: extractedQuestions.map((_, index) => ({
        source_question_index: index,
        answer_text: `Đáp án ${index + 1}`,
        choices: [
          `Đáp án ${index + 1}`,
          `Nhiễu X${index + 1}`,
          `Nhiễu Y${index + 1}`,
          `Nhiễu Z${index + 1}`,
        ],
        correct_index: 0,
        confidence: "medium",
        rationale: `Giải thích ${index + 1}`,
      })),
      warnings: [],
    };
    postChatCompletionAssistantTextMock.mockResolvedValueOnce({
      ok: true,
      text: JSON.stringify(resolverOutput),
    });
    const supabase = createMockSupabase({
      canonicalMarkdown: "# Đề thi\n\nNội dung 24 câu hỏi.",
      metadata: {
        extracted_questions: extractedQuestions,
        atomic_facts: [],
        source_readiness: { pass: true, reasons: [] },
        max_supported_count: 0,
        language: "vi",
      },
      sections: [{
        ordinal: 1,
        heading: "PHẦN I",
        body_markdown: "Nội dung 24 câu hỏi.",
        section_key: "sec_001",
      }],
    });

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    });

    expect(result).toMatchObject({
      requestedCount: 24,
      generatedCount: 24,
      generationMode: "source_ai",
    });
    expect(postChatCompletionAssistantTextMock).toHaveBeenCalledTimes(1);
    expect(postChatCompletionAssistantTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        configUrl: "https://api.example.com",
        apiKey: "test-key",
        model: "test-model",
      }),
    );
    expect(JSON.stringify(
      postChatCompletionAssistantTextMock.mock.calls[0]?.[0],
    )).not.toMatch(/Wikipedia|web_evidence|wikipedia\.org/i);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "replace_quiz_questions",
      expect.objectContaining({
        p_expected_count: 24,
        p_questions: expect.arrayContaining([
          expect.objectContaining({
            source: expect.objectContaining({
              fact_ids: ["sourceq_001"],
              resolution: expect.objectContaining({
                basis: "model_knowledge",
                confidence: "medium",
                citations: [],
              }),
            }),
          }),
        ]),
      }),
    );
  });

  it("repairs an incomplete source-question batch once", async () => {
    const sourceQuestions = [0, 1].map((index) => ({
      question: `Câu hỏi nguồn ${index + 1}?`,
      options: [],
      answer: null,
      section_id: "sec_001",
    }));
    const resolvedItem = (index: number) => ({
      source_question_index: index,
      answer_text: `Đúng ${index + 1}`,
      choices: [`Đúng ${index + 1}`, `Sai A${index}`, `Sai B${index}`, `Sai C${index}`],
      correct_index: 0,
      confidence: "low",
      rationale: `Giải thích ${index + 1}`,
    });
    postChatCompletionAssistantTextMock
      .mockResolvedValueOnce({
        ok: true,
        text: JSON.stringify({ questions: [resolvedItem(0)], warnings: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: JSON.stringify({
          questions: [resolvedItem(0), resolvedItem(1)],
          warnings: [],
        }),
      });
    const supabase = createMockSupabase({
      metadata: {
        extracted_questions: sourceQuestions,
        atomic_facts: [],
        source_readiness: { pass: true, reasons: [] },
        max_supported_count: 0,
      },
      sections: [{
        ordinal: 1,
        heading: "Questions",
        body_markdown: "Question source",
        section_key: "sec_001",
      }],
    });

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    });
    expect(result.generatedCount).toBe(2);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("2 source answers rely on the configured model"),
      expect.stringContaining("2 source answers have low confidence"),
    ]));
    expect(postChatCompletionAssistantTextMock).toHaveBeenCalledTimes(2);
  });

  it("rejects unanswered source questions instead of creating meta-question fallbacks", async () => {
    isAiProcessingConfiguredMock.mockReturnValue(false);
    const sourceQuestions = Array.from({ length: 4 }, (_, index) => ({
      question: `Câu hỏi gốc ${index + 1}?`,
      options: [],
      answer: null,
      section_id: "sec_001",
    }));
    const supabase = createMockSupabase({
      metadata: {
        extracted_questions: sourceQuestions,
        atomic_facts: [],
        source_readiness: { pass: true, reasons: [] },
        max_supported_count: 0,
      },
      sections: [{
        ordinal: 1,
        heading: "Questions",
        body_markdown: sourceQuestions.map((question) => question.question).join("\n"),
        section_key: "sec_001",
      }],
    });

    await expect(runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    })).rejects.toMatchObject({
      code: "INSUFFICIENT_VALID_QUESTIONS",
      statusCode: 422,
    });
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("caps each AI request at 90 seconds", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    try {
      await runQuizGenerate({
        supabase: createMockSupabase() as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
      });

      expect(timeoutSpy).toHaveBeenCalledWith(90_000);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("fills the exact requested count even when AI remains short", async () => {
    const shortOutput = {
      ...validLlmOutput,
      questions: [validLlmOutput.questions[0]],
    };
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify(shortOutput),
    });
    const supabase = createMockSupabase();

    await expect(runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 2,
    })).resolves.toMatchObject({
      requestedCount: 2,
      generatedCount: 2,
    });

    expect(postChatCompletionAssistantTextMock).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalled();
  });

  it("fails when atomic persistence does not confirm the target count", async () => {
    const supabase = createMockSupabase();
    supabase.rpc.mockResolvedValue({ data: 1, error: null });

    await expect(
      runQuizGenerate({
        supabase: supabase as never,
        userId: "user-1",
        studySetId: "set-1",
        user: mockUser,
        questionCountOverride: 2,
      }),
    ).rejects.toMatchObject({
      code: "PERSISTED_COUNT_MISMATCH",
      statusCode: 500,
    });
  });

  it("uses deterministic fill when LLM validation fails", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ invalid: true }),
    });
    const supabase = createMockSupabase();

    await expect(runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    })).resolves.toMatchObject({
      generationMode: "deterministic",
      generatedCount: 2,
    });
    expect(supabase.rpc).toHaveBeenCalled();
  });

  it("creates the exact requested count from one reusable fact", async () => {
    isAiProcessingConfiguredMock.mockReturnValue(false);
    const oneFact = {
      fact_id: "fact_001",
      section_key: "sec_001",
      statement: "Điểm sôi của nước ở áp suất tiêu chuẩn là 100 °C.",
      source_excerpt: "Điểm sôi của nước ở áp suất tiêu chuẩn là 100 °C.",
      answer_text: "100 °C",
      fact_type: "numeric",
      entities: ["điểm sôi của nước ở áp suất tiêu chuẩn"],
      conditions: [],
      question_opportunities: ["direct_calculation"],
      answerable: true,
    };
    const supabase = createMockSupabase({
      canonicalMarkdown: `# Canonical\n\n${oneFact.source_excerpt}`,
      metadata: {
        ...groundedMetadata,
        atomic_facts: [oneFact],
        max_supported_count: 1,
      },
      sections: [
        {
          ordinal: 1,
          heading: "Intro",
          body_markdown: oneFact.source_excerpt,
          section_key: "sec_001",
        },
      ],
    });

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 10,
    });

    expect(result).toMatchObject({
      requestedCount: 10,
      generatedCount: 10,
      factReuseCount: 9,
      generationMode: "deterministic",
    });
    const rows = supabase.rpc.mock.calls[0]?.[1].p_questions;
    expect(new Set(rows.map((row: { prompt: string }) => row.prompt)).size).toBe(10);
    expect(rows.every((row: { source: { fact_ids: string[] } }) =>
      row.source.fact_ids[0] === "fact_001")).toBe(true);
  });

  it("builds meaningful semantic distractors when AI is unavailable", async () => {
    isAiProcessingConfiguredMock.mockReturnValue(false);
    const excerpt =
      "Mục đích của mô hình là phát triển lực lượng sản xuất, tăng năng suất và nâng cao đời sống.";
    const fact = {
      fact_id: "fact_001",
      section_key: "sec_001",
      statement: excerpt,
      source_excerpt: excerpt,
      answer_text: "phát triển lực lượng sản xuất, tăng năng suất và nâng cao đời sống",
      fact_type: "definition",
      entities: ["Mục đích của mô hình"],
      conditions: [],
      question_opportunities: ["identify_definition"],
      answerable: true,
    };
    const supabase = createMockSupabase({
      canonicalMarkdown: excerpt,
      metadata: {
        ...groundedMetadata,
        atomic_facts: [fact],
        max_supported_count: 1,
      },
      sections: [{
        ordinal: 1,
        heading: "Mô hình",
        body_markdown: excerpt,
        section_key: "sec_001",
      }],
    });

    await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 1,
    });

    const row = supabase.rpc.mock.calls[0]?.[1].p_questions[0];
    expect(row.choices).toHaveLength(4);
    expect(
      row.choices.every(
        (choice: string) => !/Phương án khác/iu.test(choice),
      ),
    ).toBe(true);
    expect(row.choices).toEqual(expect.arrayContaining([
      expect.stringContaining("thu hẹp"),
      expect.stringContaining("giảm"),
      expect.stringContaining("hạ thấp"),
    ]));
  });

  it("does not mix distractors from unrelated facts with the same fact type", async () => {
    isAiProcessingConfiguredMock.mockReturnValue(false);
    const economicAnswer =
      "phát triển lực lượng sản xuất, phát triển kinh tế và nâng cao đời sống";
    const treatyAnswer =
      "một văn kiện được các nước ghi nhận đã nâng cao vị thế quốc tế của Việt Nam";
    const facts = [
      {
        fact_id: "fact_001",
        section_key: "sec_001",
        statement: `Mục đích của mô hình là ${economicAnswer}.`,
        source_excerpt: `Mục đích của mô hình là ${economicAnswer}.`,
        answer_text: economicAnswer,
        fact_type: "definition",
        entities: ["Mục đích của mô hình kinh tế"],
        conditions: [],
        question_opportunities: ["identify_definition"],
        answerable: true,
      },
      {
        fact_id: "fact_002",
        section_key: "sec_001",
        statement: `Hiệp định Gio-ne-vơ là ${treatyAnswer}.`,
        source_excerpt: `Hiệp định Gio-ne-vơ là ${treatyAnswer}.`,
        answer_text: treatyAnswer,
        fact_type: "definition",
        entities: ["Hiệp định Gio-ne-vơ"],
        conditions: [],
        question_opportunities: ["identify_definition"],
        answerable: true,
      },
    ];
    const canonicalMarkdown = facts.map((fact) => fact.source_excerpt).join("\n\n");
    const supabase = createMockSupabase({
      canonicalMarkdown,
      metadata: {
        ...groundedMetadata,
        atomic_facts: facts,
        max_supported_count: 2,
      },
      sections: [{
        ordinal: 1,
        heading: "Tư liệu",
        body_markdown: canonicalMarkdown,
        section_key: "sec_001",
      }],
    });

    await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 2,
    });

    const rows = supabase.rpc.mock.calls[0]?.[1].p_questions;
    const economicRow = rows.find(
      (row: { source: { fact_ids: string[] } }) =>
        row.source.fact_ids[0] === "fact_001",
    );
    const treatyRow = rows.find(
      (row: { source: { fact_ids: string[] } }) =>
        row.source.fact_ids[0] === "fact_002",
    );
    expect(economicRow.choices).not.toContain(treatyAnswer);
    expect(treatyRow.choices).not.toContain(economicAnswer);
  });

  it("uses AI for quality-approved heuristic facts", async () => {
    const supabase = createMockSupabase({
      metadata: {
        ...groundedMetadata,
        canonicalization_mode: "heuristic",
      },
    });

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    });

    expect(result.generationMode).toBe("ai");
    expect(postChatCompletionAssistantTextMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a canonical fact that contains a document dump", async () => {
    const dump = [
      "SỞ GIÁO DỤC VÀ ĐÀO TẠO",
      "ĐỀ CHÍNH THỨC",
      "Thời gian làm bài: 90 phút",
      "Câu 1. Câu hỏi thứ nhất?",
      "A. Một. B. Hai. C. Ba. D. Bốn.",
      "Câu 2. Câu hỏi thứ hai?",
    ].join("\n");
    const supabase = createMockSupabase({
      canonicalMarkdown: dump,
      metadata: {
        ...groundedMetadata,
        atomic_facts: [{
          ...groundedMetadata.atomic_facts[0],
          statement: dump,
          source_excerpt: dump,
          answer_text: "GIÁO",
          entities: ["GIÁO"],
        }],
      },
      sections: [{
        ordinal: 1,
        heading: "Document",
        body_markdown: dump,
        section_key: "sec_001",
      }],
    });

    await expect(runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 1,
    })).rejects.toMatchObject({
      code: "SOURCE_NOT_READY",
      statusCode: 422,
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects an invented prompt token and fills deterministically", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        recommended_count: 1,
        questions: [{
          fact_id: "fact_001",
          prompt: "Where is Paris mentioned in this concept?",
          choices: ["one excerpt", "B", "C", "D"],
          correct_index: 0,
        }],
      }),
    });
    const supabase = createMockSupabase();

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 1,
    });

    expect(result.generationMode).toBe("deterministic");
    expect(result.rejectionSummary).toEqual({ unsupported_prompt_token: 1 });
  });

  it("rejects raw question blocks and persists standalone MCQ prompts", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        recommended_count: 1,
        questions: [{
          fact_id: "fact_001",
          prompt:
            "Câu 1. Theo tài liệu, nội dung nào đúng? Câu 2. Chọn thêm một đáp án?",
          choices: ["one excerpt", "B. Sai một", "C. Sai hai", "D. Sai ba"],
          correct_index: 0,
        }],
      }),
    });
    const supabase = createMockSupabase();

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 1,
    });

    expect(result.generationMode).toBe("deterministic");
    expect(result.rejectionSummary).toEqual({ prompt_not_standalone: 1 });
    const row = supabase.rpc.mock.calls[0]?.[1].p_questions[0];
    expect(row.prompt).toMatch(/\?$/u);
    expect(row.prompt).not.toMatch(/Câu\s+\d+|_{3,}|\r|\n/u);
    expect(row.choices).toHaveLength(4);
    expect(row.choices.every((choice: string) => !/^[A-D][.)]\s/u.test(choice)))
      .toBe(true);
  });

  it("preserves a legitimately long grounded context, question, and choices", async () => {
    const answer = `kết luận chính xác ${"rất chi tiết ".repeat(20)}`.trim();
    const excerpt =
      `Khái niệm dài được xác định là ${answer}. ` +
      "Phần giải thích này cung cấp đầy đủ điều kiện, phạm vi áp dụng và ngoại lệ cần thiết. ".repeat(15).trim();
    const longPrompt =
      "Theo tài liệu, khi phải đồng thời xét đầy đủ điều kiện, phạm vi áp dụng và các ngoại lệ đã nêu, " +
      "phương án nào trình bày trọn vẹn kết luận của khái niệm dài mà không làm mất bất kỳ thành phần ý nghĩa thiết yếu nào?";
    const longChoices = [
      answer,
      `một kết luận thay thế ${"có diễn giải đầy đủ nhưng không đúng quan hệ nguồn ".repeat(5)}`,
      `một nhận định khác ${"giữ nguyên độ chi tiết nhưng thay đổi kết luận cốt lõi ".repeat(5)}`,
      `một phương án sai ${"bao quát điều kiện song không phản ánh mệnh đề canonical ".repeat(5)}`,
    ] as [string, string, string, string];
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        recommended_count: 1,
        questions: [{
          fact_id: "fact_001",
          prompt: longPrompt,
          choices: longChoices,
          correct_index: 0,
          context_mode: "source_excerpt",
        }],
      }),
    });
    const fact = {
      fact_id: "fact_001",
      section_key: "sec_001",
      statement: `Khái niệm dài được xác định là ${answer}.`,
      source_excerpt: excerpt,
      answer_text: answer,
      fact_type: "definition",
      entities: ["Khái niệm dài"],
      conditions: ["đầy đủ điều kiện và ngoại lệ"],
      question_opportunities: ["identify_definition"],
      answerable: true,
    };
    const supabase = createMockSupabase({
      canonicalMarkdown: excerpt,
      metadata: {
        ...groundedMetadata,
        atomic_facts: [fact],
        max_supported_count: 1,
      },
      sections: [{
        ordinal: 1,
        heading: "Khái niệm dài",
        body_markdown: excerpt,
        section_key: "sec_001",
      }],
    });

    const result = await runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
      questionCountOverride: 1,
    });

    const row = supabase.rpc.mock.calls[0]?.[1].p_questions[0];
    expect(result).toMatchObject({ generatedCount: 1, generationMode: "ai" });
    expect(row.prompt).toBe(`Tư liệu:\n\n${excerpt}\n\n${longPrompt}`);
    expect(row.prompt.length).toBeGreaterThan(280);
    expect(row.choices.some((choice: string) => choice.length > 180)).toBe(true);
    expect(row.choices[row.correct_index]).toBe(answer);
  });

  it("retries atomic persistence after transient network failures", async () => {
    const supabase = createMockSupabase();
    supabase.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } })
      .mockResolvedValueOnce({ data: null, error: { message: "network request failed" } })
      .mockResolvedValueOnce({ data: 2, error: null });

    await expect(runQuizGenerate({
      supabase: supabase as never,
      userId: "user-1",
      studySetId: "set-1",
      user: mockUser,
    })).resolves.toMatchObject({ generatedCount: 2 });
    expect(supabase.rpc).toHaveBeenCalledTimes(3);
  });
});
