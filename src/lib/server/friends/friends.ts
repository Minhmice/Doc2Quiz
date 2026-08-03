import { z } from "zod";

import { normalizeUsername, validateUsername } from "@/lib/profile/usernameValidation";

type FriendsRpcSupabase = {
  rpc: (
    functionName: string,
    args: Record<string, string | null>,
  ) => PromiseLike<{
    data: Record<string, unknown> | null;
    error: { message: string; details?: string | null } | null;
  }>;
};

const userIdSchema = z.string().uuid();

async function resolveProfileIdentifier(supabase: FriendsRpcSupabase, identifier: string, rpcName: "resolve_friend_user" | "resolve_profile_user"): Promise<string> {
  const parsedUserId = userIdSchema.safeParse(identifier);
  if (parsedUserId.success) return parsedUserId.data;
  if (validateUsername(identifier)) throw new Error("social_unavailable");

  const { data, error } = await supabase.rpc(rpcName, {
    p_username: normalizeUsername(identifier),
  });
  const userId = data?.userId;
  if (error || !userIdSchema.safeParse(userId).success) throw new Error("social_unavailable");
  return userId as string;
}

export function resolveFriendUserId(supabase: FriendsRpcSupabase, identifier: string): Promise<string> {
  return resolveProfileIdentifier(supabase, identifier, "resolve_friend_user");
}

export function resolveProfileUserId(supabase: FriendsRpcSupabase, identifier: string): Promise<string> {
  return resolveProfileIdentifier(supabase, identifier, "resolve_profile_user");
}

export type ReportAcknowledgement = { ok: true };

export class FriendRequestUnavailableError extends Error {
  constructor() {
    super("request_unavailable");
    this.name = "FriendRequestUnavailableError";
  }
}

export class FriendRateLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("rate_limited");
    this.name = "FriendRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class UsernameTakenError extends Error {
  constructor() {
    super("username_taken");
    this.name = "UsernameTakenError";
  }
}

export class UsernameInvalidError extends Error {
  constructor() {
    super("username_invalid");
    this.name = "UsernameInvalidError";
  }
}

