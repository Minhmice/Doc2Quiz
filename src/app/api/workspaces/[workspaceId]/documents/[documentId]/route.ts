import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  patchDocumentMetadata,
  softDeleteDocument,
} from "@/lib/workspaces/documentVersions";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
  WorkspaceValidationError,
} from "@/lib/workspaces/errors";
import { documentPatchSchema } from "@/lib/workspaces/schemas";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ workspaceId: string; documentId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { workspaceId, documentId } = await ctx.params;

  let jsonBody: unknown;
  try {
    jsonBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "validation_error", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    const patch = documentPatchSchema.parse(jsonBody);
    const data = await patchDocumentMetadata({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId,
      documentId,
      patch,
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError || error instanceof WorkspaceValidationError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message:
            error instanceof ZodError
              ? "Invalid document patch body."
              : error.message,
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

    console.error("document patch route error", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message:
          error instanceof Error ? error.message : "Document update failed.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ workspaceId: string; documentId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { workspaceId, documentId } = await ctx.params;

  try {
    await softDeleteDocument({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId,
      documentId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
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

    console.error("document delete route error", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message:
          error instanceof Error ? error.message : "Document delete failed.",
      },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
