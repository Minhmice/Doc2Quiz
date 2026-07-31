// @ts-nocheck -- route handlers intentionally expose NextResponse | undefined through mocked auth unions.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const auth = vi.fn();
const create = vi.fn();
const start = vi.fn();
const accept = vi.fn();
const practice = vi.fn();
const complete = vi.fn();
const list = vi.fn();
const detail = vi.fn();
const decline = vi.fn();
const save = vi.fn();
vi.mock("@/lib/api/requireApiUser", () => ({ requireApiUser: () => auth() }));
vi.mock("@/lib/server/friends/studyTogether", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/server/friends/studyTogether")>()), createStudyChallenge: (...a: unknown[]) => create(...a), startStudyChallengeAttempt: (...a: unknown[]) => start(...a), acceptStudyChallenge: (...a: unknown[]) => accept(...a), getStudyAttemptPractice: (...a: unknown[]) => practice(...a), completeStudyAttempt: (...a: unknown[]) => complete(...a), listStudyChallenges: (...a: unknown[]) => list(...a), getStudyChallenge: (...a: unknown[]) => detail(...a), declineStudyChallenge: (...a: unknown[]) => decline(...a), saveStudyAttemptProgress: (...a: unknown[]) => save(...a) }));

import { GET, POST } from "./route";
import { POST as startPost } from "./[sessionId]/start/route";
import { GET as attemptGet, PATCH as attemptPatch, POST as attemptPost } from "./[sessionId]/attempt/route";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const req = (url: string, method = "GET", body?: unknown) => new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ supabase: {}, user: { id: ID } }); });
describe("study challenge routes", () => {
  it("authenticates before parsing", async () => { auth.mockResolvedValue({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }); expect((await POST(req("http://x/api/friends/study-challenges", "POST", { bad: true }))).status).toBe(401); expect(create).not.toHaveBeenCalled(); });
  it("validates create and applies defaults", async () => { create.mockResolvedValue({ sessionId: ID, status: "pending", recipientId: OTHER }); const response = await POST(req("http://x/api/friends/study-challenges", "POST", { recipientId: OTHER, outputId: ID })); expect(response.status).toBe(200); expect(create).toHaveBeenCalledWith({}, { recipientId: OTHER, outputId: ID, mode: "score", deadlineAt: null, message: null, revealPolicy: "after_both_complete" }); });
  it("rejects invalid pagination", async () => { expect((await GET(req("http://x/api/friends/study-challenges?limit=101"))).status).toBe(400); });
  it("returns stable creator play identity", async () => { start.mockResolvedValue({ attemptId: OTHER }); const ctx = { params: Promise.resolve({ sessionId: ID }) }; expect(await (await startPost(req("http://x", "POST"), ctx)).json()).toEqual({ data: { attemptId: OTHER, playHref: `/friends/study/${ID}/play?attemptId=${OTHER}` } }); });
  it("withholds keys and never accepts client score", async () => { practice.mockResolvedValue({ sessionId: ID, attemptId: OTHER, title: "Quiz", mode: "score", questions: [{ id: "1", prompt: "P", choices: ["A", "B", "C", "D"] }], selectedIndices: [null] }); const ctx = { params: Promise.resolve({ sessionId: ID }) }; const body = await (await attemptGet(req(`http://x?attemptId=${OTHER}`), ctx)).json(); expect(JSON.stringify(body)).not.toContain("correctIndex"); complete.mockResolvedValue({ score: 1 }); await attemptPost(req(`http://x?attemptId=${OTHER}`, "POST", { selectedIndices: [0], durationSeconds: 2, score: 99 }), ctx); expect(complete).toHaveBeenCalledWith({}, OTHER, [0], 2); });
  it("saves bounded progress", async () => { save.mockResolvedValue({ ok: true }); const ctx = { params: Promise.resolve({ sessionId: ID }) }; expect((await attemptPatch(req(`http://x?attemptId=${OTHER}`, "PATCH", { selectedIndices: [0, null], currentQuestionIndex: 1 }), ctx)).status).toBe(200); });
});
