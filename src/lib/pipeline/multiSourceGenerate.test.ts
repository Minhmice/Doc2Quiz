import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MultiSourceGenerateValidationError,
  runMultiSourceQuizGenerate,
} from "@/lib/pipeline/multiSourceGenerate";

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

const VERSION_A = "11111111-1111-4111-8111-111111111111";
const VERSION_B = "22222222-2222-4222-8222-222222222222";
const VERSION_OTHER = "33333333-3333-4333-8333-333333333333";

const groundedFacts = [
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
];

const groundedMarkdown =
  "# Doc\n\none excerpt\n\ntwo excerpt\n\nthree excerpt\n\nfour excerpt";

function makeVersionRow(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    status: "completed",
    deleted_at: null,
    document_version_id: `dv-${id}`,
    canonical_markdown: groundedMarkdown,
    canonical_content_checksum: `content-${id}`,
    sections_checksum: `sections-${id}`,
    metadata: {
      language: "en",
      source_readiness: { pass: true, reasons: [] },
      atomic_facts: groundedFacts,
      extracted_questions: [],
      max_supported_count: 4,
    },
    model: "gpt-test",
    prompt_version: "1.0",
    parser_version: "1.0",
    generator_settings: { temperature: 0 },
    provenance: { mode: "ai", api_key: "sk-secret" },
    document_versions: {
      id: `dv-${id}`,
      deleted_at: null,
      documents: {
        id: `doc-${id}`,
        title: "Biology",
        workspace_id: "ws-1",
        deleted_at: null,
      },
    },
    ...overrides,
  };
}

type QueryResult = { data: unknown; error: { message: string } | null };

function createMockSupabase(options: {
  role?: string | null;
  versions?: Record<string, unknown>[];
  sections?: Record<string, unknown>[];
  rpc?: ReturnType<typeof vi.fn>;
}) {
  const role = options.role === undefined ? "editor" : options.role;
  const versions = options.versions ?? [
    makeVersionRow(VERSION_A),
    makeVersionRow(VERSION_B),
  ];
  const sections =
    options.sections ??
    versions.flatMap((version) =>
      groundedFacts.map((fact, index) => ({
        canonical_version_id: version.id,
        ordinal: index + 1,
        section_key: fact.section_key,
        heading: `H${index + 1}`,
        section_type: "theory",
        body_markdown: fact.source_excerpt,
      })),
    );

  const rpc =
    options.rpc ??
    vi.fn(async () => ({
      data: {
        outputId: "out-1",
        bridgeStudySetId: "bridge-1",
        legacyParentStudySetId: null,
        kind: "quiz",
        itemCount: 1,
        snapshotCount: versions.length,
      },
      error: null,
    }));

  const from = vi.fn((table: string) => {
    if (table === "workspace_members") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(
                async (): Promise<QueryResult> => ({
                  data: role ? { role } : null,
                  error: null,
                }),
              ),
            })),
          })),
        })),
      };
    }
    if (table === "canonical_versions") {
      return {
        select: vi.fn(() => ({
          in: vi.fn(async (_col: string, ids: string[]) => ({
            data: versions.filter((row) => ids.includes(String(row.id))),
            error: null,
          })),
        })),
      };
    }
    if (table === "canonical_version_sections") {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: sections,
              error: null,
            })),
          })),
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { from, rpc };
}

