import { describe, expect, it, vi } from "vitest";

import {
  SocialUnavailableError,
  acceptStudyChallenge,
  completeStudyAttempt,
  createStudyChallenge,
  decodeNotification,
  decodePractice,
  mapStudyTogetherRouteError,
  startStudyChallengeAttempt,
} from "./studyTogether";

const UUID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function rpc(data: unknown, error: { message: string } | null = null) {
  return { rpc: vi.fn().mockResolvedValue({ data, error }) };
}

describe("study together RPC adapter", () => {
  it("decodes create and creator start/reopen results", async () => {
    const created = rpc({ sessionId: UUID, status: "pending", recipientId: OTHER });
    await expect(createStudyChallenge(created, { recipientId: OTHER, outputId: UUID, mode: "score", deadlineAt: null, message: null, revealPolicy: "after_both_complete" })).resolves.toEqual({ sessionId: UUID, status: "pending", recipientId: OTHER });

    const started = rpc({ sessionId: UUID, attemptId: OTHER, status: "in_progress", resumed: true });
    await expect(startStudyChallengeAttempt(started, UUID)).resolves.toEqual({ sessionId: UUID, attemptId: OTHER, status: "in_progress", resumed: true });
  });

  it("decodes idempotent accept and completion", async () => {
    const accepted = rpc({ sessionId: UUID, attemptId: OTHER, status: "in_progress", resumed: false });
    await expect(acceptStudyChallenge(accepted, UUID)).resolves.toMatchObject({ attemptId: OTHER });
    const completed = rpc({ attemptId: OTHER, status: "completed", score: 1, questionCount: 2, accuracy: 50, durationSeconds: 12, resultsVisible: false });
    await expect(completeStudyAttempt(completed, OTHER, [0, 2], 12)).resolves.toMatchObject({ score: 1, accuracy: 50, resultsVisible: false });
  });

  it("rejects malformed safe DTOs", () => {
    expect(() => decodePractice({ sessionId: UUID, questions: [{ id: "q1", prompt: "p", choices: ["a"] }] })).toThrow(SocialUnavailableError);
    expect(() => decodeNotification({ id: UUID, type: "unknown" })).toThrow(SocialUnavailableError);
  });

  it.each(["social_unavailable", "challenge_unavailable", "attempt_unavailable", "source_unavailable", "authentication_required"])("maps %s without leaking state", async (token) => {
    const client = rpc(null, { message: `database error: ${token}` });
    await expect(acceptStudyChallenge(client, UUID)).rejects.toBeInstanceOf(SocialUnavailableError);
    expect(mapStudyTogetherRouteError(new SocialUnavailableError())).toEqual({ status: 404, body: { error: "social_unavailable" } });
  });

  it("uses presence vocabulary", async () => {
    const mod = await import("./studyTogether");
    expect(mod.PRESENCE_STATUSES).toEqual(["online", "recently_active", "offline"]);
  });
});
