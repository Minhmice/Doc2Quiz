import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUserMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({ requireApiUser: () => requireApiUserMock() }));
vi.mock("@/lib/server/friends/friends", () => ({ mapSocialRouteError: () => null, setProfileUsername: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => createSupabaseAdminClientMock() }));

import { PROFILE_IMAGE_MAX_BYTES } from "@/lib/profile/profileValidation";
import { GET, PATCH, POST } from "./route";

const userId = "00000000-0000-4000-8000-000000000001";
const avatarPath = `${userId}/profile/avatar.gif`;

function profileClient() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { display_name: "Student", avatar_path: avatarPath }, error: null });
  const profileSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
  const setsOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const setsSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: setsOrder }) });
  return { from: vi.fn((table: string) => ({ select: table === "profiles" ? profileSelect : setsSelect })) };
}

describe("GET /api/profile avatar response", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns admin-signed avatar URL without raw storage path", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/avatar.gif" }, error: null });
    createSupabaseAdminClientMock.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } });
    requireApiUserMock.mockResolvedValue({ supabase: profileClient(), user: { id: userId, email: "student@example.com" } });

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.avatarUrl).toMatch(/^https:\/\/signed\.example\/avatar\.gif\?v=\d+$/);
    expect(body.data.avatarStatus).toBe("available");
    expect(createSignedUrl).toHaveBeenCalledWith(avatarPath, 5 * 60);
    expect(JSON.stringify(body)).not.toContain("avatar_path");
    expect(JSON.stringify(body)).not.toContain(avatarPath);
  });

  it("refuses to admin-sign a non-canonical or foreign stored path", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { display_name: "Student", avatar_path: "other-user/private.txt" }, error: null });
    const profileSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
    const setsOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const setsSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: setsOrder }) });
    requireApiUserMock.mockResolvedValue({
      supabase: { from: vi.fn((table: string) => ({ select: table === "profiles" ? profileSelect : setsSelect })) },
      user: { id: userId, email: "student@example.com" },
    });

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.avatarUrl).toBeNull();
    expect(body.data.avatarStatus).toBe("avatar_unavailable");
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("reports signed URL failure without exposing storage path", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: null, error: new Error("denied") });
    createSupabaseAdminClientMock.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } });
    requireApiUserMock.mockResolvedValue({ supabase: profileClient(), user: { id: userId, email: "student@example.com" } });

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.avatarUrl).toBeNull();
    expect(body.data.avatarStatus).toBe("avatar_unavailable");
    expect(JSON.stringify(body)).not.toContain(avatarPath);
  });
});

