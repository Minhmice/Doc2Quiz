import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createInMemoryRateLimitRedis } from "@/lib/server/social/rateLimit";
import { activityKinds, enqueueMeaningfulActivity } from "./activityProducer";

describe("meaningful activity producer", () => {
  it("emits only closed activity events with server-owned identity and dedupe", async () => {
    const redis = createInMemoryRateLimitRedis();
    const event = await enqueueMeaningfulActivity(redis, { userId: "00000000-0000-4000-8000-000000000001", activityKind: "presence_transition", source: "heartbeat" }, () => 60_000);
    expect(activityKinds).toEqual(["presence_transition", "message_sent", "conversation_read"]);
    expect(event).toEqual(expect.objectContaining({ activityKind: "presence_transition", occurredAt: "1970-01-01T00:01:00.000Z", dedupeKey: "00000000-0000-4000-8000-000000000001:presence_transition:1", eventId: expect.any(String) }));
    expect(redis.streamEntries).toHaveLength(1);
  });

  it("keeps quiz and flashcard completion outside social activity", () => {
    expect(activityKinds).not.toContain("study_action");
    expect(readFileSync("src/lib/client/activityTracking.ts", "utf8")).not.toContain("enqueueMeaningfulActivity");
    expect(readFileSync("src/components/flashcards/FlashcardSession.tsx", "utf8")).not.toContain("enqueueMeaningfulActivity");
  });
});
