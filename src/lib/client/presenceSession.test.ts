import { describe, expect, it, vi } from "vitest";
import { createLastKnownCache, createPresenceSessionController, HEARTBEAT_MAX_MS, HEARTBEAT_MIN_MS } from "./presenceSession";

describe("presence session", () => {
  it("keeps last-known presentation only for fifteen seconds", () => {
    let now = 0;
    const cache = createLastKnownCache<{ presence: string }>(() => now);
    cache.store({ presence: "online" });
    expect(cache.read()).toEqual({ value: { presence: "online" }, source: "last_known" });
    now = 15_001;
    expect(cache.read()).toBeNull();
  });

  it("owns one jittered heartbeat and pauses while hidden", async () => {
    vi.useFakeTimers();
    const listeners = new Map<string, () => void>();
    const documentTarget = {
      visibilityState: "visible",
      addEventListener: vi.fn((type: string, listener: () => void) => listeners.set(type, listener)),
      removeEventListener: vi.fn(),
    };
    const heartbeat = vi.fn().mockResolvedValue(undefined);
    const controller = createPresenceSessionController({
      heartbeat,
      sessionId: "session",
      random: () => 0,
      documentTarget,
      windowTarget: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    });
    controller.start();
    await vi.runAllTicks();
    expect(heartbeat).toHaveBeenCalledWith("session");
    expect(HEARTBEAT_MIN_MS).toBeGreaterThanOrEqual(20_000);
    expect(HEARTBEAT_MAX_MS).toBeLessThanOrEqual(40_000);
    documentTarget.visibilityState = "hidden";
    listeners.get("visibilitychange")?.();
    vi.advanceTimersByTime(HEARTBEAT_MAX_MS + 1);
    expect(heartbeat).toHaveBeenCalledTimes(1);
    controller.stop();
    vi.useRealTimers();
  });
});
