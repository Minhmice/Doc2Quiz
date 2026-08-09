import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createClient as createRedisClient } from "redis";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const STREAM = "d2q:activity";
const DEAD_STREAM = "d2q:activity:dead";
const ATTEMPT_PREFIX = "d2q:activity:attempt:";
const MAX_STREAM_LENGTH = 10_000;
const MAX_RETRIES = 5;

export function workerConfig(env = process.env) {
  const integer = (name, fallback, min, max) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`invalid ${name}`);
    return value;
  };
  if (!env.REDIS_URL || !/^rediss?:\/\//.test(env.REDIS_URL)) throw new Error("missing or unsafe REDIS_URL");
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !/^https?:\/\//.test(env.NEXT_PUBLIC_SUPABASE_URL)) throw new Error("missing or unsafe NEXT_PUBLIC_SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY.length < 16) throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
  if (!env.SOCIAL_WORKER_GROUP || !/^[A-Za-z0-9:_-]{1,64}$/.test(env.SOCIAL_WORKER_GROUP)) throw new Error("missing or unsafe SOCIAL_WORKER_GROUP");
  if (!env.SOCIAL_WORKER_CONSUMER || !/^[A-Za-z0-9:_-]{1,64}$/.test(env.SOCIAL_WORKER_CONSUMER)) throw new Error("missing or unsafe SOCIAL_WORKER_CONSUMER");
  const healthFile = env.SOCIAL_WORKER_HEALTH_FILE;
  if (healthFile && (!healthFile.startsWith("/") || healthFile.length > 512)) throw new Error("invalid SOCIAL_WORKER_HEALTH_FILE");
  const maxRetries = integer("SOCIAL_WORKER_MAX_RETRIES", MAX_RETRIES, MAX_RETRIES, MAX_RETRIES);
  return {
    redisUrl: env.REDIS_URL,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    group: env.SOCIAL_WORKER_GROUP,
    consumer: env.SOCIAL_WORKER_CONSUMER,
    batchSize: integer("SOCIAL_WORKER_BATCH_SIZE", 100, 50, 200),
    blockMs: integer("SOCIAL_WORKER_BLOCK_MS", 10_000, 10_000, 30_000),
    leaseMs: integer("SOCIAL_WORKER_LEASE_MS", 30_000, 30_000, 60_000),
    retryBaseMs: integer("SOCIAL_WORKER_RETRY_BASE_MS", 1_000, 100, 30_000),
    maxRetries,
    healthFile,
  };
}

export function parseStreamEvent(message) {
  const keys = ["eventId", "userId", "occurredAt", "activityKind", "source", "dedupeKey"];
  if (!message || typeof message !== "object" || Object.keys(message).length !== keys.length || !keys.every((key) => typeof message[key] === "string")) throw new Error("invalid activity event");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(message.eventId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(message.userId)) throw new Error("invalid activity event");
  if (!Number.isFinite(Date.parse(message.occurredAt)) || !["presence_transition", "message_sent", "conversation_read"].includes(message.activityKind) || !["heartbeat", "message", "client"].includes(message.source) || message.dedupeKey.length > 96) throw new Error("invalid activity event");
  return Object.fromEntries(keys.map((key) => [key, message[key]]));
}

export function newestEvents(events) {
  const newest = new Map();
  for (const event of events) {
    const key = `${event.userId}:${event.activityKind}:${event.occurredAt.slice(0, 16)}`;
    if (!newest.has(key) || newest.get(key).occurredAt < event.occurredAt) newest.set(key, event);
  }
  return [...newest.values()];
}

async function writeHealth(config, health) {
  if (!config.healthFile) return;
  await writeFile(config.healthFile, `${JSON.stringify({ ...health, updatedAt: new Date().toISOString() })}\n`, { mode: 0o600 });
}

async function incrementAttempt(redis, entryId) {
  const key = `${ATTEMPT_PREFIX}${entryId}`;
  const attempt = await redis.incr(key);
  if (attempt === 1) await redis.expire(key, 24 * 60 * 60);
  return attempt;
}

