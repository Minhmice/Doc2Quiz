import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";

type RpcClient = { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ error: unknown }> };

export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  await (auth.supabase as unknown as RpcClient).rpc("touch_social_activity");
  return new NextResponse(null, { status: 204 });
}

export const runtime = "nodejs";
