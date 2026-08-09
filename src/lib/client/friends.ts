import { parseApiError } from "@/lib/client/apiResponse";
import type { FriendPresenceDto, PresencePage } from "@/lib/social/presenceTypes";

export type FriendRequestSummary = {
  id: string;
  direction: "incoming" | "outgoing";
  otherUserId: string;
  otherUsername: string | null;
  status: string;
  createdAt: string;
};

type SocialFriendRequest = {
  requestId: string;
  otherUserId: string;
  username: string | null;
  createdAt: string;
};

export type BlockedUserSummary = {
  userId: string;
  username: string | null;
  blockedAt: string;
};

export type ReportAcknowledgement = { ok: true };

export type AcceptedFriendSummary = FriendPresenceDto;
export type FriendPresencePage = PresencePage;


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

export type Page<T> = Readonly<{ items: readonly T[]; nextCursor: string | null; hasMore: boolean; totalCount?: number }>;
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

export async function listAcceptedFriendPage(
  presence: "online" | "offline",
  cursor?: string,
): Promise<FriendPresencePage> {
  const params = new URLSearchParams({ limit: "20", presence, ...(cursor ? { cursor } : {}) });
  return socialRequest<FriendPresencePage>(`/api/friends?${params}`);
}

export async function listAcceptedFriends(): Promise<AcceptedFriendSummary[]> {
  const [online, offline] = await Promise.all([
    listAcceptedFriendPage("online"),
    listAcceptedFriendPage("offline"),
  ]);
  return [...online.items, ...offline.items];
}

export async function fetchIncomingFriendRequests(): Promise<{
  count: number;
  requests: IncomingFriendRequestSummary[];
}> {
  const page = await listFriendRequestPage("incoming");
  return {
    count: page.totalCount ?? page.items.length,
    requests: page.items.map((item) => ({
      id: item.requestId,
      userId: item.otherUserId,
      username: item.username,
      createdAt: item.createdAt,
    })),
  };
}

export function listFriendRequestPage(direction: "incoming" | "outgoing", cursor?: string) {
  const params = new URLSearchParams({ direction, limit: "20", ...(cursor ? { cursor } : {}) });
  return socialRequest<Page<SocialFriendRequest>>(`/api/friends/requests?${params}`);
}

export async function listFriendRequests(): Promise<FriendRequestSummary[]> {
  const [incoming, outgoing] = await Promise.all([listFriendRequestPage("incoming"), listFriendRequestPage("outgoing")]);
  return [
    ...incoming.items.map((item) => ({ id: item.requestId, direction: "incoming" as const, otherUserId: item.otherUserId, otherUsername: item.username, status: "pending", createdAt: item.createdAt })),
    ...outgoing.items.map((item) => ({ id: item.requestId, direction: "outgoing" as const, otherUserId: item.otherUserId, otherUsername: item.username, status: "pending", createdAt: item.createdAt })),
  ];
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

export function listBlockedUserPage(cursor?: string) {
  const params = new URLSearchParams({ limit: "20", ...(cursor ? { cursor } : {}) });
  return socialRequest<Page<BlockedUserSummary>>(`/api/friends/blocks?${params}`);
}

export async function listBlockedUsers(): Promise<BlockedUserSummary[]> {
  return [...(await listBlockedUserPage()).items];
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
