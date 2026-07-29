import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/resolveUserAiTier", () => ({ resolveUserAiTier: vi.fn(() => "free") }));

import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

import { recordQuotaConsumption } from "./recordQuotaConsumption";

function createSupabase() {
  const insert = vi.fn(async () => ({ error: null }));
  const upsert = vi.fn(async () => ({ error: null }));
  const update = vi.fn(async () => ({ error: null }));
  return {
    insert,
    upsert,
    update,
    rpc: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === "quota_consumptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          })),
          insert,
          update,
        };
      }
      return { upsert, update };
    }),
  };
}

describe("recordQuotaConsumption", () => {
  it("does not insert or mutate quota tables for free users", async () => {
    const supabase = createSupabase();

    await recordQuotaConsumption({
      supabase,
      user: { id: "user-1" } as never,
      studySetId: "set-1",
      contentKind: "quiz",
    });

    expect(supabase.insert).not.toHaveBeenCalled();
    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(supabase.update).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("skips work for pro users without touching quota tables", async () => {
    vi.mocked(resolveUserAiTier).mockReturnValue("pro");
    const supabase = createSupabase();

    await recordQuotaConsumption({
      supabase,
      user: { id: "user-1" } as never,
      studySetId: "set-1",
      contentKind: "quiz",
    });

    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
