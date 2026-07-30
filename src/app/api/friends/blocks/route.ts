import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  blockUser,
  listBlockedUsers,
  mapSocialRouteError,
  unblockUser,
} from "@/lib/server/friends/friends";

const blockUserSchema = z.object({
  userId: z.string().uuid(),
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
    const data = await listBlockedUsers(auth.supabase);
    return NextResponse.json({ data });
  } catch (error) {
    const mapped = mapSocialError(error);
    if (mapped) return mapped;
    console.error("blocked users list route error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof blockUserSchema>;
  try {
    body = blockUserSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const data = await blockUser(auth.supabase, body.userId);
    return NextResponse.json({ data });
  } catch (error) {
    const mapped = mapSocialError(error);
    if (mapped) return mapped;
    console.error("block user route error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof blockUserSchema>;
  try {
    body = blockUserSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const data = await unblockUser(auth.supabase, body.userId);
    return NextResponse.json({ data });
  } catch (error) {
    const mapped = mapSocialError(error);
    if (mapped) return mapped;
    console.error("unblock user route error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
