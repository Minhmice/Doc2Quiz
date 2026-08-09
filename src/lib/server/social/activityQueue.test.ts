import { describe, expect, it, vi } from "vitest";

import {
  ACTIVITY_RETENTION_HOURS,
  ACTIVITY_STREAM_KEY,
  ACTIVITY_STREAM_MAX_LENGTH,
  createActivityEvent,
  enqueueActivity,
  parseActivityEvent,
} from "./activityQueue";

const userId = "00000000-0000-4000-8000-000000000001";
const eventId = "00000000-0000-4000-8000-000000000002";

describe("activity queue", () => {
  it("rejects unknown, incomplete, raw, and oversized events", () => {
    const event = createActivityEvent({ userId, activityKind: "message_sent", source: "message" }, () => 0, eventId);
    expect(() => parseActivityEvent({ ...event, activityKind: "study_action" })).toThrow("invalid activity event");
    expect(() => parseActivityEvent({ ...event, userId: "bad" })).toThrow("invalid activity event");
    expect(() => parseActivityEvent({ ...event, occurredAt: "bad" })).toThrow("invalid activity event");
    expect(() => parseActivityEvent({ ...event, dedupeKey: "x".repeat(97) })).toThrow("invalid activity event");
    expect(() => parseActivityEvent({ ...event, body: "private" })).toThrow("invalid activity event");
  });

  it("uses bounded stream enqueue and deterministic dedupe keys", async () => {
    const xAdd = vi.fn().mockResolvedValue("1-0");
    const event = await enqueueActivity(
      { userId, activityKind: "conversation_read", source: "client" },
      { redis: { xAdd } as never, now: () => 120_000 },
    );

    expect(event).toMatchObject({ userId, activityKind: "conversation_read", source: "client", dedupeKey: `${userId}:conversation_read:2` });
    expect(xAdd).toHaveBeenCalledWith(ACTIVITY_STREAM_KEY, "*", event, {
      TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: ACTIVITY_STREAM_MAX_LENGTH },
    });
    expect(ACTIVITY_RETENTION_HOURS).toBe(24);
  });

  it("never serializes study actions", () => {
    expect(() => createActivityEvent({ userId, activityKind: "study_action" as never, source: "client" }, () => 0, eventId)).toThrow("invalid activity event");
  });
});
