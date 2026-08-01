import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

const idSchema = z.string().uuid();
const bodySchema = z.object({ shared: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const id = idSchema.safeParse((await params).quizId);
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!id.success) return NextResponse.json({ error: "share_unavailable" }, { status: 404 });

  const result = await (auth.supabase as unknown as RpcClient).rpc("set_quiz_friend_share", {
    p_output_id: id.data,
    p_shared: body.shared,
  });
  if (result.error) return NextResponse.json({ error: "share_unavailable" }, { status: 404 });

  return NextResponse.json({ data: result.data });
}

export const runtime = "nodejs";
