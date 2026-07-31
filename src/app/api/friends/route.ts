import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";

type RpcClient = { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const client = auth.supabase as unknown as RpcClient;
  const [friends, incoming] = await Promise.all([
    client.rpc("list_accepted_friends"),
    client.rpc("list_incoming_friend_requests"),
  ]);
  if (friends.error || incoming.error) return NextResponse.json({ error: "social_unavailable" }, { status: 404 });

  const friendData = friends.data as { friends?: unknown } | null;
  const incomingData = incoming.data as { count?: unknown; requests?: unknown } | null;
  const friendRows = Array.isArray(friendData?.friends) ? friendData.friends as Record<string, unknown>[] : [];
  const friendsWithAvatars: Record<string, unknown>[] = await Promise.all(friendRows.map(async (friend) => {
    const { avatarPath: rawAvatarPath, ...safeFriend } = friend;
    const avatarPath = typeof rawAvatarPath === "string" && rawAvatarPath.startsWith(`${friend.userId}/profile/`)
      ? rawAvatarPath
      : null;
    const presence = friend.isOnline === true
      ? "online"
      : typeof friend.lastActiveAt === "string"
        ? "recently active"
        : "offline";
    if (!avatarPath) return { ...safeFriend, avatarUrl: null, presence };
    const { data } = await auth.supabase.storage.from("doc2quiz").createSignedUrl(avatarPath, 60 * 60);
    return { ...safeFriend, avatarUrl: data?.signedUrl ?? null, presence };
  }));
  const incomingRequestCount = typeof incomingData?.count === "number" ? incomingData.count : 0;
  const unreadMessageCount = friendsWithAvatars.reduce(
    (total, friend) => total + (typeof friend.unreadCount === "number" ? friend.unreadCount : 0),
    0,
  );
  return NextResponse.json({
    data: {
      friends: friendsWithAvatars,
      incoming: {
        count: incomingRequestCount,
        requests: Array.isArray(incomingData?.requests) ? incomingData.requests : [],
      },
      incomingRequestCount,
      unreadMessageCount,
    },
  });
}

export const runtime = "nodejs";
