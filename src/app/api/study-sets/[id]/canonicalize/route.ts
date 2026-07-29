import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import {
  CanonicalizeError,
  CanonicalizePersistenceError,
  CanonicalizeValidationError,
  runCanonicalize,
} from "@/lib/pipeline/canonicalize";

async function verifyStudySet(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
  >,
  userId: string,
  studySetId: string,
) {
  const { data, error } = await supabase
    .from("study_sets")
    .select("id")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }

  if (!data) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  return { ok: true as const };
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { id } = await ctx.params;
  const verified = await verifyStudySet(auth.supabase, auth.user.id, id);
  if ("error" in verified) {
    return verified.error as Response;
  }

  try {
    const result = await runCanonicalize({
      supabase: auth.supabase,
      userId: auth.user.id,
      studySetId: id,
      user: auth.user,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CanonicalizeValidationError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof CanonicalizeError || error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "canonicalize_error",
          message:
            error instanceof ZodError
              ? `Invalid canonicalize response: ${summarizeZodError(error)}`
              : error.message,
        },
        { status: 422 },
      );
    }
    if (error instanceof CanonicalizePersistenceError) {
      return NextResponse.json(
        { error: "persistence_unavailable", message: error.message },
        { status: 503 },
      );
    }

    console.error("canonicalize route error", error);
    return NextResponse.json(
      { error: "internal_error", message: "Canonicalize failed." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
