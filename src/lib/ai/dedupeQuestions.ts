import type { Question } from "@/types/question";

/** Collapse whitespace and case for stable duplicate detection. */
export function questionStemKey(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Drop later duplicates (same stem); preserves first-seen order. */
export function dedupeQuestionsByStem(questions: Question[]): Question[] {
  const seen = new Set<string>();
  const out: Question[] = [];
  const emptyMarker = "__empty_stem__";
  for (const q of questions) {
    const k = questionStemKey(q.question);
    const dedupeKey = k.length === 0 ? emptyMarker : k;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    out.push(q);
  }
  return out;
}
