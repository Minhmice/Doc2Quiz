import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import {
  CanonicalVersionError,
  CanonicalVersionPersistenceError,
  CanonicalVersionValidationError,
  runCanonicalVersion,
} from "@/lib/pipeline/canonicalVersion";
import {
  resolveLegacyStudySetBridge,
  resolveLegacyWorkspaceDocument,
} from "@/lib/workspaces/legacyBridge";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

/**
 * Legacy set-ID canonicalize adapter.
 * Appends an immutable canonical_version — never calls replace_canonical_content.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { id } = await ctx.params;

  const bridge = await resolveLegacyStudySetBridge({
    supabase: auth.supabase,
    studySetId: id,
    routeKind: "canonicalize",
    userId: auth.user.id,
  });

  if (!bridge) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const document = await resolveLegacyWorkspaceDocument({
    supabase: auth.supabase,
    workspaceId: bridge.workspaceId,
  });

  if (!document?.documentVersionId) {
    return NextResponse.json(
      {
        error: "validation_error",
        message:
          "No active document version available to canonicalize. Soft-deleted sources cannot be re-canonicalized.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await runCanonicalVersion({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId: bridge.workspaceId,
      documentId: document.documentId,
      documentVersionId: document.documentVersionId,
      user: auth.user,
    });

    return NextResponse.json({
      studySetId: id,
      pipelineStage: "canonical" as const,
      sectionCount: result.sectionCount,
      title: result.title,
      canonicalVersionId: result.canonicalVersionId,
      versionNumber: result.versionNumber,
      processingMode: result.processingMode,
      fallbackReason: result.fallbackReason,
    });
  } catch (error) {
    if (error instanceof CanonicalVersionValidationError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof WorkspaceNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof WorkspaceForbiddenError) {
      return NextResponse.json(
        { error: "forbidden", message: error.message },
        { status: 403 },
      );
    }
    if (error instanceof CanonicalVersionError || error instanceof ZodError) {
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
    if (error instanceof CanonicalVersionPersistenceError) {
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
