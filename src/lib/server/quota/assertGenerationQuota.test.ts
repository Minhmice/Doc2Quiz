import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/resolveUserAiTier", () => ({ resolveUserAiTier: vi.fn(() => "free") }));
vi.mock("./generationQuotaReservation", () => ({
  GenerationInProgressError: class GenerationInProgressError extends Error {
    constructor(readonly reservationExpiresAt: string) {
      super("Generation already in progress for this study set.");
      this.name = "GenerationInProgressError";
    }
  },
  getGenerationQuotaAvailability: vi.fn(),
}));

import { assertGenerationQuota } from "./assertGenerationQuota";
import {
  GenerationInProgressError,
  getGenerationQuotaAvailability,
} from "./generationQuotaReservation";
import { QuotaExceededError } from "./QuotaExceededError";

describe("assertGenerationQuota", () => {
  it("throws quota details when availability is exhausted", async () => {
    vi.mocked(getGenerationQuotaAvailability).mockResolvedValue({
      status: "quota_exceeded",
      canGenerate: false,
      weeklyUsed: 10,
      weeklyLimit: 10,
      bonusCredits: 0,
      weekResetsAt: "2026-08-02T17:00:00.000Z",
    });

    await expect(
      assertGenerationQuota({ supabase: {} as never, user: { id: "user-1" } as never, studySetId: "set-1" }),
    ).rejects.toEqual(
      new QuotaExceededError({
        weeklyUsed: 10,
        weeklyLimit: 10,
        bonusCredits: 0,
        weekResetsAt: "2026-08-02T17:00:00.000Z",
      }),
    );
  });

  it("allows available capacity and already committed regeneration", async () => {
    vi.mocked(getGenerationQuotaAvailability).mockResolvedValue({
      status: "already_committed",
      canGenerate: true,
      weeklyUsed: 10,
      weeklyLimit: 10,
      bonusCredits: 1,
      weekResetsAt: "2026-08-02T17:00:00.000Z",
    });

    await expect(
      assertGenerationQuota({ supabase: {} as never, user: { id: "user-1" } as never, studySetId: "set-1" }),
    ).resolves.toBeUndefined();
  });

  it("throws GenerationInProgressError for active duplicate work", async () => {
    vi.mocked(getGenerationQuotaAvailability).mockResolvedValue({
      status: "generation_in_progress",
      canGenerate: false,
      weeklyUsed: 2,
      weeklyLimit: 10,
      bonusCredits: 0,
      weekResetsAt: "2026-08-02T17:00:00.000Z",
      reservationExpiresAt: "2026-07-30T06:07:00.000Z",
    });

    await expect(
      assertGenerationQuota({ supabase: {} as never, user: { id: "user-1" } as never, studySetId: "set-1" }),
    ).rejects.toEqual(new GenerationInProgressError("2026-07-30T06:07:00.000Z"));
  });

  it("does not read quota tables directly", async () => {
    const from = vi.fn();
    vi.mocked(getGenerationQuotaAvailability).mockResolvedValue({
      status: "available",
      canGenerate: true,
      weeklyUsed: 1,
      weeklyLimit: 10,
      bonusCredits: 0,
      weekResetsAt: "2026-08-02T17:00:00.000Z",
    });

    await assertGenerationQuota({
      supabase: { from, rpc: vi.fn() } as never,
      user: { id: "user-1" } as never,
      studySetId: "set-1",
    });

    expect(from).not.toHaveBeenCalled();
  });
});
