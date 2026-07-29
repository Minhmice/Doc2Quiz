import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  CanonicalVersionError,
  CanonicalVersionPersistenceError,
  CanonicalVersionValidationError,
  runCanonicalVersion,
} from "@/lib/pipeline/canonicalVersion";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

export async function POST(
  _req: Request,
  ctx: {
    params: Promise<{
      workspaceId: string;
      documentId: string;
      documentVersionId: string;
    }>;
  },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { workspaceId, documentId, documentVersionId } = await ctx.params;

  try {
    const result = await runCanonicalVersion({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId,
      documentId,
      documentVersionId,
      user: auth.user,
    });

    return NextResponse.json({
      canonicalVersionId: result.canonicalVersionId,
      versionNumber: result.versionNumber,
      sectionCount: result.sectionCount,
      title: result.title,
      model: result.model,
      promptVersion: result.promptVersion,
      parserVersion: result.parserVersion,
      createdAt: result.createdAt,
    });
  } catch (error) {
    if (error instanceof CanonicalVersionValidationError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
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

    console.error("workspace canonicalize route error", error);
    return NextResponse.json(
      { error: "internal_error", message: "Canonicalize failed." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
