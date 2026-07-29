import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/resolveUserAiTier", () => ({ resolveUserAiTier: vi.fn(() => "free") }));
vi.mock("./getUserUsage", () => ({ getUserUsage: vi.fn() }));

import { getUserUsage } from "./getUserUsage";
import { recordQuotaConsumption } from "./recordQuotaConsumption";

function createSupabase(existing: unknown = null) {
  const insert = vi.fn(async () => ({ error: null }));
  const upsert = vi.fn(async () => ({ error: null }));
  return {
    insert,
    upsert,
    from: vi.fn((table: string) => {
      if (table === "quota_consumptions") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: existing, error: null })) })) })) })),
          insert,
        };
      }
      return { upsert };
    }),
  };
}

describe("recordQuotaConsumption", () => {
  it("records weekly generation without wallet mutation", async () => {
    vi.mocked(getUserUsage).mockResolvedValue({ plan: "free", weeklyUsed: 9, weeklyLimit: 10, weeklyRemaining: 1, bonusCredits: 2, weekResetsAt: "", });
    const supabase = createSupabase();

    await recordQuotaConsumption({ supabase, user: { id: "user-1" } as never, studySetId: "set-1", contentKind: "quiz" });

    expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({ used_bonus: false }));
    expect(supabase.upsert).not.toHaveBeenCalled();
  });

  it("uses bonus after weekly limit", async () => {
    vi.mocked(getUserUsage).mockResolvedValue({ plan: "free", weeklyUsed: 10, weeklyLimit: 10, weeklyRemaining: 0, bonusCredits: 2, weekResetsAt: "", });
    const supabase = createSupabase();

    await recordQuotaConsumption({ supabase, user: { id: "user-1" } as never, studySetId: "set-1", contentKind: "quiz" });

    expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({ used_bonus: true }));
    expect(supabase.upsert).toHaveBeenCalledWith(expect.objectContaining({ bonus_credits: 1 }));
  });

  it("skips duplicate study set", async () => {
    const supabase = createSupabase({ id: "existing" });

    await recordQuotaConsumption({ supabase, user: { id: "user-1" } as never, studySetId: "set-1", contentKind: "quiz" });

    expect(supabase.insert).not.toHaveBeenCalled();
  });
});
