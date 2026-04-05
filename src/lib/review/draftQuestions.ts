import { validateQuestionsFromJson } from "@/lib/ai/validateQuestions";
import type { Question } from "@/types/question";
import { LS_DRAFT_QUESTIONS } from "@/types/question";

export function loadDraftQuestions(): Question[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(LS_DRAFT_QUESTIONS);
    if (!raw) {
      return [];
    }
    const data = JSON.parse(raw) as { questions?: unknown };
    return validateQuestionsFromJson(
      { questions: data.questions },
      { preserveIds: true },
    );
  } catch {
    return [];
  }
}

export function persistDraftQuestions(questions: Question[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(
      LS_DRAFT_QUESTIONS,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        questions,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