function parseRetryAfterSeconds(error: { message: string; details?: string | null }): number | null {
  const detail = error.details?.trim();
  if (detail && /^\d+$/.test(detail)) {
    return Number.parseInt(detail, 10);
  }
  const match = error.message.match(/retry[^\d]*(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function mapSocialRpcError(error: { message: string; details?: string | null }) {
  const message = error.message;
  if (message.includes("rate_limited")) {
    const retryAfterSeconds = parseRetryAfterSeconds(error) ?? 60;
    throw new FriendRateLimitedError(retryAfterSeconds);
  }
  if (message.includes("request_unavailable")) {
    throw new FriendRequestUnavailableError();
  }
  if (message.includes("username_taken")) {
    throw new UsernameTakenError();
  }
  if (message.includes("username_invalid")) {
    throw new UsernameInvalidError();
  }
}

export async function setProfileUsername(supabase: FriendsRpcSupabase, username: string) {
  const { data, error } = await supabase.rpc("set_profile_username", { p_username: username });

  if (error) {
    mapSocialRpcError(error);
    throw error;
  }
  if (!data?.username || typeof data.username !== "string") {
    throw new UsernameInvalidError();
  }

  return { username: data.username };
}

export async function sendFriendRequest(supabase: FriendsRpcSupabase, username: string) {
  const { data, error } = await supabase.rpc("send_friend_request", { p_username: username });

  if (error) {
    mapSocialRpcError(error);
    throw error;
  }
  if (!data?.ok) {
    throw new FriendRequestUnavailableError();
  }

  return {
    ok: true as const,
    requestId: typeof data.requestId === "string" ? data.requestId : undefined,
  };
}

export async function reportUser(
  supabase: FriendsRpcSupabase,
  reportedUserId: string,
  reason: string,
  details?: string | null,
): Promise<ReportAcknowledgement> {
  const { data, error } = await supabase.rpc("report_user", {
    p_reported_user_id: reportedUserId,
    p_reason: reason,
    p_details: details ?? null,
  });

  if (error) {
    mapSocialRpcError(error);
    throw new FriendRequestUnavailableError();
  }
  if (!data?.ok) {
    throw new FriendRequestUnavailableError();
  }

  return { ok: true };
}

export async function blockUser(supabase: FriendsRpcSupabase, userId: string) {
  const { data, error } = await supabase.rpc("block_user", { p_user_id: userId });

  if (error) {
    mapSocialRpcError(error);
    throw new FriendRequestUnavailableError();
  }
  if (!data?.ok) {
    throw new FriendRequestUnavailableError();
  }

  return { ok: true as const };
}

export async function removeFriend(supabase: FriendsRpcSupabase, userId: string) {
  const { data, error } = await supabase.rpc("remove_friend", { p_other_user_id: userId });

  if (error) {
    mapSocialRpcError(error);
    throw new FriendRequestUnavailableError();
  }
  if (!data?.ok) {
    throw new FriendRequestUnavailableError();
  }

  return { ok: true as const };
}

export async function unblockUser(supabase: FriendsRpcSupabase, userId: string) {
  const { data, error } = await supabase.rpc("unblock_user", { p_user_id: userId });

  if (error) {
    mapSocialRpcError(error);
    throw new FriendRequestUnavailableError();
  }
  if (!data?.ok) {
    throw new FriendRequestUnavailableError();
  }

  return { ok: true as const };
}

export type FriendRequestSummary = {
  id: string;
  direction: "incoming" | "outgoing";
  otherUserId: string;
  otherUsername: string | null;
  status: string;
  createdAt: string;
};

export type BlockedUserSummary = {
  userId: string;
  username: string | null;
  blockedAt: string;
};

export async function listFriendRequests(supabase: FriendsRpcSupabase) {
  const { data, error } = await supabase.rpc("list_friend_requests", {});

  if (error) {
    mapSocialRpcError(error);
    throw new FriendRequestUnavailableError();
  }

  const requests = Array.isArray(data?.requests) ? data.requests : [];
  return {
    requests: requests.map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        id: String(row.id ?? ""),
        direction: row.direction === "outgoing" ? "outgoing" : "incoming",
        otherUserId: String(row.otherUserId ?? ""),
        otherUsername: typeof row.otherUsername === "string" ? row.otherUsername : null,
        status: String(row.status ?? ""),
        createdAt: String(row.createdAt ?? ""),
      } satisfies FriendRequestSummary;
    }),
  };
}

export async function respondFriendRequest(
  supabase: FriendsRpcSupabase,
  requestId: string,
  action: "accept" | "decline",
) {
  const { data, error } = await supabase.rpc("respond_friend_request", {
    p_request_id: requestId,
    p_action: action,
  });

  if (error) {
    mapSocialRpcError(error);
    throw new FriendRequestUnavailableError();
  }
  if (!data?.ok) {
    throw new FriendRequestUnavailableError();
  }

  return { ok: true as const };
}

export async function cancelFriendRequest(supabase: FriendsRpcSupabase, requestId: string) {
  const { data, error } = await supabase.rpc("cancel_friend_request", {
    p_request_id: requestId,
  });

  if (error) {
    mapSocialRpcError(error);
    throw new FriendRequestUnavailableError();
  }
  if (!data?.ok) {
    throw new FriendRequestUnavailableError();
  }

  return { ok: true as const };
}

export async function listBlockedUsers(supabase: FriendsRpcSupabase) {
  const { data, error } = await supabase.rpc("list_blocked_users", {});

  if (error) {
    mapSocialRpcError(error);
    throw new FriendRequestUnavailableError();
  }

  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  return {
    blocks: blocks.map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        userId: String(row.userId ?? ""),
        username: typeof row.username === "string" ? row.username : null,
        blockedAt: String(row.blockedAt ?? ""),
      } satisfies BlockedUserSummary;
    }),
  };
}

export function mapSocialRouteError(error: unknown): { status: number; body: { error: string }; retryAfterSeconds?: number } | null {
  if (error instanceof FriendRateLimitedError) {
    return {
      status: 429,
      body: { error: "rate_limited" },
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  if (error instanceof FriendRequestUnavailableError) {
    return { status: 404, body: { error: "request_unavailable" } };
  }
  if (error instanceof UsernameTakenError) {
    return { status: 409, body: { error: "username_taken" } };
  }
  if (error instanceof UsernameInvalidError) {
    return { status: 400, body: { error: "username_invalid" } };
  }
  return null;
}
