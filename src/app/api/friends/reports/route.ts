import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { mapSocialRouteError, reportUser } from "@/lib/server/friends/friends";

const reportUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().min(1).max(120),
  details: z.string().trim().max(500).optional(),
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

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof reportUserSchema>;
  try {
    body = reportUserSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const data = await reportUser(auth.supabase, body.userId, body.reason, body.details ?? null);
    return NextResponse.json({ data });
  } catch (error) {
    const mapped = mapSocialError(error);
    if (mapped) return mapped;
    console.error("report user route error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
