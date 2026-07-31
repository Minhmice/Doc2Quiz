import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { broadcastSocialEvent } from "@/lib/server/friends/realtimeBroadcast";

const idSchema = z.string().uuid();
const sendSchema = z.object({ body: z.string().trim().min(1).max(2000) });
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

function unavailable() { return NextResponse.json({ error: "social_unavailable" }, { status: 404 }); }

export async function GET(request: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { conversationId } = await ctx.params;
  const before = new URL(request.url).searchParams.get("before");
  if (!idSchema.safeParse(conversationId).success || (before !== null && Number.isNaN(Date.parse(before)))) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const result = await (auth.supabase as unknown as RpcClient).rpc("list_direct_messages", { p_conversation_id: conversationId, p_before: before, p_limit: 50 });
  if (result.error) return unavailable();
  const data = result.data as { messages?: unknown } | null;
  return NextResponse.json({ data: { messages: Array.isArray(data?.messages) ? data.messages : [] } });
}

export async function POST(request: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { conversationId } = await ctx.params;
  let body: z.infer<typeof sendSchema>;
  try { body = sendSchema.parse(await request.json()); } catch { return NextResponse.json({ error: "invalid" }, { status: 400 }); }
  if (!idSchema.safeParse(conversationId).success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const result = await (auth.supabase as unknown as RpcClient).rpc("send_direct_message", { p_conversation_id: conversationId, p_body: body.body });
  if (result.error || !result.data) return unavailable();
  const message = result.data as { recipientUserId?: unknown };
  await broadcastSocialEvent(`social-messages:${conversationId}`, "message", { message: result.data });
  if (typeof message.recipientUserId === "string") {
    await broadcastSocialEvent(`social-counts:${message.recipientUserId}`, "invalidate", { source: "message" });
  }
  return NextResponse.json({ data: result.data });
}

export const runtime = "nodejs";
