import { describe, expect, it, vi } from "vitest";

const requireApiUserMock = vi.fn();
const broadcastSocialEventMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));
vi.mock("@/lib/server/friends/realtimeBroadcast", () => ({
  broadcastSocialEvent: (...args: unknown[]) => broadcastSocialEventMock(...args),
}));

import { POST } from "./route";

const recipientUserId = "00000000-0000-4000-8000-000000000011";

function request() {
  return new Request("http://localhost/api/friends/reactions", {
    method: "POST",
    body: JSON.stringify({ recipientUserId, reactionId: "xin_chao" }),
  });
}

describe("POST /api/friends/reactions", () => {
  it("returns 503 when Realtime rejects reaction delivery", async () => {
    requireApiUserMock.mockResolvedValue({
      supabase: { rpc: vi.fn().mockResolvedValue({ data: { recipientUserId, reactionId: "xin_chao" }, error: null }) },
      user: { id: "user-1" },
    });
    broadcastSocialEventMock.mockResolvedValue(false);

    const response = await POST(request());

    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: "reaction_unavailable" });
  });
});
