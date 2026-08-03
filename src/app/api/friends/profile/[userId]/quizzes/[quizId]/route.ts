import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { resolveFriendUserId } from "@/lib/server/friends/friends";

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

const paramsSchema = z.object({ userId: z.string().min(1), quizId: z.string().uuid() });

export async function GET(
  _: Request,
  { params }: { params: Promise<{ userId: string; quizId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "social_unavailable" }, { status: 404 });

  let userId: string;
  try {
    userId = await resolveFriendUserId(auth.supabase, parsed.data.userId);
  } catch {
    return NextResponse.json({ error: "social_unavailable" }, { status: 404 });
  }

  const result = await (auth.supabase as unknown as RpcClient).rpc("get_friend_shared_quiz", {
    p_other_user_id: userId,
    p_output_id: parsed.data.quizId,
  });
  if (result.error || !result.data) return NextResponse.json({ error: "social_unavailable" }, { status: 404 });

  return NextResponse.json({ data: result.data });
}

export const runtime = "nodejs";
