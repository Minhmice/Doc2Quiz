import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { parseSocialListQuery } from "@/lib/server/friends/socialListQuery";
import { listSocialConversations } from "@/lib/server/friends/socialLists";

const bodySchema = z.object({ userId: z.string().uuid() });
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  try {
    const { limit, cursor } = parseSocialListQuery(new URL(request.url).searchParams);
    return NextResponse.json({ data: await listSocialConversations(auth.supabase, limit, cursor) });
  } catch (error) {
    const invalid = error instanceof Error && (error.name === "ZodError" || error.message === "social_unavailable");
    return NextResponse.json({ error: invalid ? "invalid" : "social_unavailable" }, { status: invalid ? 400 : 404 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await request.json()); } catch { return NextResponse.json({ error: "invalid" }, { status: 400 }); }

  const result = await (auth.supabase as unknown as RpcClient).rpc("open_direct_conversation", { p_other_user_id: body.userId });
  if (result.error) return NextResponse.json({ error: "social_unavailable" }, { status: 404 });
  const data = result.data as { conversationId?: unknown } | null;
  if (typeof data?.conversationId !== "string") return NextResponse.json({ error: "social_unavailable" }, { status: 404 });
  return NextResponse.json({ data: { conversationId: data.conversationId } });
}

export const runtime = "nodejs";
