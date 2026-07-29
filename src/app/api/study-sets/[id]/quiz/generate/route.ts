import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { QuotaExceededError } from "@/lib/server/quota/QuotaExceededError";
import { assertGenerationQuota } from "@/lib/server/quota/assertGenerationQuota";
import { recordQuotaConsumption } from "@/lib/server/quota/recordQuotaConsumption";
import {
  QuizGenerateError,
  QuizGenerateValidationError,
  runQuizGenerate,
} from "@/lib/pipeline/quizGenerate";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import { quizGenerateBodySchema } from "@/lib/pipeline/quizSchemas";

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

  let questionCountOverride: number | undefined;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const rawBody = await request.json();
      if (rawBody !== null && typeof rawBody === "object") {
        const body = quizGenerateBodySchema.parse(rawBody);
        questionCountOverride = body.questionCount;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: "validation_error", message: "Invalid quiz generate body." },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  try {
    await assertGenerationQuota({
      supabase: auth.supabase,
      user: auth.user,
      studySetId: id,
    });

    const result = await runQuizGenerate({
      supabase: auth.supabase,
      userId: auth.user.id,
      studySetId: id,
      user: auth.user,
      questionCountOverride,
    });

    await recordQuotaConsumption({
      supabase: auth.supabase,
      user: auth.user,
      studySetId: id,
      contentKind: "quiz",
    });

    return NextResponse.json({
      requestedCount: result.requestedCount,
      recommendedCount: result.recommendedCount,
      generatedCount: result.generatedCount,
      questionIds: result.questionIds,
      generationMode: result.generationMode,
      factReuseCount: result.factReuseCount,
      warnings: result.warnings,
      rejectionSummary: result.rejectionSummary,
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: "quota_exceeded", ...error.details },
        { status: error.statusCode },
      );
    }
    if (error instanceof QuizGenerateValidationError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof QuizGenerateError) {
      if (error.statusCode === 503) {
        return NextResponse.json(
          {
            error:
              error.code === "QUIZ_PERSISTENCE_FAILED"
                ? "persistence_unavailable"
                : "ai_not_configured",
            message: error.message,
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          requested_count: error.details?.requestedCount,
          max_supported_count: error.details?.maxSupportedCount,
          accepted_count: error.details?.acceptedCount,
          missing_count: error.details?.missingCount,
          reason: error.details?.reason,
          details: error.details,
        },
        { status: error.statusCode },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_error", message: `Invalid quiz generate response: ${summarizeZodError(error)}` },
        { status: 422 },
      );
    }

    console.error("quiz generate route error", error);
    return NextResponse.json(
      { error: "internal_error", message: "Quiz generation failed." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
