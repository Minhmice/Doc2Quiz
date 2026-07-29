import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MultiSourceFlashcardValidationError,
  runMultiSourceFlashcardGenerate,
} from "@/lib/pipeline/flashcardMultiSourceGenerate";

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

const VERSION_A = "11111111-1111-4111-8111-111111111111";
const VERSION_B = "22222222-2222-4222-8222-222222222222";
const VERSION_OTHER = "33333333-3333-4333-8333-333333333333";

const groundedMarkdown =
  "# Doc\n\none excerpt\n\ntwo excerpt\n\nthree excerpt";

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
      extracted_questions: [],
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

const defaultSections = (versionId: string) => [
  {
    canonical_version_id: versionId,
    ordinal: 1,
    section_key: "sec_001",
    heading: "H1",
    section_type: "theory",
    body_markdown: "one excerpt",
  },
  {
    canonical_version_id: versionId,
    ordinal: 2,
    section_key: "sec_002",
    heading: "H2",
    section_type: "theory",
    body_markdown: "two excerpt",
  },
  {
    canonical_version_id: versionId,
    ordinal: 3,
    section_key: "sec_003",
    heading: "H3",
    section_type: "theory",
    body_markdown: "three excerpt",
  },
];

type QueryResult = { data: unknown; error: { message: string } | null };

