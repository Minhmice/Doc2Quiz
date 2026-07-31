import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { normalizeUsername } from "@/lib/profile/usernameValidation";
import { broadcastSocialEvent } from "@/lib/server/friends/realtimeBroadcast";
import {
  mapSocialRouteError,
  sendFriendRequest,
  listFriendRequests,
} from "@/lib/server/friends/friends";
import { parseSocialListQuery } from "@/lib/server/friends/socialListQuery";
import { listSocialRequests } from "@/lib/server/friends/socialLists";

const sendFriendRequestSchema = z.object({
  username: z.string().trim().min(1).max(30),
});

function mapSocialError(error: unknown) {
  const mapped = mapSocialRouteError(error);
  if (!mapped) return null;
  const headers =
    mapped.retryAfterSeconds !== undefined
      ? { "Retry-After": String(mapped.retryAfterSeconds) }
      : undefined;
  return NextResponse.json(mapped.body, { status: mapped.status, headers });
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  try {
    const params = new URL(request.url).searchParams;
    const direction = z.enum(["incoming", "outgoing"]).parse(params.get("direction"));
    const { limit, cursor } = parseSocialListQuery(params);
    return NextResponse.json({ data: await listSocialRequests(auth.supabase, limit, cursor, direction) });
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === "social_unavailable")) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const mapped = mapSocialError(error);
    return mapped ?? NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof sendFriendRequestSchema>;
  try {
    body = sendFriendRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const data = await sendFriendRequest(auth.supabase, normalizeUsername(body.username));
    const requests = await listFriendRequests(auth.supabase);
    const created = requests.requests.find((item) => item.id === data.requestId && item.direction === "outgoing");
    if (created) {
      await broadcastSocialEvent(`social-requests:${created.otherUserId}`, "invalidate", { source: "friend-request" });
    }
    return NextResponse.json({ data });
  } catch (error) {
    const socialError = mapSocialRouteError(error);
    if (socialError) {
      if (process.env.NODE_ENV === "development" && socialError.body.error === "request_unavailable") {
        console.info("[friends] request_unavailable", { username: normalizeUsername(body.username) });
      }
      const headers =
        socialError.retryAfterSeconds !== undefined
          ? { "Retry-After": String(socialError.retryAfterSeconds) }
          : undefined;
      return NextResponse.json(socialError.body, { status: socialError.status, headers });
    }
    console.error("friend request send route error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
