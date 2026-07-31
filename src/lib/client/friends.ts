import { parseApiError } from "@/lib/client/apiResponse";

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

export type ReportAcknowledgement = { ok: true };

export type AcceptedFriendSummary = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
  presence: "online" | "recently active" | "offline";
  lastActiveAt: string | null;
  unreadCount: number;
};

export type IncomingFriendRequestSummary = {
  id: string;
  userId: string;
  username: string | null;
  createdAt: string;
};

export class SocialRateLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("rate_limited");
    this.name = "SocialRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class UsernameTakenClientError extends Error {
  constructor() {
    super("username_taken");
    this.name = "UsernameTakenClientError";
  }
}

const GENERIC_UNAVAILABLE = "Social settings are unavailable.";
const FRIEND_REQUEST_UNAVAILABLE = "Friend request could not be sent. Check the username and try again.";

export function friendRequestUnavailableMessage(copy?: { requestUnavailable: string }): string {
  return copy?.requestUnavailable ?? FRIEND_REQUEST_UNAVAILABLE;
}

type ApiEnvelope<T> = { data: T };

export function mapSocialHttpError(
  status: number,
  fallback: string,
  serverMessage?: string,
): Error {
  if (status === 401 || status === 403 || status === 404) {
    return new Error(fallback);
  }
  return new Error(serverMessage ?? fallback);
}

function mapNetworkError(error: unknown): Error {
  if (error instanceof SocialRateLimitedError || error instanceof UsernameTakenClientError) {
    return error;
  }
  if (error instanceof TypeError) {
    return new Error("Connection lost. Check your network and try again.");
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error("Request failed.");
}

async function readErrorPayload(response: Response): Promise<{ error?: string } | null> {
  try {
    return (await response.json()) as { error?: string };
  } catch {
    return null;
  }
}

async function socialRequest<T>(
  url: string,
  init?: RequestInit,
  fallback = GENERIC_UNAVAILABLE,
): Promise<T> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        throw mapSocialHttpError(response.status, fallback);
      }
      if (response.status === 429) {
        const retryHeader = response.headers.get("Retry-After");
        const retryAfterSeconds = Number.parseInt(retryHeader ?? "60", 10);
        throw new SocialRateLimitedError(
          Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 60,
        );
      }
      if (response.status === 409) {
        const payload = await readErrorPayload(response);
        if (payload?.error === "username_taken") {
          throw new UsernameTakenClientError();
        }
      }
      throw await parseApiError(response, fallback);
    }
    const body = (await response.json()) as ApiEnvelope<T>;
    return body.data;
  } catch (error) {
    throw mapNetworkError(error);
  }
}

export async function fetchProfileUsername(): Promise<string | null> {
  const data = await socialRequest<{ username?: string | null }>("/api/profile");
  return typeof data.username === "string" ? data.username : null;
}

export async function updateProfileUsername(username: string): Promise<{ username: string }> {
  return socialRequest<{ username: string }>("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
}

type FriendsOverview = {
  friends?: AcceptedFriendSummary[];
  incoming?: { count?: number; requests?: IncomingFriendRequestSummary[] };
};

async function fetchFriendsOverview(): Promise<FriendsOverview> {
  return socialRequest<FriendsOverview>("/api/friends");
}

export async function listAcceptedFriends(): Promise<AcceptedFriendSummary[]> {
  const data = await fetchFriendsOverview();
  return Array.isArray(data.friends) ? data.friends : [];
}

export async function fetchIncomingFriendRequests(): Promise<{
  count: number;
  requests: IncomingFriendRequestSummary[];
}> {
  const data = await fetchFriendsOverview();
  return {
    count: typeof data.incoming?.count === "number" ? data.incoming.count : 0,
    requests: Array.isArray(data.incoming?.requests) ? data.incoming.requests : [],
  };
}

export async function listFriendRequests(): Promise<FriendRequestSummary[]> {
  const data = await socialRequest<{ requests?: FriendRequestSummary[] }>(
    "/api/friends/requests",
  );
  return Array.isArray(data.requests) ? data.requests : [];
}

export async function sendFriendRequest(
  username: string,
  fallback = FRIEND_REQUEST_UNAVAILABLE,
): Promise<{ ok: true }> {
  const data = await socialRequest<{ ok?: boolean }>(
    "/api/friends/requests",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    },
    fallback,
  );
  if (!data?.ok) {
    throw new Error(GENERIC_UNAVAILABLE);
  }
  return { ok: true };
}

export async function respondFriendRequest(
  requestId: string,
  action: "accept" | "decline",
): Promise<{ ok: true }> {
  const data = await socialRequest<{ ok?: boolean }>(`/api/friends/requests/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!data?.ok) {
    throw new Error(GENERIC_UNAVAILABLE);
  }
  return { ok: true };
}

export async function cancelFriendRequest(requestId: string): Promise<{ ok: true }> {
  const data = await socialRequest<{ ok?: boolean }>(`/api/friends/requests/${requestId}`, {
    method: "DELETE",
  });
  if (!data?.ok) {
    throw new Error(GENERIC_UNAVAILABLE);
  }
  return { ok: true };
}

export async function listBlockedUsers(): Promise<BlockedUserSummary[]> {
  const data = await socialRequest<{ blocks?: BlockedUserSummary[] }>(
    "/api/friends/blocks",
  );
  return Array.isArray(data.blocks) ? data.blocks : [];
}

export async function removeFriend(userId: string): Promise<{ ok: true }> {
  const data = await socialRequest<{ ok?: boolean }>(`/api/friends/${userId}`, {
    method: "DELETE",
  });
  if (!data?.ok) {
    throw new Error(GENERIC_UNAVAILABLE);
  }
  return { ok: true };
}

export async function blockUser(userId: string): Promise<{ ok: true }> {
  const data = await socialRequest<{ ok?: boolean }>("/api/friends/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!data?.ok) {
    throw new Error(GENERIC_UNAVAILABLE);
  }
  return { ok: true };
}

export async function unblockUser(userId: string): Promise<{ ok: true }> {
  const data = await socialRequest<{ ok?: boolean }>("/api/friends/blocks", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!data?.ok) {
    throw new Error(GENERIC_UNAVAILABLE);
  }
  return { ok: true };
}

export async function reportUser(
  userId: string,
  reason: string,
  details?: string,
): Promise<ReportAcknowledgement> {
  const data = await socialRequest<{ ok?: boolean }>("/api/friends/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      reason,
      ...(details ? { details } : {}),
    }),
  });
  if (!data?.ok) {
    throw new Error(GENERIC_UNAVAILABLE);
  }
  return { ok: true };
}
