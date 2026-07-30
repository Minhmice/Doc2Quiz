import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUserMock = vi.fn();
const getUserUsageMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));
vi.mock("@/lib/server/quota/getUserUsage", () => ({
  getUserUsage: (...args: unknown[]) => getUserUsageMock(...args),
}));

import { GET } from "./route";

describe("GET /api/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: { from: vi.fn() },
      user: { id: "user-1" },
    });
    getUserUsageMock.mockResolvedValue({
      plan: "free",
      weeklyUsed: 4,
      weeklyLimit: 10,
      weeklyRemaining: 6,
      bonusCredits: 3,
      weekResetsAt: "2026-08-02T17:00:00.000Z",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });
    const response = await GET(new Request("http://localhost/api/usage"));
    expect(response.status).toBe(401);
  });

  it("returns usage with study set preflight", async () => {
    const response = await GET(
      new Request("http://localhost/api/usage?studySetId=set-1"),
    );

    expect(response.status).toBe(200);
    expect(getUserUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ studySetId: "set-1" }),
    );
  });
});
