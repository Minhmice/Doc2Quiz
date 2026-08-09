import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { getRedis } from "@/lib/server/redis/client";
import { checkRateLimit } from "@/lib/server/social/rateLimit";
import { getTypingSnapshot, updateTyping } from "@/lib/server/social/typing";

const idSchema = z.string().uuid();
const inputSchema = z.object({ state: z.enum(["typing", "stopped"]) }).strict();
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

function unavailable() { return NextResponse.json({ error: "social_unavailable" }, { status: 404 }); }
function degraded() { return NextResponse.json({ error: "social_degraded", state: "unknown" }, { status: 503 }); }
function clientIp(request: Request) {
  const candidate = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "unknown";
  return /^[0-9a-f:.]{1,45}$/i.test(candidate) ? candidate : "unknown";
}

async function participants(client: RpcClient, conversationId: string): Promise<string[] | null> {
  const result = await client.rpc("authorize_conversation_typing", { p_conversation_id: conversationId });
  const users = (result.data as { participantIds?: unknown } | null)?.participantIds;
  return result.error || !Array.isArray(users) || !users.every((id): id is string => typeof id === "string") ? null : users;
}

async function limited(redis: Awaited<ReturnType<typeof getRedis>>["redis"], scope: "typing-update" | "typing-snapshot", userId: string, request: Request) {
  for (const [subjectType, subject] of [["user", userId], ["ip", clientIp(request)]] as const) {
    const result = await checkRateLimit(redis, scope, subjectType, subject);
    if ("unavailable" in result) return degraded();
    if (!result.allowed) return NextResponse.json({ error: "rate_limited", retryAfterSeconds: result.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } });
  }
  return null;
}

export async function POST(request: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { conversationId } = await ctx.params;
  if (!idSchema.safeParse(conversationId).success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  let input: z.infer<typeof inputSchema>;
  try { input = inputSchema.parse(await request.json()); } catch { return NextResponse.json({ error: "invalid" }, { status: 400 }); }
  const participantIds = await participants(auth.supabase as unknown as RpcClient, conversationId);
  if (!participantIds) return unavailable();
  const connection = await getRedis();
  const rateLimited = await limited(connection.redis, "typing-update", auth.user.id, request);
  if (rateLimited) return rateLimited;
  const result = await updateTyping(connection.redis, conversationId, auth.user.id, input.state);
  if (result.state === "unknown") return degraded();
  if (result.state === "rate_limited") return NextResponse.json({ error: "rate_limited", retryAfterSeconds: 2 }, { status: 429, headers: { "Retry-After": "2" } });
  return new NextResponse(null, { status: 204 });
}

export async function GET(request: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { conversationId } = await ctx.params;
  if (!idSchema.safeParse(conversationId).success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const participantIds = await participants(auth.supabase as unknown as RpcClient, conversationId);
  if (!participantIds) return unavailable();
  const connection = await getRedis();
  const rateLimited = await limited(connection.redis, "typing-snapshot", auth.user.id, request);
  if (rateLimited) return rateLimited;
  return NextResponse.json({ data: await getTypingSnapshot(connection.redis, conversationId, participantIds) });
}

export const runtime = "nodejs";
