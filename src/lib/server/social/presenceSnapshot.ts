import type { PresenceActivity, PresenceBucket, PresencePage, PresenceSource } from "@/lib/social/presenceTypes";
import type { SocialRedis } from "@/lib/server/redis/client";
import { createPresenceService } from "@/lib/server/social/presence";
import type { FriendDestination, SocialFriend } from "@/lib/server/friends/socialLists";

export const SOCIAL_UNKNOWN_GRACE_MS = 15_000;

type SnapshotFriend = SocialFriend & { presence: PresenceBucket; source: PresenceSource; activity: PresenceActivity | null };
type CacheEntry = { items: SnapshotFriend[]; savedAt: number };

function ageBucket(lastActiveAt: string | null, now: number): PresenceBucket {
  const timestamp = lastActiveAt ? Date.parse(lastActiveAt) : Number.NaN;
  const age = now - timestamp;
  if (!Number.isFinite(age) || age >= 24 * 60 * 60 * 1000) return "offline";
  return age < 15 * 60 * 1000 ? "active_15m" : "active_today";
}

function rank(presence: PresenceBucket) {
  return presence === "online" ? 0 : presence === "active_15m" ? 1 : presence === "active_today" ? 2 : presence === "offline" ? 3 : 4;
}

export function getPresenceSnapshot(redis: SocialRedis | null, now = Date.now, cache = new Map<string, CacheEntry>()) {
  const presence = createPresenceService(redis, now);

  return {
    async snapshot(page: PresencePage | { items: readonly SocialFriend[]; nextCursor: string | null; hasMore: boolean; totalCount?: number }, destination: FriendDestination, cacheKey: string) {
      const readings = await Promise.all(page.items.map((friend) => presence.readPresence(friend.userId)));
      if (readings.every((reading) => reading.state === "ready")) {
        const items = page.items.map((friend, index) => {
          const reading = readings[index];
          const session = reading.state === "ready" ? reading.sessions[0] : undefined;
          const bucket = session ? "online" : ageBucket(friend.lastActiveAt, now());
          return { ...friend, presence: bucket, source: "redis" as const, activity: session?.activity ?? null, presenceRank: rank(bucket) };
        }).filter((friend) => destination === "online" ? friend.presence === "online" : friend.presence !== "online");
        cache.set(cacheKey, { items, savedAt: now() });
        return { ...page, items };
      }

      const previous = cache.get(cacheKey);
      if (previous && now() - previous.savedAt <= SOCIAL_UNKNOWN_GRACE_MS) {
        return { ...page, items: previous.items.map((friend) => ({ ...friend, source: "last_known" as const })) };
      }
      return {
        ...page,
        items: page.items.map((friend) => ({ ...friend, presence: "unknown" as const, source: "unknown" as const, activity: null, presenceRank: rank("unknown") }))
          .filter(() => destination === "offline"),
      };
    },
  };
}
