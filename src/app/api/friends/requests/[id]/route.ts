import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  cancelFriendRequest,
  mapSocialRouteError,
  respondFriendRequest,
} from "@/lib/server/friends/friends";

const respondFriendRequestSchema = z.object({
  action: z.enum(["accept", "decline"]),
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

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;

  let body: z.infer<typeof respondFriendRequestSchema>;
  try {
    body = respondFriendRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const data = await respondFriendRequest(auth.supabase, id, body.action);
    return NextResponse.json({ data });
  } catch (error) {
    const mapped = mapSocialError(error);
    if (mapped) return mapped;
    console.error("friend request respond route error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;

  try {
    const data = await cancelFriendRequest(auth.supabase, id);
    return NextResponse.json({ data });
  } catch (error) {
    const mapped = mapSocialError(error);
    if (mapped) return mapped;
    console.error("friend request cancel route error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
