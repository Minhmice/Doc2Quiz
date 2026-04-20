import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const url = new URL(request.url);
  const rawNext = url.searchParams.get("next") ?? "/login";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/login";
  return NextResponse.redirect(new URL(next, url.origin), 303);
}
