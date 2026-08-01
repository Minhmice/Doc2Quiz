import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUserMock = vi.fn();
vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

import { POST } from "./route";

const conversationId = "00000000-0000-4000-8000-000000000012";

function call(id = conversationId) {
  return POST(new Request(`http://localhost/api/friends/messages/${id}/read`, { method: "POST" }), {
    params: Promise.resolve({ conversationId: id }),
  });
}

describe("POST /api/friends/messages/[conversationId]/read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks only caller participant read via guarded RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });

    const response = (await call()) as Response;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { ok: true } });
    expect(rpc).toHaveBeenCalledWith("mark_direct_conversation_read", { p_conversation_id: conversationId });
  });

  it("rejects malformed conversation ids before RPC", async () => {
    const rpc = vi.fn();
    requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });

    const response = (await call("bad")) as Response;

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not disclose inaccessible conversations", async () => {
    requireApiUserMock.mockResolvedValue({ supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "social_unavailable" } }) }, user: { id: "user-1" } });

    const response = (await call()) as Response;

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "social_unavailable" });
  });

  it("returns authentication response before RPC", async () => {
    requireApiUserMock.mockResolvedValue({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });

    expect(((await call()) as Response).status).toBe(401);
  });
});
