import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  groupFlashcardSourcesByDocument,
  postFlashcardGenerate,
  postWorkspaceFlashcardGenerate,
  FlashcardQuotaExceededError,
  resolveInitialFlashcardSourceSelection,
  type FlashcardCanonicalSourceOption,
} from "./flashcardGenerateStudySet";

const STUDY_SET_ID = "set-abc-123";
const WORKSPACE_ID = "ws-1";
const VERSION_A = "11111111-1111-4111-8111-111111111111";
const VERSION_B = "22222222-2222-4222-8222-222222222222";

const SAMPLE_BODY = {
  learningGoal: "memorize" as const,
  coverage: "entire_document" as const,
  amount: "recommended" as const,
};

const sources: FlashcardCanonicalSourceOption[] = [
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

describe("postFlashcardGenerate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns typed result on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        recommendedCount: 12,
        generatedCount: 10,
        detectedFormat: "term_definition",
        cardIds: ["fc1", "fc2"],
        bridgeStudySetId: "bridge-1",
        studySetId: "bridge-1",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await postFlashcardGenerate(STUDY_SET_ID, SAMPLE_BODY);

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/study-sets/${STUDY_SET_ID}/flashcards/generate`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SAMPLE_BODY),
      }),
    );
    expect(result.bridgeStudySetId).toBe("bridge-1");
  });

  it("posts canonicalVersionIds only when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cardIds: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await postFlashcardGenerate(STUDY_SET_ID, {
      ...SAMPLE_BODY,
      canonicalVersionIds: [VERSION_A],
    });

    expect(JSON.parse(mockFetch.mock.calls[0]![1].body as string)).toEqual({
      ...SAMPLE_BODY,
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

    await expect(
      postFlashcardGenerate(STUDY_SET_ID, SAMPLE_BODY),
    ).rejects.toThrow("Canonical knowledge is too short.");
  });

  it("maps TypeError to connection lost message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(
      postFlashcardGenerate(STUDY_SET_ID, SAMPLE_BODY),
    ).rejects.toThrow("Connection lost. Check your network and try again.");
  });
});

describe("postWorkspaceFlashcardGenerate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts IDs and wizard options only", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        recommendedCount: 5,
        generatedCount: 4,
        detectedFormat: "term_definition",
        cardIds: ["c1"],
        studySetId: "bridge-1",
        bridgeStudySetId: "bridge-1",
        outputId: "out-1",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await postWorkspaceFlashcardGenerate(WORKSPACE_ID, {
      ...SAMPLE_BODY,
      canonicalVersionIds: [VERSION_A, VERSION_B],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/workspaces/${WORKSPACE_ID}/outputs/flashcards`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(mockFetch.mock.calls[0]![1].body as string)).toEqual({
      canonicalVersionIds: [VERSION_A, VERSION_B],
      ...SAMPLE_BODY,
    });
    expect(result.studySetId).toBe("bridge-1");
  });

  it("rejects empty selection before fetch", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      postWorkspaceFlashcardGenerate(WORKSPACE_ID, {
        ...SAMPLE_BODY,
        canonicalVersionIds: [],
      }),
    ).rejects.toThrow(/at least one/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws FlashcardQuotaExceededError on 402", async () => {
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
          weekResetsAt: "2026-08-02T17:00:00.000Z",
        }),
      }),
    );

    await expect(
      postWorkspaceFlashcardGenerate(WORKSPACE_ID, {
        ...SAMPLE_BODY,
        canonicalVersionIds: [VERSION_A],
      }),
    ).rejects.toBeInstanceOf(FlashcardQuotaExceededError);
  });
});

describe("resolveInitialFlashcardSourceSelection", () => {
  it("preserves prior selection when still available", () => {
    expect(
      resolveInitialFlashcardSourceSelection(sources, [VERSION_A]),
    ).toEqual([VERSION_A]);
  });

  it("defaults to latest completed when no prior selection", () => {
    expect(resolveInitialFlashcardSourceSelection(sources, null)).toEqual([
      VERSION_B,
    ]);
  });

  it("drops stale prior IDs and falls back to latest", () => {
    expect(
      resolveInitialFlashcardSourceSelection(sources, [
        "99999999-9999-4999-8999-999999999999",
      ]),
    ).toEqual([VERSION_B]);
  });
});

describe("groupFlashcardSourcesByDocument", () => {
  it("groups versions under each document", () => {
    const groups = groupFlashcardSourcesByDocument(sources);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.documentTitle).toBe("Biology");
    expect(groups[0]?.versions.map((v) => v.versionNumber)).toEqual([2, 1]);
  });
});
