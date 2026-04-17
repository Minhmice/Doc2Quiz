"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { requireBrowserUserId } from "./user";

export async function recordCloudQuizCompletion(input: {
  studySetId: string;
  totalQuestions: number;
  correctCount: number;
  wrongQuestionIds: string[];
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireBrowserUserId();
  const now = new Date().toISOString();

  const { data: session, error: sessionErr } = await supabase
    .from("quiz_sessions")
    .insert({
      user_id: userId,
      study_set_id: input.studySetId,
      mode: "mcq",
      settings: {
        totalQuestions: input.totalQuestions,
        correctCount: input.correctCount,
      },
      started_at: now,
      ended_at: now,
    })
    .select("id")
    .maybeSingle();

  if (sessionErr) {
    throw sessionErr;
  }

  const sessionId = (session as { id?: string } | null)?.id ?? null;
  if (!sessionId) {
    return;
  }

  const wrongIds = [...new Set(input.wrongQuestionIds)].filter(Boolean);
  if (wrongIds.length === 0) {
    return;
  }

  const { error: wrongErr } = await supabase.from("wrong_history").insert(
    wrongIds.map((questionId) => ({
      user_id: userId,
      question_id: questionId,
      session_id: sessionId,
      session_item_id: null,
      chosen_index: null,
      correct_index: null,
      occurred_at: now,
    })),
  );
  if (wrongErr) {
    throw wrongErr;
  }
}

export async function getCloudMistakeQuestionIds(
  studySetId: string,
): Promise<string[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("wrong_history")
    .select(
      `
        question_id,
        approved_questions!inner (
          study_set_id
        )
      `,
    )
    .eq("approved_questions.study_set_id", studySetId)
    .order("occurred_at", { ascending: false })
    .limit(250);
  if (error) {
    throw error;
  }
  const ids = (data ?? []).map(
    (r) => (r as { question_id?: string | null }).question_id ?? null,
  );
  return ids.filter((x): x is string => typeof x === "string");
}

