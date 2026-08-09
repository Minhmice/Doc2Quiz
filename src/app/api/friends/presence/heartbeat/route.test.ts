import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUserMock = vi.fn();
const getRedisMock = vi.fn();
const touchPresenceMock = vi.fn();
const checkRateLimitMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({ requireApiUser: () => requireApiUserMock() }));
vi.mock("@/lib/server/redis/client", () => ({ getRedis: () => getRedisMock() }));
vi.mock("@/lib/server/social/presence", () => ({ touchPresence: (...args: unknown[]) => touchPresenceMock(...args) }));
vi.mock("@/lib/server/social/rateLimit", () => ({ checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args) }));

import { POST } from "./route";

const user = { id: "00000000-0000-4000-8000-000000000001" };
const redis = { tag: "redis" };
const request = (body?: unknown, headers?: HeadersInit) => new Request("http://localhost/api/friends/presence/heartbeat", {
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe("POST /api/friends/presence/heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ user, supabase: { rpc: vi.fn() } });
    getRedisMock.mockResolvedValue({ state: "ready", redis });
    checkRateLimitMock.mockResolvedValue({ allowed: true });
    touchPresenceMock.mockResolvedValue({ state: "ready" });
  });

  it("touches Redis only and returns 204", async () => {
    const response = await POST(request({ sessionId: "session-a", activity: "studying" }));

    expect(response.status).toBe(204);
    expect(touchPresenceMock).toHaveBeenCalledWith(user.id, "session-a", "studying", redis);
    expect(requireApiUserMock).toHaveBeenCalledTimes(1);
    expect(checkRateLimitMock).toHaveBeenCalledTimes(2);
  });

  it("preserves the auth error", async () => {
    requireApiUserMock.mockResolvedValue({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });

    expect((await POST(request({ sessionId: "session-a" }))).status).toBe(401);
    expect(getRedisMock).not.toHaveBeenCalled();
  });

  it("returns degraded when Redis is disabled or touch fails", async () => {
    getRedisMock.mockResolvedValue({ state: "disabled", redis: null });
    const disabled = await POST(request({ sessionId: "session-a" }));
    expect(disabled.status).toBe(503);
    expect(await disabled.json()).toEqual({ error: "social_degraded", state: "unknown" });

    getRedisMock.mockResolvedValue({ state: "ready", redis });
    touchPresenceMock.mockResolvedValue({ state: "unknown" });
    const failed = await POST(request({ sessionId: "session-a" }));
    expect(failed.status).toBe(503);
  });

  it("returns 429 with Retry-After and does not touch Redis", async () => {
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });
    const response = await POST(request({ sessionId: "session-a" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({ error: "rate_limited", retryAfterSeconds: 60 });
    expect(touchPresenceMock).not.toHaveBeenCalled();
  });
});
