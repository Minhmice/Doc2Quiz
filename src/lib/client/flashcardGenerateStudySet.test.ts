import { beforeEach, describe, expect, it, vi } from "vitest";

import { postFlashcardGenerate } from "./flashcardGenerateStudySet";

const STUDY_SET_ID = "set-abc-123";

const SAMPLE_BODY = {
  learningGoal: "memorize" as const,
  coverage: "entire_document" as const,
  amount: "recommended" as const,
};

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
    expect(result).toEqual({
      recommendedCount: 12,
      generatedCount: 10,
      detectedFormat: "term_definition",
      cardIds: ["fc1", "fc2"],
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
