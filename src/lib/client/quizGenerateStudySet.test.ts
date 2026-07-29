import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  groupQuizSourcesByDocument,
  postQuizGenerate,
  postWorkspaceQuizGenerate,
  QuizQuotaExceededError,
  resolveInitialQuizSourceSelection,
  type QuizCanonicalSourceOption,
} from "./quizGenerateStudySet";

const STUDY_SET_ID = "set-abc-123";
const WORKSPACE_ID = "ws-1";
const VERSION_A = "11111111-1111-4111-8111-111111111111";
const VERSION_B = "22222222-2222-4222-8222-222222222222";

const sources: QuizCanonicalSourceOption[] = [
  {
    canonicalVersionId: VERSION_A,
    documentId: "doc-1",
    documentTitle: "Biology",
    versionNumber: 1,
    provenanceLabel: "heuristic",
    createdAt: "2026-07-01T10:00:00.000Z",
  },
  {
    canonicalVersionId: VERSION_B,
    documentId: "doc-1",
    documentTitle: "Biology",
    versionNumber: 2,
    provenanceLabel: "gpt-test · prompt 1.0",
    createdAt: "2026-07-30T10:00:00.000Z",
  },
  {
    canonicalVersionId: "33333333-3333-4333-8333-333333333333",
    documentId: "doc-2",
    documentTitle: "History",
    versionNumber: 1,
    provenanceLabel: "heuristic",
    createdAt: "2026-07-15T10:00:00.000Z",
  },
];

describe("postQuizGenerate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns typed result on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        recommendedCount: 10,
        generatedCount: 8,
        questionIds: ["q1", "q2"],
        bridgeStudySetId: "bridge-1",
        studySetId: "bridge-1",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await postQuizGenerate(STUDY_SET_ID);

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/study-sets/${STUDY_SET_ID}/quiz/generate`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.bridgeStudySetId).toBe("bridge-1");
  });

  it("posts canonicalVersionIds only when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ questionIds: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await postQuizGenerate(STUDY_SET_ID, {
      canonicalVersionIds: [VERSION_A],
      questionCount: 4,
    });

    expect(JSON.parse(mockFetch.mock.calls[0]![1].body as string)).toEqual({
      questionCount: 4,
      canonicalVersionIds: [VERSION_A],
    });
  });

  it("throws API message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: "validation_error",
          message: "Canonical knowledge is too short.",
        }),
      }),
    );

    await expect(postQuizGenerate(STUDY_SET_ID)).rejects.toThrow(
      "Canonical knowledge is too short.",
    );
  });

  it("maps TypeError to connection lost message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(postQuizGenerate(STUDY_SET_ID)).rejects.toThrow(
      "Connection lost. Check your network and try again.",
    );
  });
});

describe("postWorkspaceQuizGenerate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts IDs only to the workspace quiz route", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedCount: 2,
        studySetId: "bridge-1",
        bridgeStudySetId: "bridge-1",
        outputId: "out-1",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await postWorkspaceQuizGenerate(WORKSPACE_ID, {
      canonicalVersionIds: [VERSION_A, VERSION_B],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/workspaces/${WORKSPACE_ID}/outputs/quiz`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(mockFetch.mock.calls[0]![1].body as string)).toEqual({
      canonicalVersionIds: [VERSION_A, VERSION_B],
    });
    expect(result.studySetId).toBe("bridge-1");
  });

  it("rejects empty selection before fetch", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      postWorkspaceQuizGenerate(WORKSPACE_ID, { canonicalVersionIds: [] }),
    ).rejects.toThrow(/at least one/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws QuizQuotaExceededError on 402", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({
          error: "quota_exceeded",
          weeklyUsed: 10,
          weeklyLimit: 10,
          bonusCredits: 0,
          weekResetsAt: "2026-08-03T17:00:00.000Z",
        }),
      }),
    );

    await expect(
      postWorkspaceQuizGenerate(WORKSPACE_ID, {
        canonicalVersionIds: [VERSION_A],
      }),
    ).rejects.toBeInstanceOf(QuizQuotaExceededError);
  });
});

describe("resolveInitialQuizSourceSelection", () => {
  it("preserves prior selection when still available", () => {
    expect(
      resolveInitialQuizSourceSelection(sources, [VERSION_A]),
    ).toEqual([VERSION_A]);
  });

  it("preselects latest completed when no prior selection exists", () => {
    expect(resolveInitialQuizSourceSelection(sources, null)).toEqual([
      VERSION_B,
    ]);
  });

  it("falls back to latest when prior IDs are all gone", () => {
    expect(
      resolveInitialQuizSourceSelection(sources, ["missing-id"]),
    ).toEqual([VERSION_B]);
  });
});

describe("groupQuizSourcesByDocument", () => {
  it("groups versions under documents", () => {
    const groups = groupQuizSourcesByDocument(sources);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.documentTitle).toBe("Biology");
    expect(groups[0]?.versions.map((v) => v.versionNumber)).toEqual([2, 1]);
  });
});
