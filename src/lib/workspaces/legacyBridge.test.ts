import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeLegacyBridgeRouteKind,
  resolveLegacyStudySetBridge,
  type LegacyBridgeResolution,
  type LegacyBridgeRouteKind,
} from "@/lib/workspaces/legacyBridge";

type OutputRow = {
  id: string;
  workspace_id: string;
  legacy_study_set_id: string;
  legacy_parent_study_set_id: string | null;
  kind: "quiz" | "flashcards";
};

function createMembershipClient(options: {
  member?: boolean;
  role?: "owner" | "editor" | "viewer";
  bridgeOutput?: OutputRow | null;
  parentOutputs?: OutputRow[];
}) {
  const member = options.member ?? true;
  const role = options.role ?? "owner";
  const bridgeOutput = options.bridgeOutput ?? null;
  const parentOutputs = options.parentOutputs ?? [];

  const from = vi.fn((table: string) => {
    if (table === "learning_outputs") {
      return {
        select: vi.fn(() => {
          const state: {
            eqs: Array<{ col: string; val: unknown }>;
            isCol?: string;
          } = { eqs: [] };

          const chain = {
            eq: vi.fn((col: string, val: unknown) => {
              state.eqs.push({ col, val });
              return chain;
            }),
            is: vi.fn((col: string) => {
              state.isCol = col;
              return chain;
            }),
            maybeSingle: vi.fn(async () => {
              const bridgeEq = state.eqs.find(
                (e) => e.col === "legacy_study_set_id",
              );
              if (bridgeEq) {
                if (
                  bridgeOutput &&
                  bridgeOutput.legacy_study_set_id === bridgeEq.val
                ) {
                  return { data: bridgeOutput, error: null };
                }
                return { data: null, error: null };
              }

              const parentEq = state.eqs.find(
                (e) => e.col === "legacy_parent_study_set_id",
              );
              const kindEq = state.eqs.find((e) => e.col === "kind");
              if (parentEq) {
                const match = parentOutputs.find((row) => {
                  if (row.legacy_parent_study_set_id !== parentEq.val) {
                    return false;
                  }
                  if (kindEq && row.kind !== kindEq.val) {
                    return false;
                  }
                  return true;
                });
                return { data: match ?? null, error: null };
              }

              return { data: null, error: null };
            }),
            limit: vi.fn(() => chain),
          };
          return chain;
        }),
      };
    }

    if (table === "workspace_members") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: member ? { role } : null,
                error: null,
              })),
            })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return { from };
}

describe("normalizeLegacyBridgeRouteKind", () => {
  it("normalizes flashcard singular to flashcards", () => {
    expect(normalizeLegacyBridgeRouteKind("flashcard")).toBe("flashcards");
    expect(normalizeLegacyBridgeRouteKind("flashcards")).toBe("flashcards");
    expect(normalizeLegacyBridgeRouteKind("quiz")).toBe("quiz");
  });

  it("keeps workspace lifecycle route kinds", () => {
    const kinds: LegacyBridgeRouteKind[] = [
      "canonical",
      "ingest",
      "canonicalize",
      "metadata",
    ];
    for (const kind of kinds) {
      expect(normalizeLegacyBridgeRouteKind(kind)).toBe(kind);
    }
  });
});

