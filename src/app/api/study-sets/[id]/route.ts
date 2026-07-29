import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  resolveLegacyStudySetBridge,
  resolveLegacyWorkspaceDocument,
} from "@/lib/workspaces/legacyBridge";
import {
  patchWorkspaceMetadata,
  softDeleteDocument,
} from "@/lib/workspaces/documentVersions";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
  WorkspaceValidationError,
} from "@/lib/workspaces/errors";

const STUDY_SET_SELECT =
  "id,title,subtitle,pipeline_stage,content_kind,created_at,updated_at";

async function loadStudySetDto(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
  >,
  studySetId: string,
) {
  const { data, error } = await supabase
    .from("study_sets")
    .select(STUDY_SET_SELECT)
    .eq("id", studySetId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await ctx.params;
  const { supabase, user } = auth;

  const bridge = await resolveLegacyStudySetBridge({
    supabase,
    studySetId: id,
    routeKind: "metadata",
    userId: user.id,
  });

  if (!bridge) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // Prefer the requested id (parent or bridge row) to keep legacy DTO ids stable.
    const data =
      (await loadStudySetDto(supabase, id)) ??
      (await loadStudySetDto(supabase, bridge.bridgeStudySetId));

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load set",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await ctx.params;
  const { supabase, user } = auth;

  const bridge = await resolveLegacyStudySetBridge({
    supabase,
    studySetId: id,
    routeKind: "metadata",
    userId: user.id,
  });

  if (!bridge) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: {
    title?: string;
    subtitle?: string | null;
    content_kind?: string | null;
    pipeline_stage?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (typeof body.title === "string" || body.subtitle !== undefined) {
      await patchWorkspaceMetadata({
        supabase,
        userId: user.id,
        workspaceId: bridge.workspaceId,
        patch: {
          ...(typeof body.title === "string"
            ? { title: body.title.trim() }
            : {}),
          ...(body.subtitle !== undefined
            ? {
                subtitle:
                  typeof body.subtitle === "string"
                    ? body.subtitle.trim() || null
                    : body.subtitle,
              }
            : {}),
        },
      });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string") {
      patch.title = body.title.trim();
    }
    if (body.subtitle !== undefined) {
      patch.subtitle =
        typeof body.subtitle === "string"
          ? body.subtitle.trim() || null
          : body.subtitle;
    }
    if (body.content_kind !== undefined) {
      patch.content_kind = body.content_kind;
    }
    if (typeof body.pipeline_stage === "string") {
      patch.pipeline_stage = body.pipeline_stage;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("study_sets")
      .update(patch)
      .eq("id", id)
      .select(STUDY_SET_SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof WorkspaceValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof WorkspaceNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof WorkspaceForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Update failed",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await ctx.params;
  const { supabase, user } = auth;

  const bridge = await resolveLegacyStudySetBridge({
    supabase,
    studySetId: id,
    routeKind: "metadata",
    userId: user.id,
  });

  if (!bridge) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const document = await resolveLegacyWorkspaceDocument({
      supabase,
      workspaceId: bridge.workspaceId,
    });

    if (document) {
      await softDeleteDocument({
        supabase,
        userId: user.id,
        workspaceId: bridge.workspaceId,
        documentId: document.documentId,
      });
    }

    // Soft-delete source only — never hard-delete study_sets / outputs / history.
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof WorkspaceForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Delete failed",
      },
      { status: 500 },
    );
  }
}
