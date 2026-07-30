import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  FriendRateLimitedError,
  FriendRequestUnavailableError,
  UsernameTakenError,
} from "@/lib/server/friends/friends";

const requireApiUserMock = vi.fn();
const setProfileUsernameMock = vi.fn();
const sendFriendRequestMock = vi.fn();
const listFriendRequestsMock = vi.fn();
const respondFriendRequestMock = vi.fn();
const cancelFriendRequestMock = vi.fn();
const blockUserMock = vi.fn();
const unblockUserMock = vi.fn();
const listBlockedUsersMock = vi.fn();
const reportUserMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

vi.mock("@/lib/server/friends/friends", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/friends/friends")>();
  return {
    ...actual,
    setProfileUsername: (...args: unknown[]) => setProfileUsernameMock(...args),
    sendFriendRequest: (...args: unknown[]) => sendFriendRequestMock(...args),
    listFriendRequests: (...args: unknown[]) => listFriendRequestsMock(...args),
    respondFriendRequest: (...args: unknown[]) => respondFriendRequestMock(...args),
    cancelFriendRequest: (...args: unknown[]) => cancelFriendRequestMock(...args),
    blockUser: (...args: unknown[]) => blockUserMock(...args),
    unblockUser: (...args: unknown[]) => unblockUserMock(...args),
    listBlockedUsers: (...args: unknown[]) => listBlockedUsersMock(...args),
    reportUser: (...args: unknown[]) => reportUserMock(...args),
  };
});

import { GET as getProfile, PATCH as patchProfile } from "@/app/api/profile/route";
import {
  GET as getFriendRequests,
  POST as postFriendRequest,
} from "@/app/api/friends/requests/route";
import {
  DELETE as deleteFriendRequest,
  PATCH as patchFriendRequest,
} from "@/app/api/friends/requests/[id]/route";
import {
  DELETE as deleteBlock,
  GET as getBlocks,
  POST as postBlock,
} from "@/app/api/friends/blocks/route";
import { POST as postReport } from "@/app/api/friends/reports/route";

