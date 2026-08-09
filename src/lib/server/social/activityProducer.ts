import type { SocialRedis } from "@/lib/server/redis/client";
import {
  activityKinds,
  enqueueActivity,
  type ActivityKind,
  type ActivitySource,
  type ActivityEvent,
} from "@/lib/server/social/activityQueue";

export { activityKinds };
export type { ActivityKind, ActivitySource };
export type MeaningfulActivity = ActivityEvent;

export async function enqueueMeaningfulActivity(redis: SocialRedis | null, input: Omit<MeaningfulActivity, "eventId" | "occurredAt" | "dedupeKey">, now = Date.now): Promise<MeaningfulActivity | null> {
  return enqueueActivity(input, { redis, now });
}
