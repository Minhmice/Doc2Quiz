import { describe, expect, it } from "vitest";

import { presenceKey, presenceSessionIndexKey } from "@/lib/server/redis/keys";
import { checkRateLimit, createInMemoryRateLimitRedis } from "@/lib/server/social/rateLimit";
import { createPresenceService } from "@/lib/server/social/presence";

describe("presence Redis contract", () => {
  it("writes 60-second session keys, keeps eight sessions, and reads exact keys", async () => {
    const redis = createInMemoryRateLimitRedis();
    const presence = createPresenceService(redis, () => 1_000);

    for (let index = 0; index < 9; index += 1) {
      await presence.touchPresence("00000000-0000-4000-8000-000000000001", `session-${index}`, "idle");
    }

    expect(redis.sets).toHaveLength(9);
    expect(redis.sets[0]).toEqual(expect.objectContaining({ key: presenceKey("00000000-0000-4000-8000-000000000001", "session-0"), ttlSeconds: 60 }));
    const result = await presence.readPresence("00000000-0000-4000-8000-000000000001");
    expect(result).toEqual(expect.objectContaining({ state: "ready", sessions: expect.any(Array) }));
    expect(result.state === "ready" ? result.sessions : []).toHaveLength(8);
    expect(redis.mgetKeys).toEqual(Array.from({ length: 8 }, (_, index) => presenceKey("00000000-0000-4000-8000-000000000001", `session-${index + 1}`)));
    expect(redis.zsets.get(presenceSessionIndexKey("00000000-0000-4000-8000-000000000001"))?.size).toBe(8);
  });

  it("reports degraded without a process-memory presence fallback", async () => {
    const presence = createPresenceService(null, () => 1_000);

    await expect(presence.touchPresence("00000000-0000-4000-8000-000000000001", "session-a", "idle")).resolves.toEqual({ state: "unknown" });
    await expect(presence.readPresence("00000000-0000-4000-8000-000000000001")).resolves.toEqual({ state: "unknown" });
  });
});

describe("social rate limits", () => {
  it("allows four user and eight IP heartbeats per 60 seconds, then returns 60", async () => {
    const redis = createInMemoryRateLimitRedis();
    for (let index = 0; index < 4; index += 1) {
      await expect(checkRateLimit(redis, "heartbeat", "user", "user-1")).resolves.toEqual({ allowed: true });
    }
    await expect(checkRateLimit(redis, "heartbeat", "user", "user-1")).resolves.toEqual({ allowed: false, retryAfterSeconds: 60 });

    for (let index = 0; index < 8; index += 1) await checkRateLimit(redis, "heartbeat", "ip", "127.0.0.1");
    await expect(checkRateLimit(redis, "heartbeat", "ip", "127.0.0.1")).resolves.toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it("exports limits for typing and snapshots and fails closed when Redis is unavailable", async () => {
    await expect(checkRateLimit(null, "typing-update", "user", "user-1")).resolves.toEqual({ allowed: false, unavailable: true });
  });
});
