import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUserMock = vi.fn();
vi.mock("@/lib/api/requireApiUser", () => ({ requireApiUser: () => requireApiUserMock() }));
import { GET } from "./route";

const userId = "00000000-0000-4000-8000-000000000001";
function client(data: unknown, error: { message: string } | null = null) {
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn() };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.is.mockReturnValue(query); query.order.mockResolvedValue({ data, error });
  return { from: vi.fn().mockReturnValue(query), query };
}

describe("GET /api/friends/study-challenges/sources", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns owned ready quizzes with positive counts only", async () => {
    const api = client([
      { id: "quiz-1", title: "Ready", kind: "quiz", status: "ready", deleted_at: null, created_by: userId, approved_questions: [{ count: 3 }] },
      { id: "quiz-2", title: "Empty", kind: "quiz", status: "ready", deleted_at: null, created_by: userId, approved_questions: [{ count: 0 }] },
      { id: "quiz-3", title: "Other", kind: "quiz", status: "ready", deleted_at: null, created_by: "other", approved_questions: [{ count: 3 }] },
    ]);
    requireApiUserMock.mockResolvedValue({ supabase: api, user: { id: userId } });
    const response = (await GET()) as Response;
    await expect(response.json()).resolves.toEqual({ data: [{ outputId: "quiz-1", title: "Ready", questionCount: 3, status: "ready" }] });
    expect(api.query.select).toHaveBeenCalledWith("id, title, kind, status, deleted_at, created_by, approved_questions(count)");
  });
  it("returns auth response unchanged and hides query errors", async () => {
    const authResponse = Response.json({ error: "unauthorized" }, { status: 401 });
    requireApiUserMock.mockResolvedValueOnce({ error: authResponse });
    expect(await GET()).toBe(authResponse);
    requireApiUserMock.mockResolvedValueOnce({ supabase: client(null, { message: "database details" }), user: { id: userId } });
    const response = (await GET()) as Response;
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "social_unavailable" });
  });
});