const supabase = { tag: "client" };
const requestId = "00000000-0000-4000-8000-000000000010";
const otherUserId = "00000000-0000-4000-8000-000000000011";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("social API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase,
      user: { id: "user-1", email: "student@example.com" },
    });
    setProfileUsernameMock.mockResolvedValue({ username: "alice" });
    sendFriendRequestMock.mockResolvedValue({ ok: true, requestId });
    listFriendRequestsMock.mockResolvedValue({ requests: [] });
    respondFriendRequestMock.mockResolvedValue({ ok: true });
    cancelFriendRequestMock.mockResolvedValue({ ok: true });
    blockUserMock.mockResolvedValue({ ok: true });
    unblockUserMock.mockResolvedValue({ ok: true });
    listBlockedUsersMock.mockResolvedValue({ blocks: [] });
    reportUserMock.mockResolvedValue({ ok: true });
  });

  describe("PATCH /api/profile", () => {
    it("sets username for the authenticated user", async () => {
      const response = (await patchProfile(
        jsonRequest("http://localhost/api/profile", "PATCH", { username: " Alice " }),
      )) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { username: "alice" } });
      expect(setProfileUsernameMock).toHaveBeenCalledWith(supabase, " Alice ");
    });

    it("returns 409 for normalized username collision without owner disclosure", async () => {
      setProfileUsernameMock.mockRejectedValue(new UsernameTakenError());

      const response = (await patchProfile(
        jsonRequest("http://localhost/api/profile", "PATCH", { username: "alice" }),
      )) as Response;

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "username_taken" });
    });

    it("preserves display name and bio updates", async () => {
      const upsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { display_name: "Name", bio: "Bio", avatar_path: null },
            error: null,
          }),
        }),
      });
      requireApiUserMock.mockResolvedValue({
        supabase: { ...supabase, from: vi.fn().mockReturnValue({ upsert }) },
        user: { id: "user-1", email: "student@example.com" },
      });

      const response = (await patchProfile(
        jsonRequest("http://localhost/api/profile", "PATCH", {
          displayName: "Name",
          bio: "Bio",
        }),
      )) as Response;

      expect(response.status).toBe(200);
      expect(setProfileUsernameMock).not.toHaveBeenCalled();
    });

    it("returns 401 when unauthenticated", async () => {
      requireApiUserMock.mockResolvedValue({
        error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      });

      const response = (await patchProfile(
        jsonRequest("http://localhost/api/profile", "PATCH", { username: "alice" }),
      )) as Response;
      expect(response.status).toBe(401);
    });
  });

  describe("friend requests", () => {
    it("returns 401 when unauthenticated", async () => {
      requireApiUserMock.mockResolvedValue({
        error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      });

      const response = (await postFriendRequest(
        jsonRequest("http://localhost/api/friends/requests", "POST", { username: "bob" }),
      )) as Response;
      expect(response.status).toBe(401);
    });

    it("returns 400 for invalid send body", async () => {
      const response = (await postFriendRequest(
        jsonRequest("http://localhost/api/friends/requests", "POST", { username: "" }),
      )) as Response;

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid" });
    });

    it("maps unknown recipients to generic unavailable", async () => {
      sendFriendRequestMock.mockRejectedValue(new FriendRequestUnavailableError());

      const response = (await postFriendRequest(
        jsonRequest("http://localhost/api/friends/requests", "POST", { username: "missing" }),
      )) as Response;

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "request_unavailable" });
    });

    it("maps rate limits to 429 with Retry-After", async () => {
      sendFriendRequestMock.mockRejectedValue(new FriendRateLimitedError(3600));

      const response = (await postFriendRequest(
        jsonRequest("http://localhost/api/friends/requests", "POST", { username: "bob" }),
      )) as Response;

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("3600");
      expect(await response.json()).toEqual({ error: "rate_limited" });
    });

    it("lists pending requests for the caller", async () => {
      listFriendRequestsMock.mockResolvedValue({
        requests: [
          {
            id: requestId,
            direction: "incoming",
            otherUserId,
            otherUsername: "bob",
            status: "pending",
            createdAt: "2026-07-30T00:00:00.000Z",
          },
        ],
      });

      const response = (await getFriendRequests()) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          requests: [
            {
              id: requestId,
              direction: "incoming",
              otherUserId,
              otherUsername: "bob",
              status: "pending",
              createdAt: "2026-07-30T00:00:00.000Z",
            },
          ],
        },
      });
    });

    it("responds to incoming requests", async () => {
      const response = (await patchFriendRequest(
        jsonRequest(`http://localhost/api/friends/requests/${requestId}`, "PATCH", { action: "accept" }),
        { params: Promise.resolve({ id: requestId }) },
      )) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { ok: true } });
      expect(respondFriendRequestMock).toHaveBeenCalledWith(supabase, requestId, "accept");
    });

    it("cancels outgoing requests", async () => {
      const response = (await deleteFriendRequest(
        new Request(`http://localhost/api/friends/requests/${requestId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: requestId }) },
      )) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { ok: true } });
      expect(cancelFriendRequestMock).toHaveBeenCalledWith(supabase, requestId);
    });
  });

  describe("blocks", () => {
    it("lists blocked users for the caller", async () => {
      listBlockedUsersMock.mockResolvedValue({
        blocks: [{ userId: otherUserId, username: "bob", blockedAt: "2026-07-30T00:00:00.000Z" }],
      });

      const response = (await getBlocks()) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          blocks: [{ userId: otherUserId, username: "bob", blockedAt: "2026-07-30T00:00:00.000Z" }],
        },
      });
    });

    it("blocks and unblocks by user id", async () => {
      const blockResponse = (await postBlock(
        jsonRequest("http://localhost/api/friends/blocks", "POST", { userId: otherUserId }),
      )) as Response;
      expect(blockResponse.status).toBe(200);
      expect(blockUserMock).toHaveBeenCalledWith(supabase, otherUserId);

      const unblockResponse = (await deleteBlock(
        jsonRequest("http://localhost/api/friends/blocks", "DELETE", { userId: otherUserId }),
      )) as Response;
      expect(unblockResponse.status).toBe(200);
      expect(unblockUserMock).toHaveBeenCalledWith(supabase, otherUserId);
    });
  });

  describe("reports", () => {
    it("returns acknowledgement only", async () => {
      const response = (await postReport(
        jsonRequest("http://localhost/api/friends/reports", "POST", {
          userId: otherUserId,
          reason: "spam",
          details: "details",
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ data: { ok: true } });
      expect(body.data).not.toHaveProperty("id");
      expect(body.data).not.toHaveProperty("reason");
    });

    it("returns 400 for invalid report body", async () => {
      const response = (await postReport(
        jsonRequest("http://localhost/api/friends/reports", "POST", {
          userId: otherUserId,
          reason: "",
        }),
      )) as Response;

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid" });
    });
  });
});
