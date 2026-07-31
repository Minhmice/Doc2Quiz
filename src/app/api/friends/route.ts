import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/requireApiUser";
import { parseSocialListQuery } from "@/lib/server/friends/socialListQuery";
import { listSocialFriends } from "@/lib/server/friends/socialLists";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  try {
    const { limit, cursor } = parseSocialListQuery(new URL(request.url).searchParams);
    return NextResponse.json({ data: await listSocialFriends(auth.supabase, limit, cursor) });
  } catch (error) {
    const invalid = error instanceof Error && (error.name === "ZodError" || error.message === "social_unavailable");
    return NextResponse.json({ error: invalid ? "invalid" : "social_unavailable" }, { status: invalid ? 400 : 404 });
  }
}
export const runtime = "nodejs";