describe("resolveLegacyStudySetBridge", () => {
  const parentId = "parent-set";
  const quizBridgeId = "quiz-bridge";
  const flashBridgeId = "flash-bridge";
  const workspaceId = "ws-1";

  const quizChild: OutputRow = {
    id: "out-quiz",
    workspace_id: workspaceId,
    legacy_study_set_id: quizBridgeId,
    legacy_parent_study_set_id: parentId,
    kind: "quiz",
  };

  const flashChild: OutputRow = {
    id: "out-flash",
    workspace_id: workspaceId,
    legacy_study_set_id: flashBridgeId,
    legacy_parent_study_set_id: parentId,
    kind: "flashcards",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves bridge ID to its own output with bridge-keyed history and no parent fallback", async () => {
    const supabase = createMembershipClient({
      bridgeOutput: quizChild,
      parentOutputs: [quizChild, flashChild],
    });

    const result = await resolveLegacyStudySetBridge({
      supabase: supabase as never,
      studySetId: quizBridgeId,
      routeKind: "quiz",
      userId: "user-1",
    });

    expect(result).toEqual<LegacyBridgeResolution>({
      outputId: "out-quiz",
      workspaceId,
      bridgeStudySetId: quizBridgeId,
      legacyParentStudySetId: parentId,
      kind: "quiz",
      resolutionMode: "bridge",
      historyStudySetId: quizBridgeId,
    });
    expect(result?.historyStudySetId).not.toBe(parentId);
  });

  it("parent + quiz selects only quiz child and exposes parent-keyed history", async () => {
    const supabase = createMembershipClient({
      bridgeOutput: null,
      parentOutputs: [quizChild, flashChild],
    });

    const result = await resolveLegacyStudySetBridge({
      supabase: supabase as never,
      studySetId: parentId,
      routeKind: "quiz",
      userId: "user-1",
    });

    expect(result).toEqual({
      outputId: "out-quiz",
      workspaceId,
      bridgeStudySetId: quizBridgeId,
      legacyParentStudySetId: parentId,
      kind: "quiz",
      resolutionMode: "parent",
      historyStudySetId: parentId,
    });
  });

  it("parent + flashcards selects only flashcards child", async () => {
    const supabase = createMembershipClient({
      bridgeOutput: null,
      parentOutputs: [quizChild, flashChild],
    });

    const result = await resolveLegacyStudySetBridge({
      supabase: supabase as never,
      studySetId: parentId,
      routeKind: "flashcards",
      userId: "user-1",
    });

    expect(result?.kind).toBe("flashcards");
    expect(result?.bridgeStudySetId).toBe(flashBridgeId);
    expect(result?.historyStudySetId).toBe(parentId);
    expect(result?.resolutionMode).toBe("parent");
  });

  it("parent + quiz does not return flashcards child (cross-kind reject)", async () => {
    const supabase = createMembershipClient({
      bridgeOutput: null,
      parentOutputs: [flashChild],
    });

    const result = await resolveLegacyStudySetBridge({
      supabase: supabase as never,
      studySetId: parentId,
      routeKind: "quiz",
      userId: "user-1",
    });

    expect(result).toBeNull();
  });

  it("returns null for inaccessible workspace membership", async () => {
    const supabase = createMembershipClient({
      member: false,
      bridgeOutput: quizChild,
    });

    const result = await resolveLegacyStudySetBridge({
      supabase: supabase as never,
      studySetId: quizBridgeId,
      routeKind: "quiz",
      userId: "outsider",
    });

    expect(result).toBeNull();
  });

  it("returns null for unknown study set ids", async () => {
    const supabase = createMembershipClient({
      bridgeOutput: null,
      parentOutputs: [],
    });

    const result = await resolveLegacyStudySetBridge({
      supabase: supabase as never,
      studySetId: "missing",
      routeKind: "quiz",
      userId: "user-1",
    });

    expect(result).toBeNull();
  });

  it("canonical route kind resolves bridge without parent history fallback", async () => {
    const supabase = createMembershipClient({
      bridgeOutput: quizChild,
      parentOutputs: [quizChild, flashChild],
    });

    const result = await resolveLegacyStudySetBridge({
      supabase: supabase as never,
      studySetId: quizBridgeId,
      routeKind: "canonical",
      userId: "user-1",
    });

    expect(result?.resolutionMode).toBe("bridge");
    expect(result?.historyStudySetId).toBe(quizBridgeId);
  });

  it("does not invent duplicate history ids for parent resolution", async () => {
    const supabase = createMembershipClient({
      bridgeOutput: null,
      parentOutputs: [quizChild],
    });

    const result = await resolveLegacyStudySetBridge({
      supabase: supabase as never,
      studySetId: parentId,
      routeKind: "quiz",
      userId: "user-1",
    });

    expect(result?.legacyParentStudySetId).toBe(parentId);
    expect(result?.historyStudySetId).toBe(parentId);
    expect(result?.bridgeStudySetId).not.toBe(parentId);
  });
});
