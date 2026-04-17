"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StudyContentKind, StudySetMeta, StudySetStatus } from "@/types/studySet";
import type { TableRow } from "@/types/supabase";
import { requireBrowserUserId } from "./user";

type StudySetDocumentPreview = Pick<
  TableRow<"study_set_documents">,
  "source_file_name" | "page_count"
>;

type CloudStudySetRow = Pick<
  TableRow<"study_sets">,
  "id" | "title" | "description" | "created_at" | "updated_at"
> & {
  study_set_documents?: StudySetDocumentPreview[] | null;
};

function mapStudySetRowToMeta(row: CloudStudySetRow): StudySetMeta {
  const doc = Array.isArray(row.study_set_documents)
    ? (row.study_set_documents[0] ?? null)
    : null;

  return {
    id: row.id,
    title: row.title,
    subtitle: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceFileName: doc?.source_file_name ?? undefined,
    pageCount: doc?.page_count ?? undefined,
    status: "draft",
    contentKind: "quiz",
  };
}

async function countForTableByStudySetId(
  table: "approved_questions" | "approved_flashcards",
  studySetId: string,
): Promise<number> {
  const supabase = createSupabaseBrowserClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { head: true, count: "exact" })
    .eq("study_set_id", studySetId);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function listCloudStudySetMetas(): Promise<StudySetMeta[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("study_sets")
    .select(
      `
        id,
        title,
        description,
        created_at,
        updated_at,
        study_set_documents (
          source_file_name,
          page_count
        )
      `,
    )
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }
  const rows = (data ?? []) as CloudStudySetRow[];
  const metas = rows.map(mapStudySetRowToMeta);
  await Promise.all(
    metas.map(async (m) => {
      const x = await getCloudStudySetCountsAndKind(m.id);
      m.status = x.status;
      m.contentKind = x.contentKind;
    }),
  );
  return metas;
}

export async function getCloudStudySetMeta(id: string): Promise<StudySetMeta | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("study_sets")
    .select(
      `
        id,
        title,
        description,
        created_at,
        updated_at,
        study_set_documents (
          source_file_name,
          page_count
        )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  const meta = mapStudySetRowToMeta(data as CloudStudySetRow);
  const x = await getCloudStudySetCountsAndKind(meta.id);
  meta.status = x.status;
  meta.contentKind = x.contentKind;
  return meta;
}

export async function renameCloudStudySetTitle(input: {
  id: string;
  title: string;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("study_sets")
    .update({ title: input.title, updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) {
    throw error;
  }
}

export async function updateCloudStudySetMeta(input: {
  id: string;
  title: string;
  subtitle?: string;
  sourceFileName?: string;
  pageCount?: number;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error: setErr } = await supabase
    .from("study_sets")
    .update({
      title: input.title,
      description: input.subtitle ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (setErr) {
    throw setErr;
  }

  if (input.sourceFileName !== undefined || input.pageCount !== undefined) {
    const userId = await requireBrowserUserId();
    const { error: docErr } = await supabase.from("study_set_documents").upsert(
      {
        user_id: userId,
        study_set_id: input.id,
        source_file_name: input.sourceFileName ?? null,
        page_count:
          typeof input.pageCount === "number" ? Math.max(0, input.pageCount) : null,
        extracted_text: "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,study_set_id" },
    );
    if (docErr) {
      throw docErr;
    }
  }
}

export async function deleteCloudStudySet(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("study_sets").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function createCloudStudySetWithDocument(input: {
  title: string;
  subtitle?: string;
  sourceFileName?: string;
  pageCount?: number;
  extractedText: string;
}): Promise<{ studySetId: string }> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireBrowserUserId();

  const { data: setRow, error: setErr } = await supabase
    .from("study_sets")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.subtitle ?? null,
    })
    .select("id")
    .maybeSingle();
  if (setErr) {
    throw setErr;
  }
  const studySetId = (setRow as { id?: string } | null)?.id ?? null;
  if (!studySetId) {
    throw new Error("Failed to create study set.");
  }

  const { error: docErr } = await supabase.from("study_set_documents").insert({
    user_id: userId,
    study_set_id: studySetId,
    source_file_name: input.sourceFileName ?? null,
    page_count: typeof input.pageCount === "number" ? Math.max(0, input.pageCount) : null,
    extracted_text: input.extractedText,
  });
  if (docErr) {
    await supabase.from("study_sets").delete().eq("id", studySetId);
    throw docErr;
  }

  return { studySetId };
}

export async function getCloudStudySetCountsAndKind(studySetId: string): Promise<{
  contentKind: StudyContentKind;
  approvedCount: number;
  status: StudySetStatus;
}> {
  const [flashcards, questions] = await Promise.all([
    countForTableByStudySetId("approved_flashcards", studySetId),
    countForTableByStudySetId("approved_questions", studySetId),
  ]);

  const contentKind: StudyContentKind = flashcards > 0 ? "flashcards" : "quiz";
  const approvedCount = Math.max(flashcards, questions);
  const status: StudySetStatus = approvedCount > 0 ? "ready" : "draft";

  return { contentKind, approvedCount, status };
}

