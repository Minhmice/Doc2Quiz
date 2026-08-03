import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { resolveProfileUserId } from "@/lib/server/friends/friends";

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export async function GET(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let userId: string;
  try {
    userId = await resolveProfileUserId(auth.supabase, (await params).userId);
  } catch {
    return NextResponse.json({ error: "social_unavailable" }, { status: 404 });
  }

  const result = await (auth.supabase as unknown as RpcClient).rpc("get_public_profile", {
    p_user_id: userId,
  });
  if (result.error) return NextResponse.json({ error: "social_unavailable" }, { status: 404 });

  const data = result.data as {
    displayName?: unknown; username?: unknown; bio?: unknown; avatarPath?: unknown;
  } | null;
  if (typeof data?.displayName !== "string") return NextResponse.json({ error: "social_unavailable" }, { status: 404 });

  let avatarUrl: string | null = null;
  if (typeof data.avatarPath === "string" && new RegExp(`^${userId}/profile/avatar\\.(png|jpe?g|webp|gif)$`, "i").test(data.avatarPath)) {
    try {
      const signed = await auth.supabase.storage.from("doc2quiz").createSignedUrl(data.avatarPath, 60 * 60);
      if (!signed.error) avatarUrl = signed.data.signedUrl;
    } catch {
      avatarUrl = null;
    }
  }

  return NextResponse.json({
    data: {
      displayName: data.displayName,
      username: typeof data.username === "string" ? data.username : null,
      bio: typeof data.bio === "string" ? data.bio : "",
      avatarUrl,
    },
  });
}

export const runtime = "nodejs";
