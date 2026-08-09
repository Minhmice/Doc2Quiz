import { randomUUID } from "node:crypto";

import { getRedis, type SocialRedis } from "@/lib/server/redis/client";

export const ACTIVITY_STREAM_KEY = "d2q:activity";
export const ACTIVITY_STREAM_MAX_LENGTH = 10_000;
export const ACTIVITY_RETENTION_HOURS = 24;
export const activityKinds = ["presence_transition", "message_sent", "conversation_read"] as const;
export const activitySources = ["heartbeat", "message", "client"] as const;

export type ActivityKind = (typeof activityKinds)[number];
export type ActivitySource = (typeof activitySources)[number];
export type ActivityEvent = Readonly<{
  eventId: string;
  userId: string;
  occurredAt: string;
  activityKind: ActivityKind;
  source: ActivitySource;
  dedupeKey: string;
}>;

export type ActivityInput = Readonly<{
  userId: string;
  activityKind: ActivityKind;
  source: ActivitySource;
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FIELD_LENGTH = 96;

function hasOwnKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

export function createActivityEvent(input: ActivityInput, now = Date.now, eventId = randomUUID()): ActivityEvent {
  const occurredAt = new Date(now()).toISOString();
  const event: ActivityEvent = {
    eventId,
    userId: input.userId,
    occurredAt,
    activityKind: input.activityKind,
    source: input.source,
    dedupeKey: `${input.userId}:${input.activityKind}:${Math.floor(now() / 60_000)}`,
  };
  return parseActivityEvent(event);
}

export function parseActivityEvent(value: unknown): ActivityEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid activity event");
  const event = value as Record<string, unknown>;
  if (!hasOwnKeys(event, ["eventId", "userId", "occurredAt", "activityKind", "source", "dedupeKey"])) throw new Error("invalid activity event");
  if (typeof event.eventId !== "string" || !uuidPattern.test(event.eventId)) throw new Error("invalid activity event");
  if (typeof event.userId !== "string" || !uuidPattern.test(event.userId)) throw new Error("invalid activity event");
  const occurredAt = typeof event.occurredAt === "string" ? new Date(event.occurredAt) : null;
  if (!occurredAt || Number.isNaN(occurredAt.getTime()) || occurredAt.toISOString() !== event.occurredAt) throw new Error("invalid activity event");
  if (typeof event.activityKind !== "string" || !activityKinds.includes(event.activityKind as ActivityKind)) throw new Error("invalid activity event");
  if (typeof event.source !== "string" || !activitySources.includes(event.source as ActivitySource)) throw new Error("invalid activity event");
  if (typeof event.dedupeKey !== "string" || event.dedupeKey.length === 0 || event.dedupeKey.length > MAX_FIELD_LENGTH) throw new Error("invalid activity event");
  return event as ActivityEvent;
}

export async function enqueueActivity(input: ActivityInput, dependencies: { redis?: SocialRedis | null; now?: () => number } = {}): Promise<ActivityEvent | null> {
  const event = createActivityEvent(input, dependencies.now);
  const redis = dependencies.redis ?? (await getRedis()).redis;
  if (!redis) return null;
  try {
    await redis.xAdd(ACTIVITY_STREAM_KEY, "*", event, {
      TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: ACTIVITY_STREAM_MAX_LENGTH },
    });
    return event;
  } catch {
    return null;
  }
}
