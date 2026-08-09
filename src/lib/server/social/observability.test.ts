import { describe, expect, it, vi } from "vitest";

import { createSocialObservability, redactSocialMetric } from "./observability";

describe("social observability", () => {
  it("emits structured counters without sensitive values", () => {
    const emit = vi.fn();
    const metrics = createSocialObservability(emit);
    metrics.count("redis_reconnects", { url: "redis://user:secret@example.com", sessionId: "session-a", ip: "127.0.0.1", outcome: "timeout" });

    expect(emit).toHaveBeenCalledWith({ name: "redis_reconnects", fields: { outcome: "timeout" } });
  });

  it("redacts credentials, URLs, values, tokens, session IDs, and IPs", () => {
    expect(redactSocialMetric({ url: "redis://user:secret@example.com", value: "raw", token: "token", sessionId: "session-a", ip: "127.0.0.1", count: 1 })).toEqual({ count: 1 });
  });
});
