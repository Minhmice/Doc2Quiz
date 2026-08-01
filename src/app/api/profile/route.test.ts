import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUserMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({ requireApiUser: () => requireApiUserMock() }));
vi.mock("@/lib/server/friends/friends", () => ({ mapSocialRouteError: () => null, setProfileUsername: vi.fn() }));

import { GET } from "./route";

const userId = "00000000-0000-4000-8000-000000000001";
const avatarPath = `${userId}/profile/avatar.gif`;

function profileClient(createSignedUrl: ReturnType<typeof vi.fn>) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { display_name: "Student", avatar_path: avatarPath }, error: null });
  const profileSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
  const setsOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const setsSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: setsOrder }) });
  return {
    from: vi.fn((table: string) => ({ select: table === "profiles" ? profileSelect : setsSelect })),
    storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) },
  };
}

describe("GET /api/profile avatar response", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns signed avatar URL without raw storage path", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/avatar.gif" }, error: null });
    requireApiUserMock.mockResolvedValue({ supabase: profileClient(createSignedUrl), user: { id: userId, email: "student@example.com" } });

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.avatarUrl).toBe("https://signed.example/avatar.gif");
    expect(body.data.avatarStatus).toBe("available");
    expect(JSON.stringify(body)).not.toContain("avatar_path");
    expect(JSON.stringify(body)).not.toContain(avatarPath);
  });

  it("reports signed URL failure without exposing storage path", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: null, error: new Error("denied") });
    requireApiUserMock.mockResolvedValue({ supabase: profileClient(createSignedUrl), user: { id: userId, email: "student@example.com" } });

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.avatarUrl).toBeNull();
    expect(body.data.avatarStatus).toBe("avatar_unavailable");
    expect(JSON.stringify(body)).not.toContain(avatarPath);
  });
});
