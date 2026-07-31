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
const listBlockedUsersMock = vi.fn();
const reportUserMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();
const broadcastSocialEventMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

vi.mock("@/lib/server/friends/realtimeBroadcast", () => ({
  broadcastSocialEvent: (...args: unknown[]) => broadcastSocialEventMock(...args),
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
import { DELETE as deleteFriend } from "@/app/api/friends/[userId]/route";

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
    removeFriendMock.mockResolvedValue({ ok: true });
    unblockUserMock.mockResolvedValue({ ok: true });
    listBlockedUsersMock.mockResolvedValue({ blocks: [] });
    reportUserMock.mockResolvedValue({ ok: true });
    broadcastSocialEventMock.mockResolvedValue(true);
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

  describe("Plan 11 social contracts", () => {
    it("returns isolated incoming-request and unread-message counts without marking either read", async () => {
      const rpc = vi.fn()
        .mockResolvedValueOnce({ data: { friends: [{ userId: otherUserId, username: "bob", isOnline: true, lastActiveAt: null, unreadCount: 2 }] }, error: null })
        .mockResolvedValueOnce({ data: { count: 1, requests: [{ id: requestId, userId: otherUserId, username: "bob", createdAt: "2026-07-30T00:00:00.000Z" }] }, error: null });
      requireApiUserMock.mockResolvedValue({ supabase: { rpc }, user: { id: "user-1" } });
      const { GET } = await import("@/app/api/friends/route");

      const response = (await GET()) as Response;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { friends: [{ userId: otherUserId, username: "bob", avatarUrl: null, isOnline: true, presence: "online", lastActiveAt: null, unreadCount: 2 }], incoming: { count: 1, requests: [{ id: requestId, userId: otherUserId, username: "bob", createdAt: "2026-07-30T00:00:00.000Z" }] }, incomingRequestCount: 1, unreadMessageCount: 2 } });
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc).not.toHaveBeenCalledWith("mark_direct_conversation_read", expect.anything());
    });

    it("returns safe avatar URLs and bounded presence vocabulary without raw paths", async () => {
      const rpc = vi.fn()
        .mockResolvedValueOnce({ data: { friends: [
          { userId: otherUserId, username: "bob", avatarPath: `${otherUserId}/profile/avatar.gif`, isOnline: true, lastActiveAt: null, unreadCount: 0 },
          { userId: requestId, username: "ann", avatarPath: "wrong/path.gif", isOnline: false, lastActiveAt: "2026-07-30T00:00:00.000Z", unreadCount: 0 },
        ] }, error: null })
        .mockResolvedValueOnce({ data: { count: 0, requests: [] }, error: null });
      const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/avatar.gif" }, error: null });
      requireApiUserMock.mockResolvedValue({ supabase: { rpc, storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }, user: { id: "user-1" } });
      const { GET } = await import("@/app/api/friends/route");

      const response = (await GET()) as Response;
      const body = await response.json();

      expect(body.data.friends).toEqual([
        expect.objectContaining({ avatarUrl: "https://signed.example/avatar.gif", presence: "online" }),
        expect.objectContaining({ avatarUrl: null, presence: "recently active" }),
      ]);
      expect(JSON.stringify(body)).not.toContain("avatarPath");
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
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
      expect(broadcastSocialEventMock).toHaveBeenNthCalledWith(1, `social-messages:${requestId}`, "message", { message });
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

    it("returns safe profile fields only for an accepted friend", async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: { displayName: "Bob", username: "bob", bio: "Studying", avatarPath: null },
        error: null,
      });
      const storage = { from: vi.fn().mockReturnValue({ createSignedUrl: vi.fn() }) };
      requireApiUserMock.mockResolvedValue({ supabase: { rpc, storage }, user: { id: "user-1" } });
      const { GET: getFriendProfile } = await import("@/app/api/friends/profile/[userId]/route");

      const response = (await getFriendProfile(new Request(`http://localhost/api/friends/profile/${otherUserId}`), { params: Promise.resolve({ userId: otherUserId }) })) as Response;

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("get_friend_profile", { p_other_user_id: otherUserId });
      expect(await response.json()).toEqual({ data: { displayName: "Bob", username: "bob", bio: "Studying", avatarUrl: null, currentStreak: 0, quizzes: [] } });
    });

    it("includes friend streak and shared quiz cards without storage paths", async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: { displayName: "Bob", username: "bob", bio: "Studying", avatarPath: `${otherUserId}/profile/avatar.gif`, currentStreak: 4, quizzes: [{ id: requestId, title: "Math", type: "quiz", questionCount: 3, updatedAt: "2026-07-30T00:00:00.000Z" }] },
        error: null,
      });
      const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/avatar.gif" }, error: null });
      requireApiUserMock.mockResolvedValue({ supabase: { rpc, storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }, user: { id: "user-1" } });
      const { GET: getFriendProfile } = await import("@/app/api/friends/profile/[userId]/route");

      const response = (await getFriendProfile(new Request(`http://localhost/api/friends/profile/${otherUserId}`), { params: Promise.resolve({ userId: otherUserId }) })) as Response;

      const body = await response.json();
      expect(body).toEqual({ data: { displayName: "Bob", username: "bob", bio: "Studying", avatarUrl: "https://signed.example/avatar.gif", currentStreak: 4, quizzes: [{ id: requestId, title: "Math", type: "quiz", questionCount: 3, updatedAt: "2026-07-30T00:00:00.000Z" }] } });
      expect(JSON.stringify(body)).not.toContain("avatarPath");
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

    it("returns 401 before social RPCs", async () => {
      requireApiUserMock.mockResolvedValue({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
      const { POST: touchActivity } = await import("@/app/api/friends/activity/route");

      expect(((await touchActivity()) as Response).status).toBe(401);
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
