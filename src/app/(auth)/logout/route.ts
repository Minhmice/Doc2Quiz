import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signOutAndRedirect(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const url = new URL(request.url);
  const rawNext = url.searchParams.get("next") ?? "/login";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/login";
  return NextResponse.redirect(new URL(next, url.origin), 303);
}

export async function GET(request: Request) {
  return signOutAndRedirect(request);
}

export async function POST(request: Request) {
  return signOutAndRedirect(request);
}
