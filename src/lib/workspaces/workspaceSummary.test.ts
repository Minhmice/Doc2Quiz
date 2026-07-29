import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertNoMarkdownSelection,
  getWorkspaceDetail,
  listWorkspaceSummaries,
} from "@/lib/workspaces/workspaceSummary";
import {
  WorkspaceNotFoundError,
  WorkspaceValidationError,
} from "@/lib/workspaces/errors";

type QueryResult = { data: unknown; error: unknown };

type TableState = {
  results: QueryResult[];
  selects: string[];
};

function createMockSupabase(tables: Record<string, TableState>) {
  const from = vi.fn((table: string) => {
    const state = tables[table];
    if (!state) {
      throw new Error(`Unexpected table ${table}`);
    }

    const builder: Record<string, unknown> = {};
    const result = () => state.results.shift() ?? { data: null, error: null };

    const thenable = {
      then: (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(result()).then(resolve, reject),
    };

    builder.select = vi.fn((clause: string) => {
      state.selects.push(clause);
      return builder;
    });
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.is = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => result());
    Object.assign(builder, thenable);

    return builder;
  });

  return { from };
}

describe("assertNoMarkdownSelection", () => {
  it("rejects canonical/raw/body markdown fragments", () => {
    expect(() =>
      assertNoMarkdownSelection("id, canonical_markdown, status"),
    ).toThrow(WorkspaceValidationError);
    expect(() => assertNoMarkdownSelection("raw_markdown")).toThrow(
      WorkspaceValidationError,
    );
    expect(() => assertNoMarkdownSelection("body_markdown")).toThrow(
      WorkspaceValidationError,
    );
  });

  it("allows metadata-only selections", () => {
    expect(() =>
      assertNoMarkdownSelection(
        "id, title, status, model, prompt_version, provenance",
      ),
    ).not.toThrow();
  });
});

