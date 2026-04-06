import type { Question } from "@/types/question";
import { hasValidCorrectIndex, isMcqComplete } from "@/lib/review/validateMcq";

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

/** Human-readable issue lines for one question (for UI). */
export function describeQuestionIssues(
  q: Question,
  index1Based: number,
): string | null {
  const parts: string[] = [];

  if (typeof q.question !== "string" || q.question.trim().length === 0) {
    parts.push("unclear or empty stem");
  }

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    parts.push("expected four options");
  } else {
    q.options.forEach((opt, i) => {
      if (typeof opt !== "string" || opt.trim().length === 0) {
        parts.push(`missing option ${OPTION_LABELS[i]}`);
      }
    });
  }

  if (!hasValidCorrectIndex(q)) {
    parts.push("invalid correct answer");
  }

  if (parts.length === 0) {
    return null;
  }

  return `Question ${index1Based}: ${parts.join(", ")}`;
}

/** First N questions that fail completeness, with friendly messages. */
export function collectTopQuestionIssues(
  questions: Question[],
  max = 8,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < questions.length && out.length < max; i++) {
    const q = questions[i]!;
    if (isMcqComplete(q)) {
      continue;
    }
    const line = describeQuestionIssues(q, i + 1);
    if (line) {
      out.push(line);
    }
  }
  return out;
}

/** Heuristic confidence from structural completeness (not model self-report). */
export function extractionConfidencePercent(questions: Question[]): number {
  if (questions.length === 0) {
    return 0;
  }
  const complete = questions.reduce(
    (n, q) => n + (isMcqComplete(q) ? 1 : 0),
    0,
  );
  return Math.round((complete / questions.length) * 100);
}
