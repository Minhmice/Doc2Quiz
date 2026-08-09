import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/requireApiUser";
import { parseFriendsListQuery } from "@/lib/server/friends/socialListQuery";
import { listSocialFriends } from "@/lib/server/friends/socialLists";
import { getRedis } from "@/lib/server/redis/client";
import { getPresenceSnapshot } from "@/lib/server/social/presenceSnapshot";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  try {
    const { limit, cursor, presence } = parseFriendsListQuery(new URL(request.url).searchParams);
    const page = await listSocialFriends(auth.supabase, limit, cursor, presence);
    const connection = await getRedis();
    const snapshot = await getPresenceSnapshot(connection.redis).snapshot(page, presence, `${auth.user.id}:${presence}:${cursor ?? ""}`);
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    const invalid = error instanceof Error && (error.name === "ZodError" || error.message === "social_unavailable");
    return NextResponse.json({ error: invalid ? "invalid" : "social_unavailable" }, { status: invalid ? 400 : 404 });
  }
}
export const runtime = "nodejs";
