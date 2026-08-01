import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

const userIdSchema = z.string().uuid();

export async function GET(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const parsed = userIdSchema.safeParse((await params).userId);
  if (!parsed.success) return NextResponse.json({ error: "social_unavailable" }, { status: 404 });

  const result = await (auth.supabase as unknown as RpcClient).rpc("get_friend_profile", {
    p_other_user_id: parsed.data,
  });
  if (result.error) return NextResponse.json({ error: "social_unavailable" }, { status: 404 });

  const data = result.data as {
    displayName?: unknown; username?: unknown; bio?: unknown; avatarPath?: unknown;
    currentStreak?: unknown; quizzes?: unknown;
  } | null;
  if (typeof data?.displayName !== "string") return NextResponse.json({ error: "social_unavailable" }, { status: 404 });

  let avatarUrl: string | null = null;
  if (typeof data.avatarPath === "string" && new RegExp(`^${parsed.data}/profile/avatar\\.(png|jpe?g|webp|gif)$`, "i").test(data.avatarPath)) {
    const signed = await auth.supabase.storage.from("doc2quiz").createSignedUrl(data.avatarPath, 60 * 60);
    if (!signed.error) avatarUrl = signed.data.signedUrl;
  }

  return NextResponse.json({
    data: {
      displayName: data.displayName,
      username: typeof data.username === "string" ? data.username : null,
      bio: typeof data.bio === "string" ? data.bio : "",
      avatarUrl,
      currentStreak: typeof data.currentStreak === "number" && data.currentStreak >= 0 ? data.currentStreak : 0,
      quizzes: Array.isArray(data.quizzes) ? data.quizzes : [],
    },
  });
}

export const runtime = "nodejs";
