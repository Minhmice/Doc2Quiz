import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { getRedis } from "@/lib/server/redis/client";
import { touchPresence } from "@/lib/server/social/presence";
import { checkRateLimit } from "@/lib/server/social/rateLimit";

function degraded() {
  return NextResponse.json({ error: "social_degraded", state: "unknown" }, { status: 503 });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error as Response;
  const connection = await getRedis();
  if (!connection.redis) return degraded();

  for (const [subjectType, subject] of [["user", auth.user.id], ["ip", request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown"]] as const) {
    const limit = await checkRateLimit(connection.redis, "heartbeat", subjectType, subject);
    if ("unavailable" in limit) return degraded();
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }
  }

  const result = await touchPresence(auth.user.id, `compat_${auth.user.id}`, "idle", connection.redis);
  return result.state === "ready" ? new NextResponse(null, { status: 204 }) : degraded();
}

export const runtime = "nodejs";
