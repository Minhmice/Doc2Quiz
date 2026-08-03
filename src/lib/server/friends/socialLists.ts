import { parseProfileAvatarPath } from "@/lib/profile/profileValidation";

export type SocialDestination = "friends" | "requests" | "invites" | "messages" | "blocks";
export type SocialPage<T> = Readonly<{ items: readonly T[]; nextCursor: string | null; hasMore: boolean; totalCount?: number }>;

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
type CursorPayload = { v: 1; d: SocialDestination; k: unknown[]; p?: PresenceBucket };

export type PresenceBucket = "online" | "offline";
const unavailable = () => new Error("social_unavailable");

export function encodeSocialCursor(destination: SocialDestination, keys: unknown[], presence?: PresenceBucket): string {
  return Buffer.from(JSON.stringify({ v: 1, d: destination, k: keys, ...(destination === "friends" ? { p: presence } : {}) } satisfies CursorPayload)).toString("base64url");
}

export function decodeSocialCursor(destination: SocialDestination, cursor: string, presence?: PresenceBucket): unknown[] {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
    if (value.v !== 1 || value.d !== destination || !Array.isArray(value.k) || value.k.length === 0 || (destination === "friends" && value.p !== presence)) throw unavailable();
    return value.k;
  } catch { throw unavailable(); }
}

async function list<T extends Record<string, unknown>>(
  client: RpcClient,
  destination: SocialDestination,
  rpcName: string,
  limit: number,
  cursor: string | null,
  keys: (row: T) => unknown[],
  extra: Record<string, unknown> = {},
  cursorPresence?: PresenceBucket,
): Promise<SocialPage<T>> {
  const cursorKeys = cursor ? decodeSocialCursor(destination, cursor, cursorPresence) : null;
  const { data, error } = await client.rpc(rpcName, { p_limit: limit + 1, p_cursor: cursorKeys, ...extra });
  if (error) throw unavailable();
  const payload = (data ?? {}) as { items?: unknown; totalCount?: unknown };
  const rows = Array.isArray(payload.items) ? payload.items as T[] : [];
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    items,
    nextCursor: hasMore && items.length ? encodeSocialCursor(destination, keys(items.at(-1)!), cursorPresence) : null,
    hasMore,
    ...(typeof payload.totalCount === "number" ? { totalCount: payload.totalCount } : {}),
  };
}

type StorageClient = { from: (bucket: string) => { createSignedUrl: (path: string, expiresIn: number) => PromiseLike<{ data: { signedUrl: string } | null; error: unknown }> } };
type SocialClient = RpcClient & { storage?: StorageClient };

export type SocialFriend = Record<string, unknown> & { userId: string; username: string | null; presenceRank: number; avatarUrl: string | null };
export type SocialRequest = Record<string, unknown> & { requestId: string; createdAt: string };
export type SocialInvite = Record<string, unknown> & { sessionId: string; createdAt: string };
export type SocialConversation = Record<string, unknown> & { conversationId: string; lastMessageAt: string | null };
export type SocialBlock = Record<string, unknown> & { userId: string; blockedAt: string };

export async function listSocialFriends(c: SocialClient, l: number, cursor: string | null, presence: PresenceBucket): Promise<SocialPage<SocialFriend>> {
  const page = await list<SocialFriend>(c, "friends", "list_social_friends", l, cursor, r => [r.presenceRank, r.username ?? "", r.userId], { p_presence: presence }, presence);
  const storage = c.storage;
  if (!storage) return {
    ...page,
    items: page.items.map((friend) => {
      const safeFriend = { ...friend };
      delete safeFriend.avatarPath;
      return { ...safeFriend, avatarUrl: null };
    }),
  };

  const items = await Promise.all(page.items.map(async ({ avatarPath, ...friend }) => {
    let avatarUrl: string | null = null;
    const parsedAvatar = parseProfileAvatarPath(avatarPath);
    const safeAvatarPath = typeof avatarPath === "string" && parsedAvatar?.userId === friend.userId ? avatarPath : null;
    if (safeAvatarPath) {
      try {
        const signed = await storage.from("doc2quiz").createSignedUrl(safeAvatarPath, 60 * 60);
        if (!signed.error) avatarUrl = signed.data?.signedUrl ?? null;
      } catch {
        avatarUrl = null;
      }
    }
    return { ...friend, avatarUrl };
  }));
  return { ...page, items };
}
export const listSocialRequests = (c: RpcClient, l: number, cursor: string | null, direction: "incoming"|"outgoing") => list<SocialRequest>(c,"requests","list_social_friend_requests",l,cursor,r=>[r.createdAt,r.requestId],{p_direction:direction});
export const listSocialInvites = (c: RpcClient, l: number, cursor: string | null) => list<SocialInvite>(c,"invites","list_social_invites",l,cursor,r=>[r.createdAt,r.sessionId]);
export const listSocialConversations = (c: RpcClient, l: number, cursor: string | null) => list<SocialConversation>(c,"messages","list_social_conversations",l,cursor,r=>[r.lastMessageAt,r.conversationId]);
export const listSocialBlocks = (c: RpcClient, l: number, cursor: string | null) => list<SocialBlock>(c,"blocks","list_social_blocks",l,cursor,r=>[r.blockedAt,r.userId]);
