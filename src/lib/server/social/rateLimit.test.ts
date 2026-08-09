import { describe, expect, it } from "vitest";

import { createInMemoryRateLimitRedis, checkRateLimit, HEARTBEAT_RATE_LIMIT, TYPING_SNAPSHOT_RATE_LIMIT, TYPING_UPDATE_RATE_LIMIT } from "./rateLimit";

describe("rate limits", () => {
  it("exports Phase 15 fixed-window limits", () => {
    expect(HEARTBEAT_RATE_LIMIT).toEqual({ user: 4, ip: 8, windowSeconds: 60 });
    expect(TYPING_UPDATE_RATE_LIMIT).toEqual({ user: 30, ip: 60, windowSeconds: 60 });
    expect(TYPING_SNAPSHOT_RATE_LIMIT).toEqual({ user: 60, ip: 120, windowSeconds: 60 });
  });

  it("uses bounded Redis counters", async () => {
    const redis = createInMemoryRateLimitRedis();
    await checkRateLimit(redis, "heartbeat", "user", "user-1");
    expect(redis.increments).toEqual([{ key: expect.stringContaining("d2q:rate:heartbeat:user:"), windowSeconds: 60 }]);
  });
});
