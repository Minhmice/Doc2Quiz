import { describe, expect, it, vi } from "vitest";

import {
  FriendRateLimitedError,
  FriendRequestUnavailableError,
  ReportAcknowledgement,
  sendFriendRequest,
  reportUser,
  UsernameTakenError,
  setProfileUsername,
  resolveFriendUserId,
  resolveProfileUserId,
} from "./friends";

describe("friends service", () => {
  it("resolves usernames through protected friend RPC and keeps UUIDs local", async () => {
    const userId = "00000000-0000-4000-8000-000000000011";
    const rpc = vi.fn().mockResolvedValue({ data: { userId }, error: null });

    await expect(resolveFriendUserId({ rpc }, " MinhDoan ")).resolves.toBe(userId);
    expect(rpc).toHaveBeenCalledWith("resolve_friend_user", { p_username: "minhdoan" });
    await expect(resolveFriendUserId({ rpc }, userId)).resolves.toBe(userId);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("resolves public profile usernames without friend membership", async () => {
    const userId = "00000000-0000-4000-8000-000000000012";
    const rpc = vi.fn().mockResolvedValue({ data: { userId }, error: null });

    await expect(resolveProfileUserId({ rpc }, "public_user")).resolves.toBe(userId);
    expect(rpc).toHaveBeenCalledWith("resolve_profile_user", { p_username: "public_user" });
  });

  it("rejects malformed profile identifiers before RPC", async () => {
    const rpc = vi.fn();

    await expect(resolveFriendUserId({ rpc }, "bad-name")).rejects.toThrow("social_unavailable");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps generic recipient failures without account disclosure", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "ERROR: request_unavailable" },
    });

    await expect(sendFriendRequest({ rpc }, "someone")).rejects.toEqual(new FriendRequestUnavailableError());
  });

  it("rethrows unknown RPC errors instead of masking them as unavailable", async () => {
    const rpcError = { message: "permission denied for function send_friend_request" };
    const rpc = vi.fn().mockResolvedValue({ data: null, error: rpcError });

    await expect(sendFriendRequest({ rpc }, "someone")).rejects.toEqual(rpcError);
  });

  it("maps rate_limited RPC errors to retry metadata", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "rate_limited", details: "3600" },
    });

    await expect(sendFriendRequest({ rpc }, "someone")).rejects.toEqual(new FriendRateLimitedError(3600));
  });

  it("returns report acknowledgement without report payload", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });

    const result: ReportAcknowledgement = await reportUser(
      { rpc },
      "d1000000-0000-0000-0000-000000000003",
      "spam",
      "details",
    );

    expect(result).toEqual({ ok: true });
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("reason");
    expect(rpc).toHaveBeenCalledWith("report_user", {
      p_reported_user_id: "d1000000-0000-0000-0000-000000000003",
      p_reason: "spam",
      p_details: "details",
    });
  });

  it("maps username collision without owner disclosure", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "username_taken" },
    });

    await expect(setProfileUsername({ rpc }, "alice")).rejects.toEqual(new UsernameTakenError());
  });
});
