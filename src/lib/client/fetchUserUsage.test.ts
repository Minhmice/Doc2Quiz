import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchUserUsage } from "./fetchUserUsage";

const usage = {
  plan: "free" as const,
  weeklyUsed: 2,
  weeklyLimit: 10,
  weeklyRemaining: 8,
  bonusCredits: 0,
  weekResetsAt: "2026-08-03T17:00:00.000Z",
};

describe("fetchUserUsage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("bypasses fetch cache for private quota state", async () => {
    const signal = new AbortController().signal;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => usage,
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      fetchUserUsage({ studySetId: "set-1", signal }),
    ).resolves.toEqual(usage);
    expect(mockFetch).toHaveBeenCalledWith("/api/usage?studySetId=set-1", {
      cache: "no-store",
      signal,
    });
  });

  it("preserves the existing generic API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false }),
    );

    await expect(fetchUserUsage()).rejects.toThrow("Unable to load usage.");
  });
});