describe("runMultiSourceQuizGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAiProcessingConfiguredMock.mockReturnValue(false);
    createRandomUuidMock
      .mockReset()
      .mockReturnValueOnce("q-1")
      .mockReturnValue("q-n");
    resolveUserAiTierMock.mockReturnValue("free");
  });

  it("rejects empty selection before any AI call", async () => {
    const supabase = createMockSupabase({});
    await expect(
      runMultiSourceQuizGenerate({
        supabase: supabase as never,
        user: { id: "user-1" } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        canonicalVersionIds: [],
      }),
    ).rejects.toBeInstanceOf(MultiSourceGenerateValidationError);
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("dedupes duplicate IDs without reordering first-seen provenance", async () => {
    const supabase = createMockSupabase({});
    createRandomUuidMock.mockReset().mockReturnValue("q-1");

    const result = await runMultiSourceQuizGenerate({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      userId: "user-1",
      workspaceId: "ws-1",
      canonicalVersionIds: [VERSION_B, VERSION_A, VERSION_B],
      questionCountOverride: 1,
    });

    expect(result.ok).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_learning_output",
      expect.objectContaining({
        p_snapshots: expect.arrayContaining([
          expect.objectContaining({
            canonical_version_id: VERSION_B,
            ordinal: 1,
          }),
          expect.objectContaining({
            canonical_version_id: VERSION_A,
            ordinal: 2,
          }),
        ]),
      }),
    );
    const snapshots = supabase.rpc.mock.calls[0]![1].p_snapshots as Array<{
      canonical_version_id: string;
      ordinal: number;
    }>;
    expect(snapshots.map((s) => s.canonical_version_id)).toEqual([
      VERSION_B,
      VERSION_A,
    ]);
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("rejects incomplete, deleted, and cross-workspace versions before AI", async () => {
    const incomplete = createMockSupabase({
      versions: [makeVersionRow(VERSION_A, { status: "pending" })],
    });
    await expect(
      runMultiSourceQuizGenerate({
        supabase: incomplete as never,
        user: { id: "user-1" } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        canonicalVersionIds: [VERSION_A],
      }),
    ).rejects.toThrow(/not completed/i);
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();

    const deleted = createMockSupabase({
      versions: [
        makeVersionRow(VERSION_A, {
          deleted_at: "2026-07-01T00:00:00.000Z",
        }),
      ],
    });
    await expect(
      runMultiSourceQuizGenerate({
        supabase: deleted as never,
        user: { id: "user-1" } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        canonicalVersionIds: [VERSION_A],
      }),
    ).rejects.toThrow(/deleted/i);

    const cross = createMockSupabase({
      versions: [
        makeVersionRow(VERSION_OTHER, {
          document_versions: {
            id: "dv-x",
            deleted_at: null,
            documents: {
              id: "doc-x",
              title: "Other",
              workspace_id: "ws-other",
              deleted_at: null,
            },
          },
        }),
      ],
    });
    await expect(
      runMultiSourceQuizGenerate({
        supabase: cross as never,
        user: { id: "user-1" } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        canonicalVersionIds: [VERSION_OTHER],
      }),
    ).rejects.toThrow(/outside workspace/i);
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("freezes exact snapshots and persists via create_learning_output bridge", async () => {
    const supabase = createMockSupabase({
      versions: [makeVersionRow(VERSION_A)],
    });
    createRandomUuidMock.mockReset().mockReturnValue("q-1");

    const result = await runMultiSourceQuizGenerate({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      userId: "user-1",
      workspaceId: "ws-1",
      canonicalVersionIds: [VERSION_A],
      questionCountOverride: 1,
    });

    expect(result.bridgeStudySetId).toBe("bridge-1");
    expect(result.studySetId).toBe("bridge-1");
    expect(result.outputId).toBe("out-1");
    expect(result.snapshotCount).toBe(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_learning_output",
      expect.objectContaining({
        p_workspace_id: "ws-1",
        p_kind: "quiz",
        p_expected_item_count: 1,
      }),
    );

    const args = supabase.rpc.mock.calls[0]![1];
    expect(args.p_snapshots[0]).toMatchObject({
      canonical_version_id: VERSION_A,
      canonical_content_checksum: `content-${VERSION_A}`,
      sections_checksum: `sections-${VERSION_A}`,
      canonical_markdown: groundedMarkdown,
    });
    expect(JSON.stringify(args.p_snapshots)).not.toMatch(/sk-secret|api_key/i);
    expect(args.p_items[0]).toMatchObject({
      id: "q-1",
      prompt: expect.any(String),
      choices: expect.any(Array),
    });
    // Never destructive replace/delete prior banks
    expect(supabase.rpc.mock.calls.map((c) => c[0])).toEqual([
      "create_learning_output",
    ]);
  });

  it("returns bridge study set id for quota/session/mistake setId consumers", async () => {
    const supabase = createMockSupabase({
      versions: [makeVersionRow(VERSION_A)],
    });
    createRandomUuidMock.mockReset().mockReturnValue("q-1");

    const result = await runMultiSourceQuizGenerate({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      userId: "user-1",
      workspaceId: "ws-1",
      canonicalVersionIds: [VERSION_A],
      questionCountOverride: 1,
    });

    expect(result.studySetId).toBe(result.bridgeStudySetId);
    expect(result.questionIds).toEqual(["q-1"]);
  });
});
