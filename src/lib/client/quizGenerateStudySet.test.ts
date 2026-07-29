import { beforeEach, describe, expect, it, vi } from "vitest";

import { postQuizGenerate } from "./quizGenerateStudySet";

const STUDY_SET_ID = "set-abc-123";

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
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await postQuizGenerate(STUDY_SET_ID);

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/study-sets/${STUDY_SET_ID}/quiz/generate`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({
      recommendedCount: 10,
      generatedCount: 8,
      questionIds: ["q1", "q2"],
    });
  });

  it("throws API message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
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
