import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { id: studySetId } = await ctx.params;
  const userId = auth.user.id;

  const { data: studySet, error: studySetError } = await auth.supabase
    .from("study_sets")
    .select("id, title, pipeline_stage")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (studySetError) {
    return NextResponse.json({ error: studySetError.message }, { status: 500 });
  }
  if (!studySet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: document, error: documentError } = await auth.supabase
    .from("canonical_documents")
    .select("id, raw_markdown, canonical_markdown, metadata, original_filename")
    .eq("study_set_id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 500 });
  }
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: sections, error: sectionsError } = await auth.supabase
    .from("canonical_sections")
    .select(
      "id, ordinal, heading, body_markdown, section_type, section_key",
    )
    .eq("canonical_document_id", document.id)
    .eq("user_id", userId)
    .order("ordinal", { ascending: true });

  if (sectionsError) {
    return NextResponse.json({ error: sectionsError.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      studySet: {
        id: studySet.id,
        title: studySet.title,
        pipelineStage: studySet.pipeline_stage,
      },
      document: {
        canonicalMarkdown: document.canonical_markdown,
        rawMarkdown: document.raw_markdown,
        metadata: document.metadata,
        originalFilename: document.original_filename,
      },
      sections: (sections ?? []).map((section) => ({
        id: section.id,
        ordinal: section.ordinal,
        heading: section.heading,
        bodyMarkdown: section.body_markdown,
        sectionType: section.section_type,
        sectionKey: section.section_key,
      })),
    },
  });
}

export const runtime = "nodejs";
