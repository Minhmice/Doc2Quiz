import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";

const bodySchema = z.object({ enabled: z.boolean(), blockedSenderIds: z.array(z.string().uuid()).max(100) });
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await request.json()); } catch { return NextResponse.json({ error: "invalid" }, { status: 400 }); }
  const result = await (auth.supabase as unknown as RpcClient).rpc("update_reaction_preferences", { p_enabled: body.enabled, p_blocked_sender_ids: body.blockedSenderIds });
  if (result.error || !result.data) return NextResponse.json({ error: "social_unavailable" }, { status: 404 });
  return NextResponse.json({ data: { ok: true } });
}

export const runtime = "nodejs";
