import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { formatSupabaseNetworkError } from "@/lib/supabase/networkErrors";
import type { SupportedMimeType } from "@/lib/pipeline/validation";
import {
  runWorkspaceIngest,
  WorkspaceIngestConversionError,
  WorkspaceIngestValidationError,
} from "@/lib/workspaces/createWorkspaceIngest";
import {
  resolveLegacyStudySetBridge,
  resolveLegacyWorkspaceDocument,
} from "@/lib/workspaces/legacyBridge";
import { workspaceIngestJsonBodySchema } from "@/lib/workspaces/schemas";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

/**
 * Legacy set-ID ingest adapter. Appends a workspace document version; does not
 * call mutable legacy runIngest / canonical_documents upsert.
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

  const bridge = await resolveLegacyStudySetBridge({
    supabase: auth.supabase,
    studySetId: id,
    routeKind: "ingest",
    userId: auth.user.id,
  });

  if (!bridge) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const document = await resolveLegacyWorkspaceDocument({
    supabase: auth.supabase,
    workspaceId: bridge.workspaceId,
  });

  if (!document) {
    return NextResponse.json(
      {
        error: "validation_error",
        message:
          "Workspace has no active document for replacement ingest. Soft-deleted sources cannot accept new versions.",
      },
      { status: 400 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }

      const result = await runWorkspaceIngest({
        supabase: auth.supabase,
        userId: auth.user.id,
        workspaceId: bridge.workspaceId,
        documentId: document.documentId,
        payload: { kind: "multipart_file", file },
      });

      return NextResponse.json({
        studySetId: id,
        pipelineStage: "raw" as const,
        rawMarkdownLength: result.rawMarkdownLength,
        workspaceId: result.workspaceId,
        documentId: result.documentId,
        documentVersionId: result.documentVersionId,
        versionNumber: result.versionNumber,
      });
    }

    let jsonBody: unknown;
    try {
      jsonBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const body = workspaceIngestJsonBodySchema.parse(jsonBody);
    const result = await runWorkspaceIngest({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId: bridge.workspaceId,
      documentId: document.documentId,
      payload:
        body.kind === "file_ref"
          ? { ...body, mimeType: body.mimeType as SupportedMimeType }
          : body,
    });

    return NextResponse.json({
      studySetId: id,
      pipelineStage: "raw" as const,
      rawMarkdownLength: result.rawMarkdownLength,
      workspaceId: result.workspaceId,
      documentId: result.documentId,
      documentVersionId: result.documentVersionId,
      versionNumber: result.versionNumber,
    });
  } catch (error) {
    if (error instanceof WorkspaceIngestValidationError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof WorkspaceIngestConversionError) {
      return NextResponse.json(
        { error: "conversion_error", message: error.message },
        { status: 422 },
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
