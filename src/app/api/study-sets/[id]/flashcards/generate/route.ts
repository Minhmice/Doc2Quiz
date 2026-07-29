import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { QuotaExceededError } from "@/lib/server/quota/QuotaExceededError";
import {
  GenerationInProgressError,
  commitGenerationQuota,
  releaseGenerationQuota,
  reserveGenerationQuota,
} from "@/lib/server/quota/generationQuotaReservation";
import {
  FlashcardGenerateError,
  FlashcardGenerateValidationError,
  runFlashcardGenerate,
} from "@/lib/pipeline/flashcardGenerate";
import { flashcardGenerateBodySchema } from "@/lib/pipeline/flashcardSchemas";
import { isAiProcessingConfigured } from "@/lib/server/ai-processing-config";

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

  if (!isAiProcessingConfigured()) {
    return NextResponse.json(
      {
        error: "ai_not_configured",
        message: "AI processing is not configured.",
      },
      { status: 503 },
    );
  }

  let body: ReturnType<typeof flashcardGenerateBodySchema.parse>;
  try {
    const rawBody = await request.json();
    body = flashcardGenerateBodySchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid flashcard generate body." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let reservationToken: string | null = null;
  let quotaCommitted = false;

  try {
    const reservation = await reserveGenerationQuota({
      supabase: auth.supabase,
      user: auth.user,
      studySetId: id,
      contentKind: "flashcards",
    });
    if (reservation.kind === "reserved") {
      reservationToken = reservation.reservationToken;
    }

    const result = await runFlashcardGenerate({
      supabase: auth.supabase,
      userId: auth.user.id,
      studySetId: id,
      user: auth.user,
      learningGoal: body.learningGoal,
      coverage: body.coverage,
      amount: body.amount,
    });

    if (reservationToken) {
      const commitResult = await commitGenerationQuota({
        supabase: auth.supabase,
        reservationToken,
      });
      if (commitResult.status !== "committed") {
        return NextResponse.json(
          { error: "internal_error", message: "Quota commit failed." },
          { status: 500 },
        );
      }
      quotaCommitted = true;
    }

    return NextResponse.json({
      recommendedCount: result.recommendedCount,
      generatedCount: result.generatedCount,
      detectedFormat: result.detectedFormat,
      cardIds: result.cardIds,
    });
  } catch (error) {
    if (reservationToken && !quotaCommitted) {
      try {
        await releaseGenerationQuota({
          supabase: auth.supabase,
          reservationToken,
        });
      } catch (releaseError) {
        console.error("quota release failed", {
          reservationToken,
          releaseError,
          originalError: error,
        });
        return NextResponse.json(
          { error: "internal_error", message: "Quota release failed." },
          { status: 500 },
        );
      }
    }

    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: "quota_exceeded", ...error.details },
        { status: error.statusCode },
      );
    }
    if (error instanceof GenerationInProgressError) {
      return NextResponse.json(
        { error: "generation_in_progress" },
        { status: 409 },
      );
    }
    if (error instanceof FlashcardGenerateValidationError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof FlashcardGenerateError) {
      if (error.statusCode === 503) {
        return NextResponse.json(
          {
            error: "ai_not_configured",
            message: error.message,
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "flashcard_generate_error", message: error.message },
        { status: 422 },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Invalid flashcard generate response.",
        },
        { status: 422 },
      );
    }

    console.error("flashcard generate route error", error);
    return NextResponse.json(
      { error: "internal_error", message: "Flashcard generation failed." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
