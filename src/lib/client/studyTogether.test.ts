import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptStudyChallenge,
  archiveChallengeInvite,
  completeStudyChallengeAttempt,
  createStudyChallenge,
  markAllChallengeNotificationsRead,
  markChallengeNotificationRead,
  startOrResumeCreatorAttempt,
} from "./studyTogether";

const ID = "11111111-1111-4111-8111-111111111111";
const ATTEMPT = "22222222-2222-4222-8222-222222222222";

afterEach(() => vi.unstubAllGlobals());

function response(data: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => (ok ? { data } : { error: "source_unavailable" }), headers: new Headers() } as Response;
}

describe("study together HTTP client", () => {
  it("creates only through bounded owned output contract and hides server details", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ sessionId: ID, status: "pending", recipientId: ID })).mockResolvedValueOnce(response(null, false, 404));
    vi.stubGlobal("fetch", fetch);
    await createStudyChallenge({ recipientId: ID, outputId: ID, mode: "score", deadlineAt: null, message: null, revealPolicy: "after_both_complete" });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ recipientId: ID, outputId: ID, mode: "score", deadlineAt: null, message: null, revealPolicy: "after_both_complete" });
    await expect(createStudyChallenge({ recipientId: ID, outputId: ID, mode: "score", deadlineAt: null, message: null, revealPolicy: "after_both_complete" })).rejects.toThrow("Challenge is unavailable.");
  });

  it("preserves server attempt identity for accept and creator reopen", async () => {
    const data = { attemptId: ATTEMPT, playHref: `/friends/study/${ID}/play?attemptId=${ATTEMPT}` };
    const fetch = vi.fn().mockResolvedValue(response(data));
    vi.stubGlobal("fetch", fetch);
    expect(await acceptStudyChallenge(ID)).toEqual(data);
    expect(await acceptStudyChallenge(ID)).toEqual(data);
    expect(await startOrResumeCreatorAttempt(ID)).toEqual(data);
    expect(await startOrResumeCreatorAttempt(ID)).toEqual(data);
  });

  it("sends explicit notification mutations", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    await markChallengeNotificationRead(ID);
    await markAllChallengeNotificationsRead();
    await archiveChallengeInvite(ID);
    expect(fetch.mock.calls.map((call) => JSON.parse(call[1].body))).toEqual([
      { notificationId: ID }, { action: "mark_all_read" }, { action: "archive_invite", sessionId: ID },
    ]);
  });

  it("completion sends selected indices and duration only", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ attemptId: ATTEMPT, status: "completed", score: 1, questionCount: 1, accuracy: 1, durationSeconds: 3, resultsVisible: true }));
    vi.stubGlobal("fetch", fetch);
    await completeStudyChallengeAttempt(ID, ATTEMPT, [2], 3);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ selectedIndices: [2], durationSeconds: 3 });
  });
});
