import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  IngestConversionError,
  IngestValidationError,
  runIngest,
} from "@/lib/pipeline/ingest";
import { ingestJsonBodySchema } from "@/lib/pipeline/ingestSchemas";
import { formatSupabaseNetworkError } from "@/lib/supabase/networkErrors";
import type { SupportedMimeType } from "@/lib/pipeline/validation";

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
  request: Request,
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

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }

      const result = await runIngest({
        supabase: auth.supabase,
        userId: auth.user.id,
        studySetId: id,
        payload: { kind: "multipart_file", file },
      });

      return NextResponse.json(result);
    }

    let jsonBody: unknown;
    try {
      jsonBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const body = ingestJsonBodySchema.parse(jsonBody);
    const result = await runIngest({
      supabase: auth.supabase,
      userId: auth.user.id,
      studySetId: id,
      payload:
        body.kind === "file_ref"
          ? { ...body, mimeType: body.mimeType as SupportedMimeType }
          : body,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof IngestValidationError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof IngestConversionError) {
      return NextResponse.json(
        { error: "conversion_error", message: error.message },
        { status: 422 },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid ingest request body." },
        { status: 400 },
      );
    }

    console.error("ingest route error", error);
    const message =
      error instanceof Error
        ? formatSupabaseNetworkError(error.message)
        : "Ingest failed.";
    return NextResponse.json(
      { error: "internal_error", message },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;
