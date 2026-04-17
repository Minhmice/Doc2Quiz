"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StudySetDocumentRecord } from "@/types/studySet";
import { requireBrowserUserId } from "./user";

type StudySetDocumentRow = {
  study_set_id: string;
  source_file_name: string | null;
  page_count: number | null;
  extracted_text: string;
};

export async function getCloudStudySetDocument(
  studySetId: string,
): Promise<StudySetDocumentRecord | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("study_set_documents")
    .select("study_set_id, source_file_name, page_count, extracted_text")
    .eq("study_set_id", studySetId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  const row = data as StudySetDocumentRow;
  return {
    studySetId: row.study_set_id,
    extractedText: row.extracted_text ?? "",
    pdfFileName: row.source_file_name ?? undefined,
  };
}

export async function upsertCloudStudySetDocument(input: {
  studySetId: string;
  sourceFileName?: string;
  pageCount?: number;
  extractedText: string;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireBrowserUserId();
  const { error } = await supabase.from("study_set_documents").upsert(
    {
      user_id: userId,
      study_set_id: input.studySetId,
      source_file_name: input.sourceFileName ?? null,
      page_count:
        typeof input.pageCount === "number" ? Math.max(0, input.pageCount) : null,
      extracted_text: input.extractedText,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,study_set_id" },
  );
  if (error) {
    throw error;
  }
}

