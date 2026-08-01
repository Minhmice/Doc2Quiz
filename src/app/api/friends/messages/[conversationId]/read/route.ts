import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";

const idSchema = z.string().uuid();
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

export async function POST(_request: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { conversationId } = await ctx.params;
  if (!idSchema.safeParse(conversationId).success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const result = await (auth.supabase as unknown as RpcClient).rpc("mark_direct_conversation_read", { p_conversation_id: conversationId });
  if (result.error || (result.data as { ok?: unknown } | null)?.ok !== true) {
    return NextResponse.json({ error: "social_unavailable" }, { status: 404 });
  }
  return NextResponse.json({ data: { ok: true } });
}

export const runtime = "nodejs";
