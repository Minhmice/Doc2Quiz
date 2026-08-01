import type { SupabaseClient } from "@supabase/supabase-js";

export async function replaceFlashcards(
  supabase: SupabaseClient,
  params: {
    userId: string;
    studySetId: string;
    rows: Record<string, unknown>[];
  },
): Promise<void> {
  const { error: flashcardDeleteError } = await supabase
    .from("approved_flashcards")
    .delete()
    .eq("study_set_id", params.studySetId)
    .eq("user_id", params.userId);

  if (flashcardDeleteError) throw new Error(flashcardDeleteError.message);

  const { error: questionDeleteError } = await supabase
    .from("approved_questions")
    .delete()
    .eq("study_set_id", params.studySetId)
    .eq("user_id", params.userId);

  if (questionDeleteError) throw new Error(questionDeleteError.message);

  if (params.rows.length > 0) {
    const { error: insertError } = await supabase
      .from("approved_flashcards")
      .insert(params.rows);

    if (insertError) throw new Error(insertError.message);
  }

  const { error: stageError } = await supabase
    .from("study_sets")
    .update({ pipeline_stage: "flashcards", content_kind: "flashcards" })
    .eq("id", params.studySetId)
    .eq("user_id", params.userId);

  if (stageError) throw new Error(stageError.message);
}
