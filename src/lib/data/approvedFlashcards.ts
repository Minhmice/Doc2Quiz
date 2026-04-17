"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import type { ApprovedFlashcardBank, FlashcardVisionItem } from "@/types/visionParse";
import { requireBrowserUserId } from "./user";

type ApprovedFlashcardRow = {
  id: string;
  front: string;
  back: string;
  source: unknown;
  created_at: string;
};

function rowToItem(row: ApprovedFlashcardRow): FlashcardVisionItem {
  const src =
    row.source && typeof row.source === "object"
      ? (row.source as Partial<FlashcardVisionItem>)
      : null;
  const fallback: FlashcardVisionItem = {
    kind: "flashcard",
    id: row.id,
    front: row.front ?? "",
    back: row.back ?? "",
    confidence: 0.5,
  };
  if (!src) return fallback;
  return {
    ...fallback,
    ...src,
    kind: "flashcard",
    id: src.id ?? fallback.id,
  };
}

export async function getCloudApprovedFlashcardBank(
  studySetId: string,
): Promise<ApprovedFlashcardBank | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("approved_flashcards")
    .select("id, front, back, source, created_at")
    .eq("study_set_id", studySetId)
    .order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as ApprovedFlashcardRow[];
  if (rows.length === 0) {
    return null;
  }
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    items: rows.map(rowToItem),
  };
}

export async function replaceCloudApprovedFlashcardsForStudySet(
  studySetId: string,
  bank: ApprovedFlashcardBank,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireBrowserUserId();

  const { error: delErr } = await supabase
    .from("approved_flashcards")
    .delete()
    .eq("study_set_id", studySetId);
  if (delErr) {
    throw delErr;
  }

  const payload = bank.items.map((it) => {
    const id = it.id || createRandomUuid();
    return {
      user_id: userId,
      id,
      study_set_id: studySetId,
      front: it.front,
      back: it.back,
      source: it,
      updated_at: new Date().toISOString(),
    };
  });

  if (payload.length === 0) {
    return;
  }

  const { error: insErr } = await supabase.from("approved_flashcards").insert(payload);
  if (insErr) {
    throw insErr;
  }
}

