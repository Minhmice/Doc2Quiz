import { createClient } from "redis";

import { socialObservability } from "@/lib/server/social/observability";

export type RedisHealth = "ready" | "disabled" | "unavailable";

export type SocialRedis = {
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  zAdd(key: string, entries: { score: number; value: string }[]): Promise<unknown>;
  zRemRangeByScore(key: string, min: number, max: number): Promise<unknown>;
  zRemRangeByRank(key: string, start: number, stop: number): Promise<unknown>;
  zRange(key: string, start: number, stop: number): Promise<string[]>;
  mGet(keys: string[]): Promise<(string | null)[]>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

export type RedisConnection = { state: RedisHealth; redis: SocialRedis | null };

const connectTimeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 1000);
const commandTimeoutMs = Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 1000);
const reconnectMaxMs = Number(process.env.REDIS_RECONNECT_MAX_MS ?? 5000);

let clientPromise: Promise<SocialRedis> | null = null;

function boundedTimeout<T>(promise: Promise<T>, milliseconds: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("redis timeout")), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

function createRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = createClient({
    url,
    socket: {
      connectTimeout: connectTimeoutMs,
      reconnectStrategy: (retries) => Math.min(reconnectMaxMs, 100 * 2 ** retries),
    },
  });
  client.on("error", () => socialObservability.count("presence_snapshot_redis_errors", { outcome: "error" }));
  client.on("reconnecting", () => socialObservability.count("redis_reconnects"));
  return client;
}

async function connectRedis() {
  const client = createRedisClient();
  if (!client) throw new Error("redis disabled");
  await boundedTimeout(client.connect(), connectTimeoutMs);
  if (!client.isReady) throw new Error("redis unavailable");
  return {
    set: (key: string, value: string, options: { EX: number }) => boundedTimeout(client.set(key, value, options), commandTimeoutMs),
    zAdd: (key: string, entries: { score: number; value: string }[]) => boundedTimeout(client.zAdd(key, entries), commandTimeoutMs),
    zRemRangeByScore: (key: string, min: number, max: number) => boundedTimeout(client.zRemRangeByScore(key, min, max), commandTimeoutMs),
    zRemRangeByRank: (key: string, start: number, stop: number) => boundedTimeout(client.zRemRangeByRank(key, start, stop), commandTimeoutMs),
    zRange: (key: string, start: number, stop: number) => boundedTimeout(client.zRange(key, start, stop), commandTimeoutMs),
    mGet: (keys: string[]) => boundedTimeout(client.mGet(keys), commandTimeoutMs),
    incr: (key: string) => boundedTimeout(client.incr(key), commandTimeoutMs),
    expire: (key: string, seconds: number) => boundedTimeout(client.expire(key, seconds), commandTimeoutMs),
  };
}

export async function getRedis(): Promise<RedisConnection> {
  if (!process.env.REDIS_URL) return { state: "disabled", redis: null };
  clientPromise ??= connectRedis();
  try {
    return { state: "ready", redis: await clientPromise };
  } catch {
    clientPromise = null;
    return { state: "unavailable", redis: null };
  }
}
