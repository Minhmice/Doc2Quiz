import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  blockUser,
  listBlockedUsers,
  listAcceptedFriendPage,
  listFriendRequests,
  mapSocialHttpError,
  reportUser,
  sendFriendRequest,
  unblockUser,
  updateProfileUsername,
  UsernameTakenClientError,
} from "./friends";

const REQUEST_ID = "00000000-0000-4000-8000-000000000010";
const USER_ID = "00000000-0000-4000-8000-000000000011";

describe("mapSocialHttpError", () => {
  it("maps 401, 403, and 404 to the same generic message", () => {
    const message = "Social settings are unavailable.";
    for (const status of [401, 403, 404]) {
      const error = mapSocialHttpError(status, message);
      expect(error.message).toBe(message);
      expect(error.message).not.toMatch(/401|403|404|forbidden|not_found/i);
    }
  });
});

describe("social safety client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates username with allowed body fields only", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { username: "alice" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await updateProfileUsername("alice");
    expect(result.username).toBe("alice");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ username: "alice" }),
      }),
    );
  });

  it("throws UsernameTakenClientError on 409 username collision", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "username_taken" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(updateProfileUsername("alice")).rejects.toBeInstanceOf(
      UsernameTakenClientError,
    );
  });

  it("sends friend requests with username only", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await sendFriendRequest("bob");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/friends/requests",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "bob" }),
      }),
    );
  });

  it("maps unavailable friend send responses to generic errors", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "request_unavailable" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(sendFriendRequest("ghost")).rejects.toThrow(
      "Friend request could not be sent. Check the username and try again.",
    );
  });

  it("exposes retry metadata on 429 without recipient disclosure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name === "Retry-After" ? "120" : null) },
      json: async () => ({ error: "rate_limited" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(sendFriendRequest("bob")).rejects.toMatchObject({
      name: "SocialRateLimitedError",
      retryAfterSeconds: 120,
    });
  });

  it("requests each accepted-friend bucket with server cursor and enum DTO", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { items: [{ userId: USER_ID, username: "bob", presence: "recently_active" }], nextCursor: "next", hasMore: true } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const online = await listAcceptedFriendPage("online");
    const offline = await listAcceptedFriendPage("offline", "cursor-offline");

    expect(online.items[0].presence).toBe("recently_active");
    expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/friends?limit=20&presence=online", undefined);
    expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/friends?limit=20&presence=offline&cursor=cursor-offline", undefined);
  });

  it("lists friend requests and blocked users from protected APIs", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            requests: [
              {
                id: REQUEST_ID,
                direction: "incoming",
                otherUserId: USER_ID,
                otherUsername: "bob",
                status: "pending",
                createdAt: "2026-01-01",
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            blocks: [{ userId: USER_ID, username: "bob", blockedAt: "2026-01-02" }],
          },
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const requests = await listFriendRequests();
    const blocks = await listBlockedUsers();

    expect(requests).toHaveLength(1);
    expect(blocks).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/friends/requests", undefined);
    expect(mockFetch).toHaveBeenCalledWith("/api/friends/blocks", undefined);
  });

  it("blocks and unblocks with userId only", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await blockUser(USER_ID);
    await unblockUser(USER_ID);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/friends/blocks",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: USER_ID }),
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/friends/blocks",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ userId: USER_ID }),
      }),
    );
  });

  it("returns acknowledgement-only report results", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await reportUser(USER_ID, "spam", "details");

    expect(result).toEqual({ ok: true });
    expect(Object.keys(result)).toEqual(["ok"]);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/friends/reports",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: USER_ID, reason: "spam", details: "details" }),
      }),
    );
  });
});
