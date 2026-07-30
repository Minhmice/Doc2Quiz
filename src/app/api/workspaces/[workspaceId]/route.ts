import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  requireWorkspacePermission,
  WorkspacePermissionError,
} from "@/lib/server/workspaces/permissions";
import { patchWorkspaceMetadata } from "@/lib/workspaces/documentVersions";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
  WorkspaceValidationError,
} from "@/lib/workspaces/errors";
import { workspacePatchSchema } from "@/lib/workspaces/schemas";
import { getWorkspaceDetail } from "@/lib/workspaces/workspaceSummary";

function mapPermissionError(error: WorkspacePermissionError) {
  const status = error.code === "forbidden" ? 403 : 404;
  return NextResponse.json({ error: error.code }, { status });
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { workspaceId } = await ctx.params;

  try {
    const data = await getWorkspaceDetail({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId,
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      return NextResponse.json(
        { error: "not_found", message: error.message },
        { status: 404 },
      );
    }

    console.error("workspace detail route error", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load workspace.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { workspaceId } = await ctx.params;

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
    const patch = workspacePatchSchema.parse(jsonBody);
    await requireWorkspacePermission(
      auth.supabase,
      workspaceId,
      "edit",
      auth.user.id,
    );
    const data = await patchWorkspaceMetadata({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId,
      patch,
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return mapPermissionError(error);
    }
    if (error instanceof ZodError || error instanceof WorkspaceValidationError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message:
            error instanceof ZodError
              ? "Invalid workspace patch body."
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

    console.error("workspace patch route error", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message:
          error instanceof Error ? error.message : "Workspace update failed.",
      },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
