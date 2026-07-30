type FriendsRpcSupabase = {
  rpc: (
    functionName: string,
    args: Record<string, string | null>,
  ) => PromiseLike<{
    data: Record<string, unknown> | null;
    error: { message: string; details?: string | null } | null;
  }>;
};

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
    throw new FriendRequestUnavailableError();
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
