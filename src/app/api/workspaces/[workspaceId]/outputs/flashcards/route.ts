import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  MultiSourceFlashcardGenerateError,
  MultiSourceFlashcardValidationError,
  runMultiSourceFlashcardGenerate,
} from "@/lib/pipeline/flashcardMultiSourceGenerate";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import { QuotaExceededError } from "@/lib/server/quota/QuotaExceededError";
import {
  GenerationInProgressError,
  commitGenerationQuota,
  releaseGenerationQuota,
  reserveGenerationQuota,
} from "@/lib/server/quota/generationQuotaReservation";
import { getUserUsage } from "@/lib/server/quota/getUserUsage";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";
import { workspaceFlashcardGenerateBodySchema } from "@/lib/workspaces/schemas";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { workspaceId } = await ctx.params;

  let body: {
    canonicalVersionIds: string[];
    learningGoal: "memorize" | "understand" | "exam_preparation";
    coverage:
      | "entire_document"
      | { sectionKeys: string[] };
    amount: "recommended" | { count: number };
  };
  try {
    const rawBody = await request.json();
    body = workspaceFlashcardGenerateBodySchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Invalid flashcard generate body.",
          details: summarizeZodError(error),
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let reservationToken: string | null = null;
  let quotaCommitted = false;
  let bridgeStudySetId: string | null = null;

  try {
    const usage = await getUserUsage({
      supabase: auth.supabase as never,
      user: auth.user,
    });
    if (
      usage.plan === "free" &&
      usage.weeklyRemaining <= 0 &&
      usage.bonusCredits <= 0
    ) {
      throw new QuotaExceededError({
        weeklyUsed: usage.weeklyUsed,
        weeklyLimit: usage.weeklyLimit,
        bonusCredits: usage.bonusCredits,
        weekResetsAt: usage.weekResetsAt,
      });
    }

    const result = await runMultiSourceFlashcardGenerate({
      supabase: auth.supabase,
      user: auth.user,
      userId: auth.user.id,
      workspaceId,
      canonicalVersionIds: body.canonicalVersionIds,
      learningGoal: body.learningGoal,
      coverage: body.coverage,
      amount: body.amount,
    });

    bridgeStudySetId = result.bridgeStudySetId;

    const reservation = await reserveGenerationQuota({
      supabase: auth.supabase,
      user: auth.user,
      studySetId: result.bridgeStudySetId,
      contentKind: "flashcards",
    });
    if (reservation.kind === "reserved") {
      reservationToken = reservation.reservationToken;
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
      outputId: result.outputId,
      studySetId: result.bridgeStudySetId,
      bridgeStudySetId: result.bridgeStudySetId,
      snapshotCount: result.snapshotCount,
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
          bridgeStudySetId,
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
    if (error instanceof WorkspaceNotFoundError) {
      return NextResponse.json(
        { error: "not_found", message: error.message },
        { status: 404 },
      );
    }
    if (error instanceof WorkspaceForbiddenError) {
      return NextResponse.json(
        { error: "forbidden", message: error.message },
        { status: 403 },
      );
    }
    if (error instanceof MultiSourceFlashcardValidationError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof MultiSourceFlashcardGenerateError) {
      if (error.statusCode === 503) {
        return NextResponse.json(
          {
            error:
              error.code === "FLASHCARD_PERSISTENCE_FAILED"
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
          details: error.details,
        },
        { status: error.statusCode },
      );
    }

    console.error("workspace flashcard generate route error", error);
    return NextResponse.json(
      { error: "internal_error", message: "Flashcard generation failed." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
