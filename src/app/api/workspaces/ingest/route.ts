import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  runWorkspaceIngest,
  WorkspaceIngestConversionError,
  WorkspaceIngestValidationError,
} from "@/lib/workspaces/createWorkspaceIngest";
import { workspaceIngestJsonBodySchema } from "@/lib/workspaces/schemas";
import { formatSupabaseNetworkError } from "@/lib/supabase/networkErrors";
import type { SupportedMimeType } from "@/lib/pipeline/validation";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

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

      const result = await runWorkspaceIngest({
        supabase: auth.supabase,
        userId: auth.user.id,
        payload: { kind: "multipart_file", file },
        workspaceId: form.get("workspaceId")?.toString() ?? null,
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
    const { workspaceId, ...payload } = body;
    const result = await runWorkspaceIngest({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId: workspaceId ?? null,
      payload:
        payload.kind === "file_ref"
          ? { ...payload, mimeType: payload.mimeType as SupportedMimeType }
          : payload,
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
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid ingest request body." },
        { status: 400 },
      );
    }

    console.error("workspace ingest route error", error);
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
