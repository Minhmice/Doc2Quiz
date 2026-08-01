import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUserMock = vi.fn();
vi.mock("@/lib/api/requireApiUser", () => ({ requireApiUser: () => requireApiUserMock() }));

import { PATCH } from "@/app/api/friends/quizzes/[quizId]/share/route";
import { GET } from "@/app/api/friends/profile/[userId]/quizzes/[quizId]/route";

const userId = "00000000-0000-4000-8000-000000000011";
const quizId = "00000000-0000-4000-8000-000000000012";

describe("friend quiz sharing routes", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });
  });

  it("changes sharing only through owner RPC", async () => {
    rpc.mockResolvedValue({ data: { shared: true }, error: null });
    const response = (await PATCH(
      new Request(`http://localhost/api/friends/quizzes/${quizId}/share`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ shared: true }) }),
      { params: Promise.resolve({ quizId }) },
    )) as Response;

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("set_quiz_friend_share", { p_output_id: quizId, p_shared: true });
  });

  it("returns generic unavailable for blocked or unshared practice", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "social_unavailable" } });
    const response = (await GET(
      new Request(`http://localhost/api/friends/profile/${userId}/quizzes/${quizId}`),
      { params: Promise.resolve({ userId, quizId }) },
    )) as Response;

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "social_unavailable" });
  });

  it("returns read-only practice payload from protected RPC", async () => {
    rpc.mockResolvedValue({ data: { id: quizId, title: "Math", type: "quiz", questions: [] }, error: null });
    const response = (await GET(
      new Request(`http://localhost/api/friends/profile/${userId}/quizzes/${quizId}`),
      { params: Promise.resolve({ userId, quizId }) },
    )) as Response;

    expect(await response.json()).toEqual({ data: { id: quizId, title: "Math", type: "quiz", questions: [] } });
    expect(rpc).toHaveBeenCalledWith("get_friend_shared_quiz", { p_other_user_id: userId, p_output_id: quizId });
  });

  it("stops unauthenticated access before RPC", async () => {
    requireApiUserMock.mockResolvedValue({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
    const response = (await PATCH(
      new Request(`http://localhost/api/friends/quizzes/${quizId}/share`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ shared: false }) }),
      { params: Promise.resolve({ quizId }) },
    )) as Response;

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});