async function deadLetter(redis, entry, reason) {
  await redis.xAdd(DEAD_STREAM, "*", { entryId: entry.id, reason }, { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: MAX_STREAM_LENGTH } });
  await redis.xAck(STREAM, entry.group, entry.id);
}

async function handleFailure(redis, entry, config, reason) {
  const attempt = await incrementAttempt(redis, entry.id);
  if (attempt === config.maxRetries) await deadLetter(redis, entry, reason);
  return { retries: 1, deadLetters: attempt === config.maxRetries ? 1 : 0 };
}

export async function processEntries({ redis, supabase, config, entries }) {
  const valid = [];
  let retries = 0;
  let deadLetters = 0;
  for (const entry of entries) {
    try {
      valid.push({ ...entry, event: parseStreamEvent(entry.message) });
    } catch {
      const result = await handleFailure(redis, entry, config, "invalid_event");
      retries += result.retries;
      deadLetters += result.deadLetters;
    }
  }
  if (valid.length === 0) return { processed: 0, retries, deadLetters };
  const { error } = await supabase.rpc("apply_social_activity_batch", { p_events: newestEvents(valid.map(({ event }) => event)) });
  if (error) {
    for (const entry of valid) {
      const result = await handleFailure(redis, entry, config, "durable_commit_failed");
      retries += result.retries;
      deadLetters += result.deadLetters;
    }
    return { processed: 0, retries, deadLetters };
  }
  await redis.xAck(STREAM, config.group, valid.map(({ id }) => id));
  return { processed: valid.length, retries, deadLetters };
}

function flatten(read) {
  return (read ?? []).flatMap((stream) => (stream.messages ?? []).map((message) => ({ id: message.id, message: message.message, group: stream.group })));
}

export async function runOnce({ redis, supabase, config }) {
  try {
    await redis.xGroupCreate(STREAM, config.group, "0", { MKSTREAM: true });
  } catch (error) {
    if (!String(error).includes("BUSYGROUP")) throw error;
  }
  await redis.xTrim(STREAM, "MINID", `${Date.now() - 24 * 60 * 60 * 1000}-0`, { strategyModifier: "~", LIMIT: config.batchSize });
  const claimed = await redis.xAutoClaim(STREAM, config.group, config.consumer, config.leaseMs, "0-0", { COUNT: config.batchSize });
  const reclaimed = (claimed.messages ?? []).map((message) => ({ id: message.id, message: message.message, group: config.group }));
  const claimResult = await processEntries({ redis, supabase, config, entries: reclaimed });
  const read = await redis.xReadGroup(config.group, config.consumer, { key: STREAM, id: ">" }, { COUNT: config.batchSize, BLOCK: config.blockMs });
  const readResult = await processEntries({ redis, supabase, config, entries: flatten(read).map((entry) => ({ ...entry, group: config.group })) });
  const result = {
    processed: claimResult.processed + readResult.processed,
    retries: claimResult.retries + readResult.retries,
    deadLetters: claimResult.deadLetters + readResult.deadLetters,
  };
  await writeHealth(config, { status: "ready", ...result });
  return result;
}

export async function serve(dependencies) {
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGTERM", stop);
  try {
    while (!stopping) await runOnce(dependencies);
    await writeHealth(dependencies.config, { status: "stopped", processed: 0, retries: 0, deadLetters: 0 });
  } finally {
    process.off("SIGTERM", stop);
    await dependencies.redis.quit();
  }
}

async function main() {
  const config = workerConfig();
  if (process.argv.includes("--check-config")) {
    process.stdout.write(`${JSON.stringify({ status: "valid", batchSize: config.batchSize, blockMs: config.blockMs, leaseMs: config.leaseMs, maxRetries: config.maxRetries })}\n`);
    return;
  }
  const redis = createRedisClient({ url: config.redisUrl });
  const supabase = createSupabaseClient(config.supabaseUrl, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await redis.connect();
  const dependencies = { redis, supabase, config };
  if (process.argv.includes("--once")) {
    await runOnce(dependencies);
    await redis.quit();
    return;
  }
  if (process.argv.includes("--serve")) return serve(dependencies);
  throw new Error("usage: --once | --serve | --check-config");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "worker failed"}\n`);
    process.exitCode = 1;
  });
}
