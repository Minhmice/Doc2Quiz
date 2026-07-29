import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { z } from "zod";

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
import { resolveLegacyStudySetBridge } from "@/lib/workspaces/documentVersions";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

const legacyQuizGenerateBodySchema = z
  .object({
    canonicalVersionIds: z.array(z.string().uuid()).min(1).optional(),
    questionCount: z.number().int().min(1).max(40).optional(),
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

  const { data: ownedSet, error: ownedError } = await supabase
    .from("study_sets")
    .select("id")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (ownedError) {
    return {
      error: NextResponse.json({ error: ownedError.message }, { status: 500 }),
    };
  }
  if (!ownedSet) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const bridge = await resolveLegacyStudySetBridge({
    supabase,
    legacyStudySetId: studySetId,
  });

  let workspaceId = bridge?.workspaceId ?? null;
  let learningOutputId = bridge?.learningOutputId ?? null;

  if (!workspaceId) {
    const { data: parentOutputs, error: parentError } = await supabase
      .from("learning_outputs")
      .select("id, workspace_id")
      .eq("legacy_parent_study_set_id", studySetId)
      .eq("kind", "quiz")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (parentError) {
      return {
        error: NextResponse.json(
          { error: parentError.message },
          { status: 500 },
        ),
      };
    }
    workspaceId = parentOutputs?.workspace_id ?? null;
    learningOutputId = parentOutputs?.id ?? null;
  }

  if (!workspaceId) {
    return {
      error: NextResponse.json(
        {
          error: "validation_error",
          message:
            "Study set is not linked to a workspace learning output. Use the workspace quiz route with explicit canonicalVersionIds.",
        },
        { status: 400 },
      ),
    };
  }

  if (explicitVersionIds && explicitVersionIds.length > 0) {
    return { workspaceId, canonicalVersionIds: explicitVersionIds };
  }

  if (learningOutputId) {
    const { data: snapshots, error: snapError } = await supabase
      .from("output_source_snapshots")
      .select("canonical_version_id, ordinal")
      .eq("output_id", learningOutputId)
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
      return { workspaceId, canonicalVersionIds: fromSnapshots };
    }
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
 * Narrow legacy adapter: resolve workspace/bridge sources and delegate to
 * workspace-native multi-source generation. Does not call replace_quiz_questions.
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

  let questionCountOverride: number | undefined;
  let explicitVersionIds: string[] | undefined;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const rawBody = await request.json();
      if (rawBody !== null && typeof rawBody === "object") {
        const body = legacyQuizGenerateBodySchema.parse(rawBody);
        questionCountOverride = body.questionCount;
        explicitVersionIds = body.canonicalVersionIds;
      }
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
  }

  const resolved = await resolveWorkspaceSources({
    supabase: auth.supabase,
    userId: auth.user.id,
    studySetId: id,
    explicitVersionIds,
  });
  if ("error" in resolved) {
    return resolved.error as Response;
  }

  let reservationToken: string | null = null;
  let quotaCommitted = false;

  try {
    const result = await runMultiSourceQuizGenerate({
      supabase: auth.supabase,
      user: auth.user,
      userId: auth.user.id,
      workspaceId: resolved.workspaceId,
      canonicalVersionIds: resolved.canonicalVersionIds,
      questionCountOverride,
    });

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

    console.error("quiz generate route error", error);
    return NextResponse.json(
      { error: "internal_error", message: "Quiz generation failed." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
