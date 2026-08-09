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
const removeFriendMock = vi.fn();
const unblockUserMock = vi.fn();
const reportUserMock = vi.fn();
const listSocialFriendsMock = vi.fn();
const listSocialRequestsMock = vi.fn();
const listSocialBlocksMock = vi.fn();
const broadcastSocialEventMock = vi.fn();
const getRedisMock = vi.fn();
const touchPresenceMock = vi.fn();
const checkRateLimitMock = vi.fn();
const getPresenceSnapshotMock = vi.fn();
const enqueueMeaningfulActivityMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

vi.mock("@/lib/server/friends/realtimeBroadcast", () => ({
  broadcastSocialEvent: (...args: unknown[]) => broadcastSocialEventMock(...args),
}));

vi.mock("@/lib/server/redis/client", () => ({ getRedis: () => getRedisMock() }));
vi.mock("@/lib/server/social/presence", () => ({ touchPresence: (...args: unknown[]) => touchPresenceMock(...args) }));
vi.mock("@/lib/server/social/presenceSnapshot", () => ({ getPresenceSnapshot: (...args: unknown[]) => getPresenceSnapshotMock(...args) }));
vi.mock("@/lib/server/social/rateLimit", () => ({ checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args) }));
vi.mock("@/lib/server/social/activityProducer", () => ({ enqueueMeaningfulActivity: (...args: unknown[]) => enqueueMeaningfulActivityMock(...args) }));

vi.mock("@/lib/server/friends/socialLists", () => ({
  listSocialFriends: (...args: unknown[]) => listSocialFriendsMock(...args),
  listSocialRequests: (...args: unknown[]) => listSocialRequestsMock(...args),
  listSocialBlocks: (...args: unknown[]) => listSocialBlocksMock(...args),
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
    removeFriend: (...args: unknown[]) => removeFriendMock(...args),
    unblockUser: (...args: unknown[]) => unblockUserMock(...args),
    reportUser: (...args: unknown[]) => reportUserMock(...args),
  };
});

