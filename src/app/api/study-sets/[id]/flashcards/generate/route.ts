import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  MultiSourceFlashcardGenerateError,
  MultiSourceFlashcardValidationError,
  runMultiSourceFlashcardGenerate,
} from "@/lib/pipeline/flashcardMultiSourceGenerate";
import {
  flashcardAmountSchema,
  flashcardCoverageSchema,
  flashcardLearningGoalSchema,
} from "@/lib/pipeline/flashcardSchemas";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import { QuotaExceededError } from "@/lib/server/quota/QuotaExceededError";
import {
  GenerationInProgressError,
  commitGenerationQuota,
  releaseGenerationQuota,
  reserveGenerationQuota,
} from "@/lib/server/quota/generationQuotaReservation";
import { resolveLegacyStudySetBridge } from "@/lib/workspaces/legacyBridge";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

const legacyFlashcardGenerateBodySchema = z
  .object({
    learningGoal: flashcardLearningGoalSchema,
    coverage: flashcardCoverageSchema,
    amount: flashcardAmountSchema,
    canonicalVersionIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .strict();

async function resolveWorkspaceSources(params: {
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
  >;
  userId: string;
  studySetId: string;
  explicitVersionIds?: string[];
}): Promise<
  | { error: Response }
  | { workspaceId: string; canonicalVersionIds: string[] }
> {
  const { supabase, userId, studySetId, explicitVersionIds } = params;

  const bridge = await resolveLegacyStudySetBridge({
    supabase,
    studySetId,
    routeKind: "flashcards",
    userId,
  });

  if (!bridge) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  if (explicitVersionIds && explicitVersionIds.length > 0) {
    return {
      workspaceId: bridge.workspaceId,
      canonicalVersionIds: explicitVersionIds,
    };
  }

  const { data: snapshots, error: snapError } = await supabase
    .from("output_source_snapshots")
    .select("canonical_version_id, ordinal")
    .eq("output_id", bridge.outputId)
    .order("ordinal", { ascending: true });

  if (snapError) {
    return {
      error: NextResponse.json({ error: snapError.message }, { status: 500 }),
    };
  }

  const fromSnapshots = (snapshots ?? [])
    .map((row) => row.canonical_version_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (fromSnapshots.length > 0) {
    return {
      workspaceId: bridge.workspaceId,
      canonicalVersionIds: fromSnapshots,
    };
  }

  return {
    error: NextResponse.json(
      {
        error: "validation_error",
        message:
          "Explicit canonicalVersionIds are required when no frozen output snapshots exist.",
      },
      { status: 400 },
    ),
  };
}

/**
 * Narrow legacy adapter: resolve workspace/bridge sources via kind-aware
 * flashcards resolver and delegate to workspace-native multi-source generation.
 * Does not delete quiz or prior flashcard banks. New quota rows key to bridge IDs.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { id } = await ctx.params;

  let body: z.infer<typeof legacyFlashcardGenerateBodySchema>;
  try {
    const rawBody = await request.json();
    body = legacyFlashcardGenerateBodySchema.parse(rawBody);
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

  const resolved = await resolveWorkspaceSources({
    supabase: auth.supabase,
    userId: auth.user.id,
    studySetId: id,
    explicitVersionIds: body.canonicalVersionIds,
  });
  if ("error" in resolved) {
    return resolved.error as Response;
  }

  let reservationToken: string | null = null;
  let quotaCommitted = false;

  try {
    const result = await runMultiSourceFlashcardGenerate({
      supabase: auth.supabase,
      user: auth.user,
      userId: auth.user.id,
      workspaceId: resolved.workspaceId,
      canonicalVersionIds: resolved.canonicalVersionIds,
      learningGoal: body.learningGoal,
      coverage: body.coverage,
      amount: body.amount,
    });

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

    console.error("flashcard generate route error", error);
    return NextResponse.json(
      { error: "internal_error", message: "Flashcard generation failed." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
