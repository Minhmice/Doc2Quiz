import { randomUUID } from "node:crypto";

import type { SocialRedis } from "@/lib/server/redis/client";

export const activityKinds = ["presence_transition", "message_sent", "conversation_read"] as const;
export type ActivityKind = (typeof activityKinds)[number];
export type ActivitySource = "heartbeat" | "message" | "client";
export type MeaningfulActivity = Readonly<{
  eventId: string;
  userId: string;
  occurredAt: string;
  activityKind: ActivityKind;
  source: ActivitySource;
  dedupeKey: string;
}>;

export async function enqueueMeaningfulActivity(redis: SocialRedis | null, input: Omit<MeaningfulActivity, "eventId" | "occurredAt" | "dedupeKey">, now = Date.now): Promise<MeaningfulActivity | null> {
  if (!redis) return null;
  const occurredAt = new Date(now()).toISOString();
  const event: MeaningfulActivity = {
    eventId: randomUUID(),
    ...input,
    occurredAt,
    dedupeKey: `${input.userId}:${input.activityKind}:${Math.floor(now() / 60_000)}`,
  };
  try {
    await redis.xAdd("d2q:activity", "*", event, { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: 10_000 } });
    return event;
  } catch {
    return null;
  }
}
