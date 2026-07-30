import { NextResponse } from "next/server";

import { PublicShareError, resolvePublicShare } from "@/lib/server/shares/publicShare";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  try {
    const data = await resolvePublicShare(createSupabaseAdminClient(), token);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof PublicShareError) {
      return NextResponse.json({ error: error.code }, { status: 404 });
    }
    console.error("public share route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
