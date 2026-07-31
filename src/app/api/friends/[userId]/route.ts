import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { mapSocialRouteError, removeFriend } from "@/lib/server/friends/friends";

const userIdSchema = z.string().uuid();

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const parsed = userIdSchema.safeParse((await params).userId);
  if (!parsed.success || parsed.data === auth.user.id) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const data = await removeFriend(auth.supabase, parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    const mapped = mapSocialRouteError(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error("remove friend route error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
