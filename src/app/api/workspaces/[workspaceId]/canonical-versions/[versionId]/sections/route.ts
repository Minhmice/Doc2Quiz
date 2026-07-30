import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  assertNoFullDocumentPayload,
  canonicalSectionPageQuerySchema,
  getCanonicalSectionPage,
} from "@/lib/workspaces/canonicalReader";
import { WorkspaceNotFoundError } from "@/lib/workspaces/errors";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ workspaceId: string; versionId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { workspaceId, versionId } = await ctx.params;
  const url = new URL(request.url);

  try {
    const query = canonicalSectionPageQuerySchema.parse({
      afterOrdinal: url.searchParams.get("afterOrdinal") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const data = await getCanonicalSectionPage({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId,
      versionId,
      afterOrdinal: query.afterOrdinal,
      limit: query.limit,
    });

    assertNoFullDocumentPayload(data as unknown as Record<string, unknown>);

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Invalid section page query (afterOrdinal, limit 1–50).",
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

    console.error("canonical section page route error", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load canonical sections.",
      },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
