import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";

const STUDY_SET_SELECT =
  "id,title,subtitle,pipeline_stage,content_kind,created_at,updated_at";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await ctx.params;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("study_sets")
    .select(STUDY_SET_SELECT)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await ctx.params;
  const { supabase, user } = auth;

  let body: {
    title?: string;
    subtitle?: string | null;
    content_kind?: string | null;
    pipeline_stage?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    patch.title = body.title.trim();
  }
  if (body.subtitle !== undefined) {
    patch.subtitle =
      typeof body.subtitle === "string"
        ? body.subtitle.trim() || null
        : body.subtitle;
  }
  if (body.content_kind !== undefined) {
    patch.content_kind = body.content_kind;
  }
  if (typeof body.pipeline_stage === "string") {
    patch.pipeline_stage = body.pipeline_stage;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("study_sets")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(STUDY_SET_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await ctx.params;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("study_sets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
