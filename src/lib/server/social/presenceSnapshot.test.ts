import { describe, expect, it } from "vitest";

import { createInMemoryRateLimitRedis } from "@/lib/server/social/rateLimit";
import { createPresenceService } from "@/lib/server/social/presence";
import { createPresenceSnapshotService } from "./presenceSnapshot";

const userId = "00000000-0000-4000-8000-000000000001";
const page = { items: [{ userId, username: "a", avatarUrl: null, lastActiveAt: "1970-01-01T00:00:00.000Z", presenceRank: 3 }], nextCursor: "cursor", hasMore: false };

describe("presence snapshots", () => {
  it("maps healthy sessions and durable ages to canonical buckets", async () => {
    const redis = createInMemoryRateLimitRedis();
    const now = 24 * 60 * 60 * 1000;
    await createPresenceService(redis, () => now).touchPresence(userId, "session-a", "chatting");
    const snapshot = await createPresenceSnapshotService(redis, () => now, new Map()).snapshot(page, "online", "a");
    expect(snapshot.items).toEqual([expect.objectContaining({ presence: "online", source: "redis", activity: "chatting" })]);
  });

  it("uses bounded last-known data then unknown without reclassifying offline", async () => {
    const cache = new Map();
    const healthy = createInMemoryRateLimitRedis();
    const now = 24 * 60 * 60 * 1000;
    await createPresenceService(healthy, () => now).touchPresence(userId, "session-a", "idle");
    await createPresenceSnapshotService(healthy, () => now, cache).snapshot(page, "online", "a");

    const withinGrace = await createPresenceSnapshotService(null, () => now + 15_000, cache).snapshot(page, "online", "a");
    expect(withinGrace.items).toEqual([expect.objectContaining({ presence: "online", source: "last_known" })]);

    const expired = await createPresenceSnapshotService(null, () => now + 15_001, cache).snapshot(page, "offline", "a");
    expect(expired.nextCursor).toBe("cursor");
    expect(expired.items).toEqual([expect.objectContaining({ presence: "unknown", source: "unknown" })]);
  });
});
