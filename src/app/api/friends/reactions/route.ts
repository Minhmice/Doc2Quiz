import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { broadcastSocialEvent } from "@/lib/server/friends/realtimeBroadcast";

const reactionIds = ["xin_chao", "co_len", "dinh_qua", "qua_hay", "ban_gioi", "thu_gian", "good_luck", "tuyet_voi"] as const;
const bodySchema = z.object({ recipientUserId: z.string().uuid(), reactionId: z.enum(reactionIds) });
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await request.json()); } catch { return NextResponse.json({ error: "invalid" }, { status: 400 }); }
  const result = await (auth.supabase as unknown as RpcClient).rpc("send_preset_reaction", { p_recipient_user_id: body.recipientUserId, p_reaction_id: body.reactionId });
  if (result.error || !result.data) return NextResponse.json({ error: "social_unavailable" }, { status: 404 });
  const data = result.data as { recipientUserId: string; reactionId: string };
  await broadcastSocialEvent(`social-reactions:${data.recipientUserId}`, "reaction", {
    reactionId: data.reactionId,
  });
  return NextResponse.json({ data: result.data });
}

export const runtime = "nodejs";
