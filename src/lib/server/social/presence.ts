import { PRESENCE_SESSION_LIMIT, PRESENCE_TTL_SECONDS, presenceKey, presenceSessionIndexKey } from "@/lib/server/redis/keys";
import type { SocialRedis } from "@/lib/server/redis/client";

export type PresenceActivity = "idle" | "studying" | "chatting";
type PresenceRecord = { activity: PresenceActivity; expiresAtMs: number };
type PresenceState = { state: "ready"; sessions: PresenceRecord[] } | { state: "unknown" };

export function createPresenceService(redis: SocialRedis | null, now = Date.now) {
  return {
    async touchPresence(userId: string, sessionId: string, activity: PresenceActivity): Promise<{ state: "ready" } | { state: "unknown" }> {
      if (!redis) return { state: "unknown" };
      const expiresAtMs = now() + PRESENCE_TTL_SECONDS * 1000;
      try {
        await redis.set(presenceKey(userId, sessionId), JSON.stringify({ activity, expiresAtMs }), { EX: PRESENCE_TTL_SECONDS });
        const indexKey = presenceSessionIndexKey(userId);
        await redis.zRemRangeByScore(indexKey, 0, now());
        await redis.zAdd(indexKey, [{ score: expiresAtMs, value: sessionId }]);
        if ((await redis.zRange(indexKey, 0, PRESENCE_SESSION_LIMIT)).length > PRESENCE_SESSION_LIMIT) {
          await redis.zRemRangeByRank(indexKey, 0, 0);
        }
        return { state: "ready" };
      } catch {
        return { state: "unknown" };
      }
    },
    async readPresence(userId: string): Promise<PresenceState> {
      if (!redis) return { state: "unknown" };
      try {
        const indexKey = presenceSessionIndexKey(userId);
        await redis.zRemRangeByScore(indexKey, 0, now());
        const sessions = await redis.zRange(indexKey, 0, PRESENCE_SESSION_LIMIT - 1);
        const values = await redis.mGet(sessions.map((sessionId) => presenceKey(userId, sessionId)));
        return {
          state: "ready",
          sessions: values.flatMap((value) => {
            if (!value) return [];
            try {
              const record = JSON.parse(value) as PresenceRecord;
              return record.expiresAtMs > now() ? [record] : [];
            } catch {
              return [];
            }
          }),
        };
      } catch {
        return { state: "unknown" };
      }
    },
  };
}

export async function touchPresence(userId: string, sessionId: string, activity: PresenceActivity, redis: SocialRedis | null) {
  return createPresenceService(redis).touchPresence(userId, sessionId, activity);
}
