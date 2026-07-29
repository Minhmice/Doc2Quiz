import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  WorkspaceIngestConversionError,
  WorkspaceIngestValidationError,
} from "@/lib/workspaces/createWorkspaceIngest";
import {
  appendDocumentVersion,
  softDeleteDocumentVersion,
} from "@/lib/workspaces/documentVersions";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";
import {
  softDeleteVersionParamsSchema,
  workspaceIngestJsonBodySchema,
} from "@/lib/workspaces/schemas";
import { formatSupabaseNetworkError } from "@/lib/supabase/networkErrors";
import type { SupportedMimeType } from "@/lib/pipeline/validation";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ workspaceId: string; documentId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { workspaceId, documentId } = await ctx.params;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "validation_error", message: "Missing file" },
          { status: 400 },
        );
      }

      const result = await appendDocumentVersion({
        supabase: auth.supabase,
        userId: auth.user.id,
        workspaceId,
        documentId,
        payload: { kind: "multipart_file", file },
      });

      return NextResponse.json({
        workspaceId: result.workspaceId,
        documentId: result.documentId,
        documentVersionId: result.documentVersionId,
        versionNumber: result.versionNumber,
        conversionStatus: result.conversionStatus,
        rawMarkdownLength: result.rawMarkdownLength,
        title: result.title,
      });
    }

    let jsonBody: unknown;
    try {
      jsonBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const body = workspaceIngestJsonBodySchema.parse(jsonBody);
    const result = await appendDocumentVersion({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId,
      documentId,
      payload:
        body.kind === "file_ref"
          ? { ...body, mimeType: body.mimeType as SupportedMimeType }
          : body,
    });

    return NextResponse.json({
      workspaceId: result.workspaceId,
      documentId: result.documentId,
      documentVersionId: result.documentVersionId,
      versionNumber: result.versionNumber,
      conversionStatus: result.conversionStatus,
      rawMarkdownLength: result.rawMarkdownLength,
      title: result.title,
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
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid version request body." },
        { status: 400 },
      );
    }

    console.error("document version replace route error", error);
    const message =
      error instanceof Error
        ? formatSupabaseNetworkError(error.message)
        : "Version replace failed.";
    return NextResponse.json(
      { error: "internal_error", message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ workspaceId: string; documentId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { workspaceId, documentId } = await ctx.params;
  const url = new URL(request.url);
  const documentVersionId = url.searchParams.get("documentVersionId");

  try {
    const params = softDeleteVersionParamsSchema.parse({ documentVersionId });
    await softDeleteDocumentVersion({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId,
      documentId,
      documentVersionId: params.documentVersionId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "documentVersionId query parameter is required.",
        },
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

    console.error("document version delete route error", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message:
          error instanceof Error ? error.message : "Version delete failed.",
      },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;
