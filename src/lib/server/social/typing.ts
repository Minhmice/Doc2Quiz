import { TYPING_REFRESH_SECONDS, TYPING_TTL_SECONDS, typingKey, typingThrottleKey } from "@/lib/server/redis/keys";
import type { SocialRedis } from "@/lib/server/redis/client";

export type TypingInput = "typing" | "stopped";
export type TypingSnapshot = { state: "ready" | "unknown"; users: { userId: string; state: "typing"; expiresAt: string }[] };

export async function updateTyping(redis: SocialRedis | null, conversationId: string, userId: string, state: TypingInput, now = Date.now): Promise<{ state: "ready" } | { state: "rate_limited" } | { state: "unknown" }> {
  if (!redis) return { state: "unknown" };
  try {
    if (state === "stopped") {
      await redis.del(typingKey(conversationId, userId));
      return { state: "ready" };
    }
    const throttle = await redis.set(typingThrottleKey(conversationId, userId), "1", { EX: TYPING_REFRESH_SECONDS, NX: true });
    if (throttle === null) return { state: "rate_limited" };
    await redis.set(typingKey(conversationId, userId), JSON.stringify({ expiresAtMs: now() + TYPING_TTL_SECONDS * 1000 }), { EX: TYPING_TTL_SECONDS });
    return { state: "ready" };
  } catch {
    return { state: "unknown" };
  }
}

export async function getTypingSnapshot(redis: SocialRedis | null, conversationId: string, participantIds: readonly string[], now = Date.now): Promise<TypingSnapshot> {
  if (!redis) return { state: "unknown", users: [] };
  try {
    const values = await redis.mGet(participantIds.map((userId) => typingKey(conversationId, userId)));
    return {
      state: "ready",
      users: values.flatMap((value, index) => {
        if (!value) return [];
        try {
          const expiresAtMs = (JSON.parse(value) as { expiresAtMs?: unknown }).expiresAtMs;
          return typeof expiresAtMs === "number" && expiresAtMs > now()
            ? [{ userId: participantIds[index], state: "typing" as const, expiresAt: new Date(expiresAtMs).toISOString() }]
            : [];
        } catch { return []; }
      }),
    };
  } catch {
    return { state: "unknown", users: [] };
  }
}
