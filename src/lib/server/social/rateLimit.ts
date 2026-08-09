import { socialRateLimitKey } from "@/lib/server/redis/keys";
import type { SocialRedis } from "@/lib/server/redis/client";

export const HEARTBEAT_RATE_LIMIT = { user: 4, ip: 8, windowSeconds: 60 } as const;
export const TYPING_UPDATE_RATE_LIMIT = { user: 30, ip: 60, windowSeconds: 60 } as const;
export const TYPING_SNAPSHOT_RATE_LIMIT = { user: 60, ip: 120, windowSeconds: 60 } as const;

type RateLimitScope = "heartbeat" | "typing-update" | "typing-snapshot";
type RateLimitSubject = "user" | "ip";
type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number } | { allowed: false; unavailable: true };

const limits = {
  heartbeat: HEARTBEAT_RATE_LIMIT,
  "typing-update": TYPING_UPDATE_RATE_LIMIT,
  "typing-snapshot": TYPING_SNAPSHOT_RATE_LIMIT,
} as const;

export async function checkRateLimit(redis: SocialRedis | null, scope: RateLimitScope, subjectType: RateLimitSubject, subject: string): Promise<RateLimitResult> {
  if (!redis) return { allowed: false, unavailable: true };
  const limit = limits[scope];
  const key = socialRateLimitKey(scope, subjectType, subject, Math.floor(Date.now() / (limit.windowSeconds * 1000)));
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, limit.windowSeconds);
    return count <= limit[subjectType] ? { allowed: true } : { allowed: false, retryAfterSeconds: limit.windowSeconds };
  } catch {
    return { allowed: false, unavailable: true };
  }
}

export function createInMemoryRateLimitRedis(): SocialRedis & {
  sets: { key: string; value: string; ttlSeconds: number }[];
  increments: { key: string; windowSeconds: number }[];
  zsets: Map<string, Map<string, number>>;
  mgetKeys: string[];
} {
  const values = new Map<string, string>();
  const counters = new Map<string, number>();
  const zsets = new Map<string, Map<string, number>>();
  const expires = new Map<string, number>();
  const sets: { key: string; value: string; ttlSeconds: number }[] = [];
  const increments: { key: string; windowSeconds: number }[] = [];
  const valid = (key: string) => (expires.get(key) ?? Infinity) > Date.now();
  return {
    sets,
    increments,
    zsets,
    mgetKeys: [],
    async set(key, value, { EX }) {
      values.set(key, value);
      expires.set(key, Date.now() + EX * 1000);
      sets.push({ key, value, ttlSeconds: EX });
    },
    async zAdd(key, entries) {
      const index = zsets.get(key) ?? new Map<string, number>();
      for (const entry of entries) index.set(entry.value, entry.score);
      zsets.set(key, index);
    },
    async zRemRangeByScore(key, min, max) {
      const index = zsets.get(key);
      if (!index) return;
      for (const [member, score] of index) if (score >= min && score <= max) index.delete(member);
    },
    async zRemRangeByRank(key, start, stop) {
      const index = zsets.get(key);
      if (!index) return;
      const members = [...index.entries()].sort((left, right) => left[1] - right[1]);
      const end = stop < 0 ? members.length + stop + 1 : stop + 1;
      if (end <= 0) return;
      for (const [member] of members.slice(start, end)) index.delete(member);
    },
    async zRange(key, start, stop) {
      const members = [...(zsets.get(key) ?? new Map()).entries()].sort((left, right) => left[1] - right[1]).map(([member]) => member);
      return members.slice(start < 0 ? members.length + start : start, stop < 0 ? members.length + stop + 1 : stop + 1);
    },
    async mGet(keys) {
      this.mgetKeys = keys;
      return keys.map((key) => valid(key) ? values.get(key) ?? null : null);
    },
    async incr(key) {
      const value = (counters.get(key) ?? 0) + 1;
      counters.set(key, value);
      return value;
    },
    async expire(key, seconds) {
      expires.set(key, Date.now() + seconds * 1000);
      increments.push({ key, windowSeconds: seconds });
    },
  };
}
