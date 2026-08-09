import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUserMock = vi.fn();
const getRedisMock = vi.fn();
const checkRateLimitMock = vi.fn();
const updateTypingMock = vi.fn();
const getTypingSnapshotMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({ requireApiUser: () => requireApiUserMock() }));
vi.mock("@/lib/server/redis/client", () => ({ getRedis: () => getRedisMock() }));
vi.mock("@/lib/server/social/rateLimit", () => ({ checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args) }));
vi.mock("@/lib/server/social/typing", () => ({
  updateTyping: (...args: unknown[]) => updateTypingMock(...args),
  getTypingSnapshot: (...args: unknown[]) => getTypingSnapshotMock(...args),
}));

import { GET, POST } from "./route";

const conversationId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000001";
async function call(method: "GET" | "POST", body?: unknown): Promise<Response> {
  return (await (method === "GET" ? GET : POST)(
    new Request(`http://localhost/api/friends/messages/${conversationId}/typing`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }),
    { params: Promise.resolve({ conversationId }) },
  )) as Response;
}

describe("canonical typing route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ user: { id: userId }, supabase: { rpc: vi.fn().mockResolvedValue({ data: { participantIds: [userId, "00000000-0000-4000-8000-000000000003"] }, error: null }) } });
    getRedisMock.mockResolvedValue({ redis: { tag: "redis" } });
    checkRateLimitMock.mockResolvedValue({ allowed: true });
    updateTypingMock.mockResolvedValue({ state: "ready" });
    getTypingSnapshotMock.mockResolvedValue({ state: "ready", users: [] });
  });

  it("authorizes before Redis then writes typing", async () => {
    const response = await call("POST", { state: "typing" });
    expect(response.status).toBe(204);
    expect(updateTypingMock).toHaveBeenCalledWith({ tag: "redis" }, conversationId, userId, "typing");
  });

  it("hides unavailable conversations before Redis", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "social_unavailable" } });
    requireApiUserMock.mockResolvedValue({ user: { id: userId }, supabase: { rpc } });
    const response = await call("POST", { state: "typing" });
    expect(response.status).toBe(404);
    expect(getRedisMock).not.toHaveBeenCalled();
  });

  it("returns exact two-second refresh rejection without mutation", async () => {
    updateTypingMock.mockResolvedValue({ state: "rate_limited" });
    const response = await call("POST", { state: "typing" });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect(await response.json()).toEqual({ error: "rate_limited", retryAfterSeconds: 2 });
  });

  it("returns unknown typing snapshot when Redis is unavailable", async () => {
    getRedisMock.mockResolvedValue({ redis: null });
    const response = await call("GET");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { state: "unknown", users: [] } });
    expect(getTypingSnapshotMock).not.toHaveBeenCalled();
  });

  it("preserves authentication response", async () => {
    requireApiUserMock.mockResolvedValue({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
    expect((await call("GET")).status).toBe(401);
    expect(getRedisMock).not.toHaveBeenCalled();
  });
});
