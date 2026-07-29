import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  resolveLegacyStudySetBridge,
  resolveLegacyWorkspaceDocument,
} from "@/lib/workspaces/legacyBridge";

type SupabaseServer = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
>;

async function loadLatestCanonicalVersion(
  supabase: SupabaseServer,
  documentVersionId: string,
) {
  const { data, error } = await supabase
    .from("canonical_versions")
    .select(
      "id, canonical_markdown, metadata, document_version_id, version_number",
    )
    .eq("document_version_id", documentVersionId)
    .is("deleted_at", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function loadCanonicalFromSnapshots(
  supabase: SupabaseServer,
  outputId: string,
) {
  const { data, error } = await supabase
    .from("output_source_snapshots")
    .select(
      "canonical_markdown, sections, canonical_metadata, canonical_version_id, ordinal",
    )
    .eq("output_id", outputId)
    .order("ordinal", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

/**
 * Legacy set-ID canonical reader adapter.
 * Reads workspace-native canonical versions / frozen snapshots — never mutates
 * canonical_documents or calls replace_canonical_content.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { id: studySetId } = await ctx.params;
  const { supabase, user } = auth;

  const bridge = await resolveLegacyStudySetBridge({
    supabase,
    studySetId,
    routeKind: "canonical",
    userId: user.id,
  });

  if (!bridge) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { data: studySet, error: studySetError } = await supabase
      .from("study_sets")
      .select("id, title, pipeline_stage")
      .eq("id", studySetId)
      .maybeSingle();

    if (studySetError) {
      return NextResponse.json(
        { error: studySetError.message },
        { status: 500 },
      );
    }

    const documentCtx = await resolveLegacyWorkspaceDocument({
      supabase,
      workspaceId: bridge.workspaceId,
    });

    let canonicalMarkdown = "";
    let rawMarkdown = "";
    let metadata: unknown = {};
    let originalFilename: string | null = null;
    let sections: Array<{
      id: string;
      ordinal: number;
      heading: string | null;
      bodyMarkdown: string;
      sectionType: string | null;
      sectionKey: string | null;
    }> = [];

    if (documentCtx?.documentVersionId) {
      const { data: versionRow, error: versionError } = await supabase
        .from("document_versions")
        .select("raw_markdown, original_filename")
        .eq("id", documentCtx.documentVersionId)
        .maybeSingle();

      if (versionError) {
        return NextResponse.json(
          { error: versionError.message },
          { status: 500 },
        );
      }

      rawMarkdown = versionRow?.raw_markdown ?? "";
      originalFilename = versionRow?.original_filename ?? null;

      const canonical = await loadLatestCanonicalVersion(
        supabase,
        documentCtx.documentVersionId,
      );

      if (canonical) {
        canonicalMarkdown = canonical.canonical_markdown ?? "";
        metadata = canonical.metadata ?? {};

        const { data: sectionRows, error: sectionsError } = await supabase
          .from("canonical_version_sections")
          .select(
            "id, ordinal, heading, body_markdown, section_type, section_key",
          )
          .eq("canonical_version_id", canonical.id)
          .order("ordinal", { ascending: true });

        if (sectionsError) {
          return NextResponse.json(
            { error: sectionsError.message },
            { status: 500 },
          );
        }

        sections = (sectionRows ?? []).map((section) => ({
          id: section.id,
          ordinal: section.ordinal,
          heading: section.heading,
          bodyMarkdown: section.body_markdown,
          sectionType: section.section_type,
          sectionKey: section.section_key,
        }));
      }
    }

    // Soft-deleted source: fall back to frozen output snapshots for study.
    if (!canonicalMarkdown) {
      const snapshot = await loadCanonicalFromSnapshots(
        supabase,
        bridge.outputId,
      );
      if (!snapshot) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      canonicalMarkdown = snapshot.canonical_markdown ?? "";
      metadata = snapshot.canonical_metadata ?? {};
      const snapSections = Array.isArray(snapshot.sections)
        ? snapshot.sections
        : [];
      sections = snapSections.map(
        (
          section: {
            id?: string;
            ordinal?: number;
            heading?: string | null;
            body_markdown?: string;
            bodyMarkdown?: string;
            section_type?: string | null;
            sectionType?: string | null;
            section_key?: string | null;
            sectionKey?: string | null;
          },
          index: number,
        ) => ({
          id: section.id ?? `${bridge.outputId}-sec-${index}`,
          ordinal: section.ordinal ?? index + 1,
          heading: section.heading ?? null,
          bodyMarkdown: section.body_markdown ?? section.bodyMarkdown ?? "",
          sectionType: section.section_type ?? section.sectionType ?? null,
          sectionKey: section.section_key ?? section.sectionKey ?? null,
        }),
      );
    }

    return NextResponse.json({
      data: {
        studySet: {
          id: studySet?.id ?? studySetId,
          title: studySet?.title ?? "",
          pipelineStage: studySet?.pipeline_stage ?? null,
        },
        document: {
          canonicalMarkdown,
          rawMarkdown,
          metadata,
          originalFilename,
        },
        sections,
      },
    });
  } catch (error) {
    console.error("legacy canonical route error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load canonical",
      },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
