import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  mapSocialRouteError,
  sendFriendRequest,
  listFriendRequests,
} from "@/lib/server/friends/friends";

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

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const data = await listFriendRequests(auth.supabase);
    return NextResponse.json({ data });
  } catch (error) {
    const mapped = mapSocialError(error);
    if (mapped) return mapped;
    console.error("friend requests list route error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
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
    const data = await sendFriendRequest(auth.supabase, body.username);
    return NextResponse.json({ data });
  } catch (error) {
    const mapped = mapSocialError(error);
    if (mapped) return mapped;
    console.error("friend request send route error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
