"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import type { ApprovedBank, Question } from "@/types/question";
import { validateQuestionsFromJson } from "@/lib/ai/validateQuestions";
import type { TableRow } from "@/types/supabase";
import { requireBrowserUserId } from "./user";
import { toJson } from "./json";

type ApprovedQuestionRow = Pick<
  TableRow<"approved_questions">,
  | "id"
  | "prompt"
  | "choices"
  | "correct_index"
  | "explanation"
  | "source"
  | "created_at"
>;

function rowToQuestion(row: ApprovedQuestionRow): Question {
  const fallback: Question = {
    id: row.id,
    question: row.prompt ?? "",
    options: [
      String(row.choices?.[0] ?? ""),
      String(row.choices?.[1] ?? ""),
      String(row.choices?.[2] ?? ""),
      String(row.choices?.[3] ?? ""),
    ] as [string, string, string, string],
    correctIndex: (Math.min(3, Math.max(0, row.correct_index ?? 0)) as 0 | 1 | 2 | 3),
    ...(row.explanation ? { mappingReason: row.explanation } : {}),
  };
  const [validated] = validateQuestionsFromJson([row.source], {
    preserveIds: true,
  });
  return validated ? { ...validated, id: row.id } : fallback;
}

export async function getCloudApprovedQuestionBank(
  studySetId: string,
): Promise<ApprovedBank | null> {
  const supabase = createSupabaseBrowserClient();
  // Supabase type inference can degrade to `never` when schema typing isn't fully wired;
  // keep this module buildable while preserving runtime behavior.
  const { data, error } = await (supabase as any)
    .from("approved_questions")
    .select("id, prompt, choices, correct_index, explanation, source, created_at")
    .eq("study_set_id", studySetId)
    .order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as ApprovedQuestionRow[];
  if (rows.length === 0) {
    return null;
  }
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    questions: rows.map(rowToQuestion),
  };
}

export async function replaceCloudApprovedQuestionsForStudySet(
  studySetId: string,
  bank: ApprovedBank,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireBrowserUserId();

  const { error: delErr } = await (supabase as any)
    .from("approved_questions")
    .delete()
    .eq("study_set_id", studySetId);
  if (delErr) {
    throw delErr;
  }

  const payload = bank.questions.map((q) => {
    const id = q.id || createRandomUuid();
    return {
      user_id: userId,
      id,
      study_set_id: studySetId,
      prompt: q.question,
      choices: [...q.options],
      correct_index: q.correctIndex,
      explanation: null,
      source: toJson(q),
      updated_at: new Date().toISOString(),
    };
  });

  if (payload.length === 0) {
    return;
  }

  const { error: insErr } = await (supabase as any)
    .from("approved_questions")
    .insert(payload);
  if (insErr) {
    throw insErr;
  }
}