describe("listWorkspaceSummaries", () => {
  let tables: Record<string, TableState>;
  let supabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    tables = {
      workspace_members: {
        selects: [],
        results: [
          {
            data: [
              {
                role: "owner",
                workspace_id: "ws-1",
                workspaces: {
                  id: "ws-1",
                  title: "Biology",
                  subtitle: "Exam prep",
                  created_at: "2026-07-01T00:00:00Z",
                  updated_at: "2026-07-30T00:00:00Z",
                  deleted_at: null,
                },
              },
              {
                role: "viewer",
                workspace_id: "ws-2",
                workspaces: {
                  id: "ws-2",
                  title: "Chemistry",
                  subtitle: null,
                  created_at: "2026-07-02T00:00:00Z",
                  updated_at: "2026-07-29T00:00:00Z",
                  deleted_at: null,
                },
              },
            ],
            error: null,
          },
        ],
      },
      documents: {
        selects: [],
        results: [
          {
            data: [
              { id: "doc-1", workspace_id: "ws-1" },
              { id: "doc-2", workspace_id: "ws-1" },
            ],
            error: null,
          },
        ],
      },
      document_versions: {
        selects: [],
        results: [
          {
            data: [
              { id: "ver-1", document_id: "doc-1" },
              { id: "ver-2", document_id: "doc-2" },
            ],
            error: null,
          },
        ],
      },
      canonical_versions: {
        selects: [],
        results: [
          {
            data: [
              {
                id: "cv-1",
                document_version_id: "ver-1",
                status: "completed",
              },
              {
                id: "cv-2",
                document_version_id: "ver-1",
                status: "completed",
              },
            ],
            error: null,
          },
        ],
      },
      learning_outputs: {
        selects: [],
        results: [
          {
            data: [
              {
                id: "out-1",
                workspace_id: "ws-1",
                kind: "quiz",
                title: "Quiz A",
                status: "ready",
                updated_at: "2026-07-30T12:00:00Z",
                created_at: "2026-07-30T10:00:00Z",
                legacy_study_set_id: "bridge-1",
              },
              {
                id: "out-2",
                workspace_id: "ws-1",
                kind: "flashcards",
                title: "Cards B",
                status: "ready",
                updated_at: "2026-07-29T12:00:00Z",
                created_at: "2026-07-29T10:00:00Z",
                legacy_study_set_id: "bridge-2",
              },
              {
                id: "out-3",
                workspace_id: "ws-2",
                kind: "quiz",
                title: "Orphan quiz",
                status: "ready",
                updated_at: "2026-07-28T12:00:00Z",
                created_at: "2026-07-28T10:00:00Z",
                legacy_study_set_id: "bridge-3",
              },
            ],
            error: null,
          },
        ],
      },
    };
    supabase = createMockSupabase(tables);
  });

  it("returns only membership workspaces with role and aggregate counts", async () => {
    const summaries = await listWorkspaceSummaries({
      supabase: supabase as never,
      userId: "user-1",
    });

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      id: "ws-1",
      title: "Biology",
      role: "owner",
      documentCount: 2,
      canonicalVersionCount: 2,
      quizOutputCount: 1,
      flashcardOutputCount: 1,
    });
    expect(summaries[0]!.recentOutputs[0]).toEqual({
      id: "out-1",
      kind: "quiz",
      title: "Quiz A",
      status: "ready",
      updatedAt: "2026-07-30T12:00:00Z",
      createdAt: "2026-07-30T10:00:00Z",
      bridgeStudySetId: "bridge-1",
    });
    expect(summaries[1]).toMatchObject({
      id: "ws-2",
      role: "viewer",
      documentCount: 0,
      canonicalVersionCount: 0,
      quizOutputCount: 1,
      flashcardOutputCount: 0,
    });
  });

  it("excludes soft-deleted sources from counts while preserving outputs", async () => {
    // Active documents query already filters deleted_at; simulate a workspace
    // whose documents were soft-deleted (zero docs) but still has outputs.
    tables.documents.results = [{ data: [], error: null }];
    tables.document_versions.results = [{ data: [], error: null }];
    tables.canonical_versions.results = [{ data: [], error: null }];
    tables.learning_outputs.results = [
      {
        data: [
          {
            id: "out-keep",
            workspace_id: "ws-1",
            kind: "quiz",
            title: "Kept after source delete",
            status: "ready",
            updated_at: "2026-07-30T12:00:00Z",
            created_at: "2026-07-30T10:00:00Z",
            legacy_study_set_id: "bridge-keep",
          },
        ],
        error: null,
      },
    ];
    tables.workspace_members.results = [
      {
        data: [
          {
            role: "editor",
            workspace_id: "ws-1",
            workspaces: {
              id: "ws-1",
              title: "Biology",
              subtitle: null,
              created_at: "2026-07-01T00:00:00Z",
              updated_at: "2026-07-30T00:00:00Z",
              deleted_at: null,
            },
          },
        ],
        error: null,
      },
    ];

    const summaries = await listWorkspaceSummaries({
      supabase: supabase as never,
      userId: "user-1",
    });

    expect(summaries).toEqual([
      expect.objectContaining({
        id: "ws-1",
        role: "editor",
        documentCount: 0,
        canonicalVersionCount: 0,
        quizOutputCount: 1,
        flashcardOutputCount: 0,
        recentOutputs: [
          expect.objectContaining({
            id: "out-keep",
            bridgeStudySetId: "bridge-keep",
          }),
        ],
      }),
    ]);
  });

  it("never selects markdown body columns", async () => {
    await listWorkspaceSummaries({
      supabase: supabase as never,
      userId: "user-1",
    });

    const allSelects = Object.values(tables).flatMap((table) => table.selects);
    expect(allSelects.length).toBeGreaterThan(0);
    for (const clause of allSelects) {
      expect(() => assertNoMarkdownSelection(clause)).not.toThrow();
    }
  });

  it("returns empty list when user has no memberships", async () => {
    tables.workspace_members.results = [{ data: [], error: null }];
    const summaries = await listWorkspaceSummaries({
      supabase: supabase as never,
      userId: "user-none",
    });
    expect(summaries).toEqual([]);
    expect(tables.documents.selects).toHaveLength(0);
  });
});

