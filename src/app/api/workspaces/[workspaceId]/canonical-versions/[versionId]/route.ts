import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  assertNoFullDocumentPayload,
  getCanonicalVersionMetadata,
} from "@/lib/workspaces/canonicalReader";
import { WorkspaceNotFoundError } from "@/lib/workspaces/errors";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ workspaceId: string; versionId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { workspaceId, versionId } = await ctx.params;

  try {
    const data = await getCanonicalVersionMetadata({
      supabase: auth.supabase,
      userId: auth.user.id,
      workspaceId,
      versionId,
    });

    const payload = { data };
    assertNoFullDocumentPayload(payload.data as unknown as Record<string, unknown>);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      return NextResponse.json(
        { error: "not_found", message: error.message },
        { status: 404 },
      );
    }

    console.error("canonical version metadata route error", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load canonical version.",
      },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
