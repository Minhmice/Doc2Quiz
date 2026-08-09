import { describe, expect, it } from "vitest";

import { typingKey } from "@/lib/server/redis/keys";
import { createInMemoryRateLimitRedis } from "@/lib/server/social/rateLimit";
import { getTypingSnapshot, updateTyping } from "./typing";

const conversationId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

describe("typing Redis contract", () => {
  it("writes a five-second key, throttles refreshes, and deletes stopped state", async () => {
    const redis = createInMemoryRateLimitRedis();
    expect(await updateTyping(redis, conversationId, userId, "typing", () => 1_000)).toEqual({ state: "ready" });
    expect(redis.sets).toContainEqual(expect.objectContaining({ key: typingKey(conversationId, userId), ttlSeconds: 5 }));
    expect(await updateTyping(redis, conversationId, userId, "typing", () => 1_000)).toEqual({ state: "rate_limited" });
    expect(await updateTyping(redis, conversationId, userId, "stopped")).toEqual({ state: "ready" });
  });

  it("returns unknown rather than stopped when Redis is unavailable", async () => {
    expect(await getTypingSnapshot(null, conversationId, [userId])).toEqual({ state: "unknown", users: [] });
  });
});
