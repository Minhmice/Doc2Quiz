import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/resolveUserAiTier", () => ({ resolveUserAiTier: vi.fn(() => "free") }));
vi.mock("./getUserUsage", () => ({ getUserUsage: vi.fn() }));

import { assertGenerationQuota } from "./assertGenerationQuota";
import { QuotaExceededError } from "./QuotaExceededError";
import { getUserUsage } from "./getUserUsage";

describe("assertGenerationQuota", () => {
  it("throws quota details when generation is unavailable", async () => {
    vi.mocked(getUserUsage).mockResolvedValue({
      plan: "free", weeklyUsed: 10, weeklyLimit: 10, weeklyRemaining: 0,
      bonusCredits: 0, weekResetsAt: "2026-08-02T17:00:00.000Z", canGenerateThisSet: false,
    });

    await expect(assertGenerationQuota({ supabase: {} as never, user: { id: "user-1" } as never, studySetId: "set-1" }))
      .rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("allows existing consumption or available credits", async () => {
    vi.mocked(getUserUsage).mockResolvedValue({
      plan: "free", weeklyUsed: 10, weeklyLimit: 10, weeklyRemaining: 0,
      bonusCredits: 1, weekResetsAt: "2026-08-02T17:00:00.000Z", canGenerateThisSet: true,
    });

    await expect(assertGenerationQuota({ supabase: {} as never, user: { id: "user-1" } as never, studySetId: "set-1" })).resolves.toBeUndefined();
  });
});
