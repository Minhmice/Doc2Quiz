import { describe, expect, it, vi } from "vitest";
import { listEligibleChallengeQuizzes } from "./studyTogether";

describe("eligible challenge quiz client", () => {
  it("keeps only ready metadata rows with positive counts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [
      { outputId: "quiz-1", title: "Ready", questionCount: 2, status: "ready" },
      { outputId: "quiz-2", title: "Empty", questionCount: 0, status: "ready" },
      { outputId: "quiz-3", title: "Pending", questionCount: 2, status: "pending" },
    ] }), { status: 200 }));
    await expect(listEligibleChallengeQuizzes()).resolves.toEqual([{ outputId: "quiz-1", title: "Ready", questionCount: 2, status: "ready" }]);
  });
  it("keeps empty and error handling explicit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await expect(listEligibleChallengeQuizzes()).resolves.toEqual([]);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ error: "social_unavailable" }), { status: 404 }));
    await expect(listEligibleChallengeQuizzes()).rejects.toThrow("Challenge is unavailable.");
  });
});
