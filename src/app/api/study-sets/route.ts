import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user } = auth;
  const { data, error } = await supabase
    .from("study_sets")
    .select(
      "id,title,subtitle,pipeline_stage,content_kind,created_at,updated_at",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user } = auth;

  let body: { title?: string; subtitle?: string };
  try {
    body = (await req.json()) as { title?: string; subtitle?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "Untitled study set";
  const subtitle =
    typeof body.subtitle === "string" ? body.subtitle.trim() || null : null;

  const { data, error } = await supabase
    .from("study_sets")
    .insert({
      user_id: user.id,
      title,
      subtitle,
      pipeline_stage: "input",
    })
    .select(
      "id,title,subtitle,pipeline_stage,content_kind,created_at,updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
