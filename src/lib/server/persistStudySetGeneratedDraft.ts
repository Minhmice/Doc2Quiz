import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApprovedBank, Question } from "@/types/question";
import type { ApprovedFlashcardBank, FlashcardVisionItem } from "@/types/visionParse";

function questionToRow(q: Question): Record<string, unknown> {
  return {
    prompt: q.question,
    choices: q.options as unknown as string[],
    correct_index: q.correctIndex,
    explanation: null,
    tags: [],
    source: q as unknown as Record<string, unknown>,
  };
}

/**
 * Replaces approved_* rows for this study set with freshly generated draft content (same tables as review/practice).
 */
export async function persistQuizDraft(
  supabase: SupabaseClient,
  userId: string,
  studySetId: string,
  questions: Question[],
): Promise<void> {
  const now = new Date().toISOString();
  const bank: ApprovedBank = { version: 1, savedAt: now, questions };

  const { data: existingRows, error: exErr } = await supabase
    .from("approved_questions")
    .select("id")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId);
  if (exErr) {
    throw new Error(exErr.message);
  }
  const existingIds = new Set((existingRows ?? []).map((r: { id: string }) => r.id));

  const upserts = bank.questions.map((q) => ({
    id: q.id,
    user_id: userId,
    study_set_id: studySetId,
    ...questionToRow(q),
    updated_at: bank.savedAt,
  }));

  if (upserts.length > 0) {
    const { error: upErr } = await supabase.from("approved_questions").upsert(upserts, {
      onConflict: "id",
    });
    if (upErr) {
      throw new Error(upErr.message);
    }
  } else {
    const { error: delAll } = await supabase
      .from("approved_questions")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId);
    if (delAll) {
      throw new Error(delAll.message);
    }
  }

  const keep = new Set(upserts.map((u) => u.id));
  const toDelete = [...existingIds].filter((id) => !keep.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("approved_questions")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId)
      .in("id", toDelete);
    if (delErr) {
      throw new Error(delErr.message);
    }
  }

  if (upserts.length > 0) {
    const { error: delFc } = await supabase
      .from("approved_flashcards")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId);
    if (delFc) {
      throw new Error(delFc.message);
    }
  }
}

export async function persistFlashcardDraft(
  supabase: SupabaseClient,
  userId: string,
  studySetId: string,
  items: FlashcardVisionItem[],
): Promise<void> {
  const now = new Date().toISOString();
  const bank: ApprovedFlashcardBank = { version: 1, savedAt: now, items };

  const { data: existingRows, error: exErr } = await supabase
    .from("approved_flashcards")
    .select("id")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId);
  if (exErr) {
    throw new Error(exErr.message);
  }
  const existingIds = new Set((existingRows ?? []).map((r: { id: string }) => r.id));

  const upserts = bank.items.map((it) => {
    const id = it.id && it.id.trim().length > 0 ? it.id : createRandomUuid();
    const source = it as unknown as Record<string, unknown>;
    return {
      id,
      user_id: userId,
      study_set_id: studySetId,
      front: it.front,
      back: it.back,
      tags: [] as string[],
      source,
      updated_at: bank.savedAt,
    };
  });

  if (upserts.length > 0) {
    const { error: upErr } = await supabase.from("approved_flashcards").upsert(upserts, {
      onConflict: "id",
    });
    if (upErr) {
      throw new Error(upErr.message);
    }
  } else {
    const { error: delAll } = await supabase
      .from("approved_flashcards")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId);
    if (delAll) {
      throw new Error(delAll.message);
    }
  }

  const keep = new Set(upserts.map((u) => u.id));
  const toDelete = [...existingIds].filter((id) => !keep.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("approved_flashcards")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId)
      .in("id", toDelete);
    if (delErr) {
      throw new Error(delErr.message);
    }
  }

  if (upserts.length > 0) {
    const { error: delQ } = await supabase
      .from("approved_questions")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId);
    if (delQ) {
      throw new Error(delQ.message);
    }
  }
}