import { PATCH as patchProfile } from "@/app/api/profile/route";
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
import { DELETE as deleteFriend } from "@/app/api/friends/[userId]/route";
import { GET as getFriends } from "@/app/api/friends/route";

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
  describe("GET /api/friends", () => {
    it("authenticates before parsing and defaults to offline bucket", async () => {
      const response = (await getFriends(new Request("http://localhost/api/friends"))) as Response;

      expect(response.status).toBe(200);
      expect(listSocialFriendsMock).toHaveBeenCalledWith(supabase, 20, null, "offline");
    });

    it("accepts explicit online and offline buckets", async () => {
      await getFriends(new Request("http://localhost/api/friends?presence=online&limit=7&cursor=opaque"));
      expect(listSocialFriendsMock).toHaveBeenCalledWith(supabase, 7, "opaque", "online");

      listSocialFriendsMock.mockClear();
      await getFriends(new Request("http://localhost/api/friends?presence=offline"));
      expect(listSocialFriendsMock).toHaveBeenCalledWith(supabase, 20, null, "offline");
    });

    it("rejects invalid presence before the adapter and keeps auth first", async () => {
      const authOrder: string[] = [];
      requireApiUserMock.mockImplementationOnce(async () => {
        authOrder.push("auth");
        return { supabase, user: { id: "user-1" } };
      });

      const response = (await getFriends(new Request("http://localhost/api/friends?presence=recently_active"))) as Response;
      authOrder.push("after");

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid" });
      expect(listSocialFriendsMock).not.toHaveBeenCalled();
      expect(authOrder).toEqual(["auth", "after"]);
    });

    it("returns 401 before parsing untrusted query data", async () => {
      requireApiUserMock.mockResolvedValueOnce({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });

      const response = (await getFriends(new Request("http://localhost/api/friends?presence=invalid"))) as Response;
      expect(response.status).toBe(401);
      expect(listSocialFriendsMock).not.toHaveBeenCalled();
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase,
      user: { id: "user-1", email: "student@example.com" },
    });
    setProfileUsernameMock.mockResolvedValue({ username: "alice" });
    sendFriendRequestMock.mockResolvedValue({ ok: true, requestId });
    listFriendRequestsMock.mockResolvedValue({ requests: [] });
    listSocialRequestsMock.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    listSocialBlocksMock.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    respondFriendRequestMock.mockResolvedValue({ ok: true });
    cancelFriendRequestMock.mockResolvedValue({ ok: true });
    blockUserMock.mockResolvedValue({ ok: true });
    removeFriendMock.mockResolvedValue({ ok: true });
    unblockUserMock.mockResolvedValue({ ok: true });
    listSocialFriendsMock.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    reportUserMock.mockResolvedValue({ ok: true });
    broadcastSocialEventMock.mockResolvedValue(true);
    getRedisMock.mockResolvedValue({ state: "ready", redis: { tag: "redis" } });
    touchPresenceMock.mockResolvedValue({ state: "ready" });
    checkRateLimitMock.mockResolvedValue({ allowed: true });
    getPresenceSnapshotMock.mockReturnValue({ snapshot: vi.fn().mockImplementation((page) => page) });
    enqueueMeaningfulActivityMock.mockResolvedValue({});
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

    it("saves onboarding fields with numeric version", async () => {
      const single = vi.fn().mockResolvedValue({
        data: {
          display_name: "Name",
          bio: null,
          avatar_path: null,
          username: null,
          onboarding_version: 1,
          onboarding_completed_at: "2026-07-31T00:00:00.000Z",
          coach_mode: "balanced",
          study_identity: "university",
          commitment: "serious",
          preferred_study_time: null,
        },
        error: null,
      });
      const select = vi.fn().mockReturnValue({ single });
      const upsert = vi.fn().mockReturnValue({ select });
      requireApiUserMock.mockResolvedValue({
        supabase: { ...supabase, from: vi.fn().mockReturnValue({ upsert }) },
        user: { id: "user-1", email: "student@example.com" },
      });

      const response = (await patchProfile(
        jsonRequest("http://localhost/api/profile", "PATCH", {
          displayName: "Name",
          onboardingVersion: 1,
          onboardingCompleted: true,
          coachMode: "balanced",
          studyIdentity: "university",
          commitment: "serious",
        }),
      )) as Response;

      expect(response.status).toBe(200);
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        id: "user-1",
        onboarding_version: 1,
        coach_mode: "balanced",
        study_identity: "university",
        commitment: "serious",
      }));
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

    it("lists pending requests with bounded pagination", async () => {
      listSocialRequestsMock.mockResolvedValue({
        items: [{ requestId, otherUserId, username: "bob", createdAt: "2026-07-30T00:00:00.000Z" }],
        nextCursor: null,
        hasMore: false,
      });

      const response = (await getFriendRequests(new Request("http://localhost/api/friends/requests?direction=incoming"))) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          items: [{ requestId, otherUserId, username: "bob", createdAt: "2026-07-30T00:00:00.000Z" }],
          nextCursor: null,
          hasMore: false,
        },
      });
      expect(listSocialRequestsMock).toHaveBeenCalledWith(supabase, 20, null, "incoming");
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

  describe("DELETE /api/friends/[userId]", () => {
    it("removes an accepted friend without invoking block", async () => {
      const response = (await deleteFriend(
        new Request(`http://localhost/api/friends/${otherUserId}`, { method: "DELETE" }),
        { params: Promise.resolve({ userId: otherUserId }) },
      )) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { ok: true } });
      expect(removeFriendMock).toHaveBeenCalledWith(supabase, otherUserId);
      expect(blockUserMock).not.toHaveBeenCalled();
    });

    it("returns deterministic unavailable state for missing relationships", async () => {
      removeFriendMock.mockRejectedValue(new FriendRequestUnavailableError());

      const response = (await deleteFriend(
        new Request(`http://localhost/api/friends/${otherUserId}`, { method: "DELETE" }),
        { params: Promise.resolve({ userId: otherUserId }) },
      )) as Response;

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "request_unavailable" });
    });

    it("rejects unauthenticated, invalid, and self-target requests before mutation", async () => {
      requireApiUserMock.mockResolvedValueOnce({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
      expect(((await deleteFriend(new Request(`http://localhost/api/friends/${otherUserId}`, { method: "DELETE" }), { params: Promise.resolve({ userId: otherUserId }) })) as Response).status).toBe(401);

      requireApiUserMock.mockResolvedValueOnce({ supabase, user: { id: "00000000-0000-4000-8000-000000000099" } });
      expect(((await deleteFriend(new Request("http://localhost/api/friends/not-a-uuid", { method: "DELETE" }), { params: Promise.resolve({ userId: "not-a-uuid" }) })) as Response).status).toBe(400);

      requireApiUserMock.mockResolvedValueOnce({ supabase, user: { id: otherUserId } });
      expect(((await deleteFriend(new Request(`http://localhost/api/friends/${otherUserId}`, { method: "DELETE" }), { params: Promise.resolve({ userId: otherUserId }) })) as Response).status).toBe(400);
      expect(removeFriendMock).not.toHaveBeenCalled();
    });
  });

  describe("blocks", () => {
    it("lists blocked users with bounded pagination", async () => {
      listSocialBlocksMock.mockResolvedValue({
        items: [{ userId: otherUserId, username: "bob", blockedAt: "2026-07-30T00:00:00.000Z" }],
        nextCursor: null,
        hasMore: false,
      });

      const response = (await getBlocks(new Request("http://localhost/api/friends/blocks"))) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          items: [{ userId: otherUserId, username: "bob", blockedAt: "2026-07-30T00:00:00.000Z" }],
          nextCursor: null,
          hasMore: false,
        },
      });
      expect(listSocialBlocksMock).toHaveBeenCalledWith(supabase, 20, null);
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

  describe("Plan 11 social contracts", () => {
    it("returns a bounded friend page without unread side effects", async () => {
      listSocialFriendsMock.mockResolvedValue({
        items: [{ userId: otherUserId, username: "bob", avatarUrl: null, presence: "online", lastActiveAt: null, presenceRank: 0 }],
        nextCursor: null,
        hasMore: false,
      });
      const { GET } = await import("@/app/api/friends/route");

      const response = (await GET(new Request("http://localhost/api/friends?presence=online"))) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { items: [{ userId: otherUserId, username: "bob", avatarUrl: null, presence: "online", lastActiveAt: null, presenceRank: 0 }], nextCursor: null, hasMore: false } });
      expect(listSocialFriendsMock).toHaveBeenCalledWith(supabase, 20, null, "online");
    });

    it("returns signed friend avatars without raw paths", async () => {
      listSocialFriendsMock.mockResolvedValue({
        items: [
          { userId: otherUserId, username: "bob", avatarUrl: "https://signed.example/avatar.gif", presence: "online", lastActiveAt: null, presenceRank: 0 },
          { userId: requestId, username: "ann", avatarUrl: null, presence: "offline", lastActiveAt: "2026-07-30T00:00:00.000Z", presenceRank: 2 },
        ],
        nextCursor: null,
        hasMore: false,
      });
      const { GET } = await import("@/app/api/friends/route");

      const response = (await GET(new Request("http://localhost/api/friends"))) as Response;
      const body = await response.json();

      expect(body.data.items).toEqual([
        expect.objectContaining({ avatarUrl: "https://signed.example/avatar.gif", presence: "online" }),
        expect.objectContaining({ avatarUrl: null, presence: "offline" }),
      ]);
      expect(JSON.stringify(body)).not.toContain("avatarPath");
    });

    it("keeps message success when invalidation delivery fails", async () => {
      const message = { id: requestId, senderId: "user-1", recipientUserId: otherUserId, body: "hello", createdAt: "2026-07-30T00:00:00.000Z" };
      const rpc = vi.fn().mockResolvedValue({ data: message, error: null });
      requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });
      broadcastSocialEventMock.mockResolvedValue(false);
      const { POST: sendMessage } = await import("@/app/api/friends/messages/[conversationId]/route");

      const response = (await sendMessage(jsonRequest(`http://localhost/api/friends/messages/${requestId}`, "POST", { body: "hello" }), { params: Promise.resolve({ conversationId: requestId }) })) as Response;

      expect(response.status).toBe(200);
      expect(broadcastSocialEventMock).toHaveBeenCalledWith(`social-counts:${otherUserId}`, "invalidate", { source: "message" });
    });

    it("emits request invalidation after durable request creation", async () => {
      sendFriendRequestMock.mockResolvedValue({ ok: true, requestId });
      listFriendRequestsMock.mockResolvedValue({ requests: [{ id: requestId, direction: "outgoing", otherUserId }] });

      const response = (await postFriendRequest(jsonRequest("http://localhost/api/friends/requests", "POST", { username: "bob" }))) as Response;

      expect(response.status).toBe(200);
      expect(broadcastSocialEventMock).toHaveBeenCalledWith(`social-requests:${otherUserId}`, "invalidate", { source: "friend-request" });
    });

    it("rejects malformed messages and arbitrary reactions", async () => {
      const { POST: sendMessage } = await import("@/app/api/friends/messages/[conversationId]/route");
      const { POST: sendReaction } = await import("@/app/api/friends/reactions/route");

      const messageResponse = (await sendMessage(jsonRequest("http://localhost/api/friends/messages/bad", "POST", { body: "x".repeat(2001) }), { params: Promise.resolve({ conversationId: "bad" }) })) as Response;
      const reactionResponse = (await sendReaction(jsonRequest("http://localhost/api/friends/reactions", "POST", { recipientUserId: otherUserId, reactionId: "free_text" }))) as Response;

      expect(messageResponse.status).toBe(400);
      expect(reactionResponse.status).toBe(400);
    });

    it("broadcasts approved reaction and message only on authorized topics", async () => {
      const message = { id: requestId, senderId: "user-1", body: "hello", createdAt: "2026-07-30T00:00:00.000Z" };
      const rpc = vi.fn().mockResolvedValueOnce({ data: message, error: null }).mockResolvedValueOnce({ data: { recipientUserId: otherUserId, senderId: "user-1", reactionId: "xin_chao" }, error: null });
      requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });
      const { POST: sendMessage } = await import("@/app/api/friends/messages/[conversationId]/route");
      const { POST: sendReaction } = await import("@/app/api/friends/reactions/route");

      const messageResponse = (await sendMessage(jsonRequest(`http://localhost/api/friends/messages/${requestId}`, "POST", { body: "hello" }), { params: Promise.resolve({ conversationId: requestId }) })) as Response;
      const reactionResponse = (await sendReaction(jsonRequest("http://localhost/api/friends/reactions", "POST", { recipientUserId: otherUserId, reactionId: "xin_chao" }))) as Response;

      expect(messageResponse.status).toBe(200);
      expect(reactionResponse.status).toBe(200);
      expect(broadcastSocialEventMock).toHaveBeenNthCalledWith(1, `social-messages:${requestId}`, "message", { source: "message" });
      expect(broadcastSocialEventMock).toHaveBeenNthCalledWith(2, `social-reactions:${otherUserId}`, "reaction", { reactionId: "xin_chao" });
    });


    it("hides social authorization state", async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "social_unavailable" } });
      requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });
      const { POST: openConversation } = await import("@/app/api/friends/messages/route");

      const response = (await openConversation(jsonRequest("http://localhost/api/friends/messages", "POST", { userId: otherUserId }))) as Response;

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "social_unavailable" });
    });

    it("resolves username profile URLs before public profile RPC", async () => {
      const rpc = vi.fn()
        .mockResolvedValueOnce({ data: { userId: otherUserId }, error: null })
        .mockResolvedValueOnce({ data: { displayName: "Bob", username: "minhdoan", bio: "Studying", avatarPath: null }, error: null });
      requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });
      const { GET: getFriendProfile } = await import("@/app/api/friends/profile/[userId]/route");

      const response = (await getFriendProfile(new Request("http://localhost/api/friends/profile/minhdoan"), { params: Promise.resolve({ userId: "minhdoan" }) })) as Response;

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenNthCalledWith(1, "resolve_profile_user", { p_username: "minhdoan" });
      expect(rpc).toHaveBeenNthCalledWith(2, "get_public_profile", { p_user_id: otherUserId });
    });

    it("returns public identity fields without learning progress", async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: { displayName: "Bob", username: "bob", bio: "Studying", avatarPath: null },
        error: null,
      });
      const storage = { from: vi.fn().mockReturnValue({ createSignedUrl: vi.fn() }) };
      requireApiUserMock.mockResolvedValue({ supabase: { rpc, storage }, user: { id: "user-1" } });
      const { GET: getFriendProfile } = await import("@/app/api/friends/profile/[userId]/route");

      const response = (await getFriendProfile(new Request(`http://localhost/api/friends/profile/${otherUserId}`), { params: Promise.resolve({ userId: otherUserId }) })) as Response;

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("get_public_profile", { p_user_id: otherUserId });
      expect(await response.json()).toEqual({ data: { displayName: "Bob", username: "bob", bio: "Studying", avatarUrl: null } });
    });

    it("keeps streaks and shared quizzes out of public profile responses", async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: { displayName: "Bob", username: "bob", bio: "Studying", avatarPath: `${otherUserId}/profile/avatar.gif`, currentStreak: 4, quizzes: [{ id: requestId, title: "Math", type: "quiz", questionCount: 3, updatedAt: "2026-07-30T00:00:00.000Z" }] },
        error: null,
      });
      const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/avatar.gif" }, error: null });
      requireApiUserMock.mockResolvedValue({ supabase: { rpc, storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }, user: { id: "user-1" } });
      const { GET: getFriendProfile } = await import("@/app/api/friends/profile/[userId]/route");

      const response = (await getFriendProfile(new Request(`http://localhost/api/friends/profile/${otherUserId}`), { params: Promise.resolve({ userId: otherUserId }) })) as Response;

      const body = await response.json();
      expect(body).toEqual({ data: { displayName: "Bob", username: "bob", bio: "Studying", avatarUrl: "https://signed.example/avatar.gif" } });
      expect(JSON.stringify(body)).not.toContain("currentStreak");
      expect(JSON.stringify(body)).not.toContain("quizzes");
      expect(JSON.stringify(body)).not.toContain("avatarPath");
    });

    it("keeps public identity available when avatar signing fails", async () => {
      const rpc = vi.fn().mockResolvedValue({ data: { displayName: "Bob", username: "bob", bio: "Studying", avatarPath: `${otherUserId}/profile/avatar.gif` }, error: null });
      const createSignedUrl = vi.fn().mockRejectedValue(new Error("storage down"));
      requireApiUserMock.mockResolvedValue({ supabase: { rpc, storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }, user: { id: "user-1" } });
      const { GET: getFriendProfile } = await import("@/app/api/friends/profile/[userId]/route");

      const response = (await getFriendProfile(new Request(`http://localhost/api/friends/profile/${otherUserId}`), { params: Promise.resolve({ userId: otherUserId }) })) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { displayName: "Bob", username: "bob", bio: "Studying", avatarUrl: null } });
    });

    it("keeps raw avatar paths out of signed URL requests", async () => {
      const rpc = vi.fn().mockResolvedValue({ data: { displayName: "Bob", avatarPath: "wrong/path.gif" }, error: null });
      const createSignedUrl = vi.fn();
      requireApiUserMock.mockResolvedValue({ supabase: { rpc, storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }, user: { id: "user-1" } });
      const { GET: getFriendProfile } = await import("@/app/api/friends/profile/[userId]/route");

      await getFriendProfile(new Request(`http://localhost/api/friends/profile/${otherUserId}`), { params: Promise.resolve({ userId: otherUserId }) });

      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    it("does not disclose unavailable friend profiles", async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "social_unavailable" } });
      requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });
      const { GET: getFriendProfile } = await import("@/app/api/friends/profile/[userId]/route");

      const response = (await getFriendProfile(new Request(`http://localhost/api/friends/profile/${otherUserId}`), { params: Promise.resolve({ userId: otherUserId }) })) as Response;

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "social_unavailable" });
    });

    it("enqueues one meaningful presence transition after Redis activity touch", async () => {
      const rpc = vi.fn();
      requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });
      const { POST: touchActivity } = await import("@/app/api/friends/activity/route");

      expect((await touchActivity(new Request("http://localhost/api/friends/activity", { method: "POST" }))).status).toBe(204);
      expect(touchPresenceMock).toHaveBeenCalledWith("user-1", "compat_user-1", "idle", { tag: "redis" });
      expect(enqueueMeaningfulActivityMock).toHaveBeenCalledWith({ tag: "redis" }, { userId: "user-1", activityKind: "presence_transition", source: "heartbeat" });
      expect(rpc).not.toHaveBeenCalled();
    });

    it("returns degraded activity response without durable RPC", async () => {
      const rpc = vi.fn();
      requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });
      getRedisMock.mockResolvedValue({ state: "disabled", redis: null });
      const { POST: touchActivity } = await import("@/app/api/friends/activity/route");

      const response = await touchActivity(new Request("http://localhost/api/friends/activity", { method: "POST" }));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "social_degraded", state: "unknown" });
      expect(rpc).not.toHaveBeenCalled();
    });

    it("returns 401 before social RPCs", async () => {
      requireApiUserMock.mockResolvedValue({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
      const { POST: touchActivity } = await import("@/app/api/friends/activity/route");

      expect((await touchActivity(new Request("http://localhost/api/friends/activity", { method: "POST" }))).status).toBe(401);
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