describe("getWorkspaceDetail", () => {
  let tables: Record<string, TableState>;
  let supabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    tables = {
      workspace_members: {
        selects: [],
        results: [{ data: { role: "owner" }, error: null }],
      },
      workspaces: {
        selects: [],
        results: [
          {
            data: {
              id: "ws-1",
              title: "Biology",
              subtitle: "Exam prep",
              created_at: "2026-07-01T00:00:00Z",
              updated_at: "2026-07-30T00:00:00Z",
              deleted_at: null,
            },
            error: null,
          },
        ],
      },
      documents: {
        selects: [],
        results: [
          {
            data: [
              {
                id: "doc-1",
                title: "Chapter 1",
                description: null,
                updated_at: "2026-07-30T00:00:00Z",
              },
            ],
            error: null,
          },
        ],
      },
      document_versions: {
        selects: [],
        results: [
          {
            data: [
              {
                id: "ver-1",
                document_id: "doc-1",
                version_number: 1,
                source_kind: "upload",
                original_filename: "ch1.pdf",
                created_at: "2026-07-29T00:00:00Z",
              },
            ],
            error: null,
          },
        ],
      },
      canonical_versions: {
        selects: [],
        results: [
          {
            data: [
              {
                id: "cv-1",
                document_version_id: "ver-1",
                version_number: 1,
                status: "completed",
                model: "test-model",
                prompt_version: "1.0",
                parser_version: "1.0",
                created_at: "2026-07-29T01:00:00Z",
                provenance: { mode: "ai", api_key: "secret" },
              },
            ],
            error: null,
          },
        ],
      },
      learning_outputs: {
        selects: [],
        results: [
          {
            data: [
              {
                id: "out-1",
                workspace_id: "ws-1",
                kind: "quiz",
                title: "Quiz A",
                status: "ready",
                updated_at: "2026-07-30T12:00:00Z",
                created_at: "2026-07-30T10:00:00Z",
                legacy_study_set_id: "bridge-1",
              },
            ],
            error: null,
          },
        ],
      },
    };
    supabase = createMockSupabase(tables);
  });

  it("returns document/version/output navigation DTO without markdown bodies", async () => {
    const detail = await getWorkspaceDetail({
      supabase: supabase as never,
      userId: "user-1",
      workspaceId: "ws-1",
    });

    expect(detail).toMatchObject({
      id: "ws-1",
      title: "Biology",
      role: "owner",
      documents: [
        {
          id: "doc-1",
          title: "Chapter 1",
          versions: [
            {
              id: "ver-1",
              versionNumber: 1,
              originalFilename: "ch1.pdf",
              canonicalVersions: [
                {
                  id: "cv-1",
                  status: "completed",
                  versionNumber: 1,
                  provenanceLabel: expect.stringContaining("ai"),
                },
              ],
            },
          ],
        },
      ],
      outputs: [
        {
          id: "out-1",
          bridgeStudySetId: "bridge-1",
          kind: "quiz",
        },
      ],
    });

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toMatch(/canonical_markdown|raw_markdown|body_markdown|api_key/);

    const allSelects = Object.values(tables).flatMap((table) => table.selects);
    for (const clause of allSelects) {
      expect(() => assertNoMarkdownSelection(clause)).not.toThrow();
    }
  });

  it("omits soft-deleted documents from active navigation while keeping outputs", async () => {
    tables.documents.results = [{ data: [], error: null }];
    tables.document_versions.results = [{ data: [], error: null }];
    tables.canonical_versions.results = [{ data: [], error: null }];

    const detail = await getWorkspaceDetail({
      supabase: supabase as never,
      userId: "user-1",
      workspaceId: "ws-1",
    });

    expect(detail.documents).toEqual([]);
    expect(detail.outputs).toHaveLength(1);
    expect(detail.outputs[0]?.bridgeStudySetId).toBe("bridge-1");
  });

  it("throws not found when membership is missing", async () => {
    tables.workspace_members.results = [{ data: null, error: null }];

    await expect(
      getWorkspaceDetail({
        supabase: supabase as never,
        userId: "user-1",
        workspaceId: "ws-missing",
      }),
    ).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });
});
