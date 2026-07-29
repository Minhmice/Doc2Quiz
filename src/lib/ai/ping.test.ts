import { describe, expect, it, vi, afterEach } from "vitest";

import {
  formatAiAgentPingMessage,
  isAiAgentHealthy,
  pingAiAgent,
} from "@/lib/ai/ping";

describe("pingAiAgent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a successful API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          configured: true,
          latencyMs: 120,
          model: "gpt-test",
          text: "pong",
        }),
      }),
    );

    const result = await pingAiAgent();

    expect(result.ok).toBe(true);
    expect(isAiAgentHealthy(result)).toBe(true);
    expect(formatAiAgentPingMessage(result)).toContain("AI agent OK");
    expect(formatAiAgentPingMessage(result)).toContain("120ms");
  });

  it("returns network_error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await pingAiAgent();

    expect(result).toEqual({
      ok: false,
      configured: false,
      error: "network_error",
    });
    expect(formatAiAgentPingMessage(result)).toContain("Could not reach");
  });
});