function createMockSupabase(options: {
  role?: string | null;
  versions?: Record<string, unknown>[];
  sections?: Record<string, unknown>[];
  rpc?: ReturnType<typeof vi.fn>;
  itemCount?: number;
}) {
  const role = options.role === undefined ? "editor" : options.role;
  const versions = options.versions ?? [
    makeVersionRow(VERSION_A),
    makeVersionRow(VERSION_B),
  ];
  const sections =
    options.sections ??
    versions.flatMap((version) => defaultSections(String(version.id)));
  const itemCount = options.itemCount ?? 1;

  const rpc =
    options.rpc ??
    vi.fn(async () => ({
      data: {
        outputId: "out-1",
        bridgeStudySetId: "bridge-1",
        legacyParentStudySetId: null,
        kind: "flashcards",
        itemCount,
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
    if (table === "approved_questions" || table === "approved_flashcards") {
      return {
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => {
              throw new Error(
                `Unexpected destructive delete on ${table}`,
              );
            }),
          })),
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { from, rpc };
}

function mockAiFlashcardOutput() {
  postChatCompletionAssistantTextMock.mockResolvedValue({
    ok: true,
    text: JSON.stringify({
      detected_format: "term_definition",
      recommended_count: 1,
      concepts: [
        {
          concept_id: "concept_001",
          label: "Concept one",
          section_key: "sec_001",
          importance: "high",
        },
      ],
      cards: [
        {
          front: "What is concept one?",
          back: "one excerpt",
          format: "term_definition",
          concept_id: "concept_001",
          section_key: "sec_001",
          source_excerpt: "one excerpt",
        },
      ],
      warnings: [],
    }),
  });
}

describe("runMultiSourceFlashcardGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAiProcessingConfiguredMock.mockReturnValue(true);
    getAiProcessingConfigMock.mockReturnValue({
      url: "https://api.example/v1",
      key: "test-key",
      model: "gpt-test",
    });
    resolveUserAiTierMock.mockReturnValue("free");
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
    createRandomUuidMock.mockReset().mockReturnValue("c-1");
    mockAiFlashcardOutput();
  });

  it("rejects empty selection before any AI call", async () => {
    const supabase = createMockSupabase({});
    await expect(
      runMultiSourceFlashcardGenerate({
        supabase: supabase as never,
        user: { id: "user-1" } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        canonicalVersionIds: [],
        learningGoal: "memorize",
        coverage: "entire_document",
        amount: "recommended",
      }),
    ).rejects.toBeInstanceOf(MultiSourceFlashcardValidationError);
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("dedupes duplicate IDs without reordering first-seen provenance", async () => {
    const supabase = createMockSupabase({
      versions: [makeVersionRow(VERSION_A), makeVersionRow(VERSION_B)],
      itemCount: 1,
    });

    const result = await runMultiSourceFlashcardGenerate({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      userId: "user-1",
      workspaceId: "ws-1",
      canonicalVersionIds: [VERSION_B, VERSION_A, VERSION_B],
      learningGoal: "memorize",
      coverage: "entire_document",
      amount: "recommended",
    });

    expect(result.ok).toBe(true);
    const snapshots = supabase.rpc.mock.calls[0]![1].p_snapshots as Array<{
      canonical_version_id: string;
      ordinal: number;
    }>;
    expect(snapshots.map((s) => s.canonical_version_id)).toEqual([
      VERSION_B,
      VERSION_A,
    ]);
  });

  it("rejects incomplete, deleted, and cross-workspace versions before AI", async () => {
    const incomplete = createMockSupabase({
      versions: [makeVersionRow(VERSION_A, { status: "pending" })],
    });
    await expect(
      runMultiSourceFlashcardGenerate({
        supabase: incomplete as never,
        user: { id: "user-1" } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        canonicalVersionIds: [VERSION_A],
        learningGoal: "memorize",
        coverage: "entire_document",
        amount: "recommended",
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
      runMultiSourceFlashcardGenerate({
        supabase: deleted as never,
        user: { id: "user-1" } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        canonicalVersionIds: [VERSION_A],
        learningGoal: "memorize",
        coverage: "entire_document",
        amount: "recommended",
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
      runMultiSourceFlashcardGenerate({
        supabase: cross as never,
        user: { id: "user-1" } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        canonicalVersionIds: [VERSION_OTHER],
        learningGoal: "memorize",
        coverage: "entire_document",
        amount: "recommended",
      }),
    ).rejects.toThrow(/outside workspace/i);
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("rejects coverage keys that are not in selected source sections", async () => {
    const supabase = createMockSupabase({
      versions: [makeVersionRow(VERSION_A)],
    });
    await expect(
      runMultiSourceFlashcardGenerate({
        supabase: supabase as never,
        user: { id: "user-1" } as never,
        userId: "user-1",
        workspaceId: "ws-1",
        canonicalVersionIds: [VERSION_A],
        learningGoal: "memorize",
        coverage: { sectionKeys: ["sec_099"] },
        amount: "recommended",
      }),
    ).rejects.toThrow(/Coverage section keys/i);
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("freezes exact snapshots and persists via create_learning_output without deleting quiz or cards", async () => {
    const supabase = createMockSupabase({
      versions: [makeVersionRow(VERSION_A)],
      itemCount: 1,
    });

    const result = await runMultiSourceFlashcardGenerate({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      userId: "user-1",
      workspaceId: "ws-1",
      canonicalVersionIds: [VERSION_A],
      learningGoal: "understand",
      coverage: "entire_document",
      amount: "recommended",
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
        p_kind: "flashcards",
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
      id: "c-1",
      front: expect.any(String),
      back: expect.any(String),
    });
    expect(args.p_items[0].prompt).toBeUndefined();
    expect(args.p_items[0].choices).toBeUndefined();
    expect(supabase.rpc.mock.calls.map((c) => c[0])).toEqual([
      "create_learning_output",
    ]);
    expect(supabase.from).not.toHaveBeenCalledWith("approved_questions");
    expect(supabase.from).not.toHaveBeenCalledWith("approved_flashcards");
  });

  it("returns bridge study set id for quota/session/mistake setId consumers", async () => {
    const supabase = createMockSupabase({
      versions: [makeVersionRow(VERSION_A)],
      itemCount: 1,
    });

    const result = await runMultiSourceFlashcardGenerate({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      userId: "user-1",
      workspaceId: "ws-1",
      canonicalVersionIds: [VERSION_A],
      learningGoal: "memorize",
      coverage: "entire_document",
      amount: "recommended",
    });

    expect(result.studySetId).toBe(result.bridgeStudySetId);
    expect(result.cardIds).toEqual(["c-1"]);
    expect(result.detectedFormat).toBe("term_definition");
  });
});