describe("POST /api/profile avatar upload", () => {
  beforeEach(() => vi.clearAllMocks());

  function adminClient(uploadError: unknown = null, signedUrl: string | null = "https://signed.example/avatar.png?token=test") {
    const upload = vi.fn().mockResolvedValue({ error: uploadError });
    const createSignedUrl = vi.fn().mockResolvedValue(signedUrl ? { data: { signedUrl }, error: null } : { data: null, error: new Error("signing denied") });
    const storageFrom = vi.fn().mockReturnValue({ upload, createSignedUrl });
    return { client: { storage: { from: storageFrom } }, upload, createSignedUrl, storageFrom };
  }

  function authenticatedClient(persistError: unknown = null) {
    const upsert = vi.fn().mockResolvedValue({ error: persistError });
    const from = vi.fn().mockReturnValue({ upsert });
    return { client: { from }, upsert };
  }

  function avatarRequest(file: File) {
    const form = new FormData();
    form.set("file", file);
    form.set("userId", "ffffffff-ffff-4fff-8fff-ffffffffffff");
    form.set("path", "other-user/profile/avatar.png");
    return new Request("http://localhost/api/profile", { method: "POST", body: form });
  }

  it("requires authenticated user before creating admin client", async () => {
    const unauthorized = new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    requireApiUserMock.mockResolvedValue({ error: unauthorized });

    const response = (await POST(avatarRequest(new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], "avatar.png", { type: "image/png" })))) as Response;

    expect(response.status).toBe(401);
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported, oversized, and spoofed files before admin upload", async () => {
    requireApiUserMock.mockResolvedValue({ supabase: authenticatedClient().client, user: { id: userId, email: "student@example.com" } });

    const unsupported = await POST(avatarRequest(new File(["<svg/>"], "avatar.svg", { type: "image/svg+xml" }))) as Response;
    const oversized = await POST(avatarRequest(new File([new Uint8Array(PROFILE_IMAGE_MAX_BYTES)], "avatar.png", { type: "image/png" }))) as Response;
    const spoofed = await POST(avatarRequest(new File(["not png"], "avatar.png", { type: "image/png" }))) as Response;

    expect([unsupported.status, oversized.status, spoofed.status]).toEqual([400, 400, 400]);
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("derives canonical user path server-side, uploads privately, then persists it", async () => {
    const admin = adminClient();
    const authenticated = authenticatedClient();
    createSupabaseAdminClientMock.mockReturnValue(admin.client);
    requireApiUserMock.mockResolvedValue({ supabase: authenticated.client, user: { id: userId, email: "student@example.com" } });
    const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const response = (await POST(avatarRequest(new File([bytes], "anything.png", { type: "image/png" })))) as Response;

    expect(response.status).toBe(200);
    expect(admin.storageFrom).toHaveBeenCalledWith("doc2quiz");
    expect(admin.upload).toHaveBeenCalledWith(`${userId}/profile/avatar.png`, expect.any(Uint8Array), {
      contentType: "image/png",
      upsert: true,
      cacheControl: "3600",
    });
    expect(authenticated.upsert).toHaveBeenCalledWith({ id: userId, avatar_path: `${userId}/profile/avatar.png` });
    expect(admin.createSignedUrl).toHaveBeenCalledWith(`${userId}/profile/avatar.png`, 5 * 60);
    expect((await response.json()).data.avatarUrl).toMatch(/^https:\/\/signed\.example\/avatar\.png\?token=test&v=\d+$/);
    expect(admin.upload.mock.invocationCallOrder[0]).toBeLessThan(authenticated.upsert.mock.invocationCallOrder[0]);
  });

  it("returns a stage-specific error when post-upload signing fails", async () => {
    const admin = adminClient(null, null);
    const authenticated = authenticatedClient();
    createSupabaseAdminClientMock.mockReturnValue(admin.client);
    requireApiUserMock.mockResolvedValue({ supabase: authenticated.client, user: { id: userId, email: "student@example.com" } });
    const file = new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], "avatar.png", { type: "image/png" });

    const response = await POST(avatarRequest(file)) as Response;

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Avatar saved, but private preview is unavailable" });
    expect(authenticated.upsert).toHaveBeenCalledWith({ id: userId, avatar_path: `${userId}/profile/avatar.png` });
  });

  it("does not persist when Storage upload fails", async () => {
    const admin = adminClient(new Error("storage denied"));
    const authenticated = authenticatedClient();
    createSupabaseAdminClientMock.mockReturnValue(admin.client);
    requireApiUserMock.mockResolvedValue({ supabase: authenticated.client, user: { id: userId, email: "student@example.com" } });
    const file = new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], "avatar.png", { type: "image/png" });

    const response = await POST(avatarRequest(file)) as Response;

    expect(response.status).toBe(502);
    expect(authenticated.upsert).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/profile avatar contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects all client-supplied avatar paths", async () => {
    const from = vi.fn();
    requireApiUserMock.mockResolvedValue({ supabase: { from }, user: { id: userId, email: "student@example.com" } });

    const response = (await PATCH(new Request("http://localhost/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarPath }),
    }))) as Response;

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Avatar path cannot be updated directly" });
    expect(from).not.toHaveBeenCalled();
  });
});
