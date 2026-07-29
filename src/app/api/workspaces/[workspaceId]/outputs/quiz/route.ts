import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  MultiSourceGenerateError,
  MultiSourceGenerateValidationError,
  runMultiSourceQuizGenerate,
} from "@/lib/pipeline/multiSourceGenerate";
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
import { workspaceQuizGenerateBodySchema } from "@/lib/workspaces/schemas";

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
    questionCount?: number;
  };
  try {
    const rawBody = await request.json();
    body = workspaceQuizGenerateBodySchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Invalid quiz generate body.",
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

    const result = await runMultiSourceQuizGenerate({
      supabase: auth.supabase,
      user: auth.user,
      userId: auth.user.id,
      workspaceId,
      canonicalVersionIds: body.canonicalVersionIds,
      questionCountOverride: body.questionCount,
    });

    bridgeStudySetId = result.bridgeStudySetId;

    const reservation = await reserveGenerationQuota({
      supabase: auth.supabase,
      user: auth.user,
      studySetId: result.bridgeStudySetId,
      contentKind: "quiz",
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
      requestedCount: result.requestedCount,
      recommendedCount: result.recommendedCount,
      generatedCount: result.generatedCount,
      questionIds: result.questionIds,
      generationMode: result.generationMode,
      factReuseCount: result.factReuseCount,
      warnings: result.warnings,
      rejectionSummary: result.rejectionSummary,
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
    if (error instanceof MultiSourceGenerateValidationError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof MultiSourceGenerateError) {
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

    console.error("workspace quiz generate route error", error);
    return NextResponse.json(
      { error: "internal_error", message: "Quiz generation failed." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
