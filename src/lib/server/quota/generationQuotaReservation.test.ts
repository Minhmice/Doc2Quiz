import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/resolveUserAiTier", () => ({ resolveUserAiTier: vi.fn(() => "free") }));

import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

beforeEach(() => {
  vi.mocked(resolveUserAiTier).mockReturnValue("free");
});

import { QuotaExceededError } from "./QuotaExceededError";
import {
  GenerationInProgressError,
  commitGenerationQuota,
  getGenerationQuotaAvailability,
  releaseGenerationQuota,
  reserveGenerationQuota,
} from "./generationQuotaReservation";

function createRpcSupabase(rpc: ReturnType<typeof vi.fn>) {
  return { rpc };
}

describe("reserveGenerationQuota", () => {
  it("returns reservation token only from reserved RPC result for free users", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: "reserved",
        reservationToken: "token-abc",
        usedBonus: false,
        reservationExpiresAt: "2026-07-30T06:00:00.000Z",
      },
      error: null,
    });

    await expect(
      reserveGenerationQuota({
        supabase: createRpcSupabase(rpc),
        user: { id: "user-1" } as never,
        studySetId: "set-1",
        contentKind: "quiz",
      }),
    ).resolves.toEqual({
      kind: "reserved",
      reservationToken: "token-abc",
      usedBonus: false,
      reservationExpiresAt: "2026-07-30T06:00:00.000Z",
    });

    expect(rpc).toHaveBeenCalledWith("reserve_generation_quota", {
      p_study_set_id: "set-1",
      p_content_kind: "quiz",
    });
  });

  it("does not call reservation RPC for pro users", async () => {
    vi.mocked(resolveUserAiTier).mockReturnValue("pro");
    const rpc = vi.fn();

    await expect(
      reserveGenerationQuota({
        supabase: createRpcSupabase(rpc),
        user: { id: "user-1" } as never,
        studySetId: "set-1",
        contentKind: "flashcards",
      }),
    ).resolves.toEqual({ kind: "already_committed", usedBonus: false });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps quota_exceeded to QuotaExceededError with unchanged details", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: "quota_exceeded",
        weeklyUsed: 10,
        weeklyLimit: 10,
        bonusCredits: 0,
        weekResetsAt: "2026-08-02T17:00:00.000Z",
      },
      error: null,
    });

    await expect(
      reserveGenerationQuota({
        supabase: createRpcSupabase(rpc),
        user: { id: "user-1" } as never,
        studySetId: "set-1",
        contentKind: "quiz",
      }),
    ).rejects.toEqual(
      new QuotaExceededError({
        weeklyUsed: 10,
        weeklyLimit: 10,
        bonusCredits: 0,
        weekResetsAt: "2026-08-02T17:00:00.000Z",
      }),
    );
  });

  it("permits free regeneration from already_committed without a token", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "already_committed", usedBonus: true },
      error: null,
    });

    await expect(
      reserveGenerationQuota({
        supabase: createRpcSupabase(rpc),
        user: { id: "user-1" } as never,
        studySetId: "set-1",
        contentKind: "quiz",
      }),
    ).resolves.toEqual({ kind: "already_committed", usedBonus: true });
  });

  it("throws GenerationInProgressError for active duplicate work", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: "generation_in_progress",
        reservationExpiresAt: "2026-07-30T06:07:00.000Z",
      },
      error: null,
    });

    await expect(
      reserveGenerationQuota({
        supabase: createRpcSupabase(rpc),
        user: { id: "user-1" } as never,
        studySetId: "set-1",
        contentKind: "quiz",
      }),
    ).rejects.toEqual(new GenerationInProgressError("2026-07-30T06:07:00.000Z"));
  });

  it("rejects invalid RPC payloads", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "mystery" }, error: null });

    await expect(
      reserveGenerationQuota({
        supabase: createRpcSupabase(rpc),
        user: { id: "user-1" } as never,
        studySetId: "set-1",
        contentKind: "quiz",
      }),
    ).rejects.toThrow(/invalid reserve_generation_quota/i);
  });

  it("propagates RPC failures", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });

    await expect(
      reserveGenerationQuota({
        supabase: createRpcSupabase(rpc),
        user: { id: "user-1" } as never,
        studySetId: "set-1",
        contentKind: "quiz",
      }),
    ).rejects.toThrow("db down");
  });
});

describe("commitGenerationQuota", () => {
  it("commits opaque reservation token via RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "committed", usedBonus: false },
      error: null,
    });

    await expect(
      commitGenerationQuota({ supabase: createRpcSupabase(rpc), reservationToken: "token-abc" }),
    ).resolves.toEqual({ status: "committed", usedBonus: false });

    expect(rpc).toHaveBeenCalledWith("commit_generation_quota", {
      p_reservation_token: "token-abc",
    });
  });

  it("propagates commit RPC failures", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "commit failed" } });

    await expect(
      commitGenerationQuota({ supabase: createRpcSupabase(rpc), reservationToken: "token-abc" }),
    ).rejects.toThrow("commit failed");
  });
});

describe("releaseGenerationQuota", () => {
  it("releases opaque reservation token via RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "released", usedBonus: true },
      error: null,
    });

    await expect(
      releaseGenerationQuota({ supabase: createRpcSupabase(rpc), reservationToken: "token-abc" }),
    ).resolves.toEqual({ status: "released", usedBonus: true });

    expect(rpc).toHaveBeenCalledWith("release_generation_quota", {
      p_reservation_token: "token-abc",
    });
  });

  it("propagates release RPC failures", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "release failed" } });

    await expect(
      releaseGenerationQuota({ supabase: createRpcSupabase(rpc), reservationToken: "token-abc" }),
    ).rejects.toThrow("release failed");
  });
});

describe("getGenerationQuotaAvailability", () => {
  it("returns availability counters from RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: "available",
        canGenerate: true,
        weeklyUsed: 3,
        weeklyLimit: 10,
        bonusCredits: 2,
        weekResetsAt: "2026-08-02T17:00:00.000Z",
      },
      error: null,
    });

    await expect(
      getGenerationQuotaAvailability({ supabase: createRpcSupabase(rpc), studySetId: "set-1" }),
    ).resolves.toEqual({
      status: "available",
      canGenerate: true,
      weeklyUsed: 3,
      weeklyLimit: 10,
      bonusCredits: 2,
      weekResetsAt: "2026-08-02T17:00:00.000Z",
    });

    expect(rpc).toHaveBeenCalledWith("get_generation_quota_availability", {
      p_study_set_id: "set-1",
    });
  });

  it("rejects invalid availability payloads", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "available" }, error: null });

    await expect(
      getGenerationQuotaAvailability({ supabase: createRpcSupabase(rpc), studySetId: "set-1" }),
    ).rejects.toThrow(/invalid get_generation_quota_availability/i);
  });
});
