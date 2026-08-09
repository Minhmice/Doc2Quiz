import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { getRedis } from "@/lib/server/redis/client";
import { touchPresence } from "@/lib/server/social/presence";
import { checkRateLimit } from "@/lib/server/social/rateLimit";

const bodySchema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  activity: z.enum(["idle", "studying", "chatting"]).default("idle"),
});

function clientIp(request: Request) {
  const candidate = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "unknown";
  return /^[0-9a-f:.]{1,45}$/i.test(candidate) ? candidate : "unknown";
}

function degraded() {
  return NextResponse.json({ error: "social_degraded", state: "unknown" }, { status: 503 });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error as Response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const connection = await getRedis();
  if (!connection.redis) return degraded();

  for (const [subjectType, subject] of [["user", auth.user.id], ["ip", clientIp(request)]] as const) {
    const limit = await checkRateLimit(connection.redis, "heartbeat", subjectType, subject);
    if ("unavailable" in limit) return degraded();
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }
  }

  const result = await touchPresence(auth.user.id, parsed.data.sessionId, parsed.data.activity, connection.redis);
  return result.state === "ready" ? new NextResponse(null, { status: 204 }) : degraded();
}

export const runtime = "nodejs";
