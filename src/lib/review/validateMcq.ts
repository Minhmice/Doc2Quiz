import type { Question } from "@/types/question";

export function hasValidCorrectIndex(q: Question): boolean {
  const ci = q.correctIndex;
  return (
    typeof ci === "number" &&
    Number.isInteger(ci) &&
    ci >= 0 &&
    ci <= 3
  );
}

export function isMcqComplete(q: Question): boolean {
  if (typeof q.question !== "string" || q.question.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    return false;
  }
  if (
    !q.options.every(
      (o): o is string => typeof o === "string" && o.trim().length > 0,
    )
  ) {
    return false;
  }
  return hasValidCorrectIndex(q);
}

export function allMcqsComplete(questions: Question[]): boolean {
  return questions.every(isMcqComplete);
}
