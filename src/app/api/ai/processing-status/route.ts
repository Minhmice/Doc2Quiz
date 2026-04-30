import { NextResponse } from "next/server";

import { buildAiProcessingUxStatus } from "@/lib/server/aiProcessingUx";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Returns safe UX-only fields for the signed-in user (no secrets).
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = resolveUserAiTier(user);
  const status = buildAiProcessingUxStatus(tier);
  return NextResponse.json(status);
}
