import type { FlashcardVisionItem, ParseOutputMode, QuizVisionItem, VisionParseItem } from "@/types/visionParse";

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function quizKey(item: QuizVisionItem): string {
  return norm(item.question);
}

function flashKey(item: FlashcardVisionItem): string {
  return `${norm(item.front)}||${norm(item.back)}`;
}

/** Remove exact / near-exact duplicates after overlapping batches (mode-aware). */
export function dedupeVisionItems(
  items: VisionParseItem[],
  mode: ParseOutputMode,
): VisionParseItem[] {
  const seen = new Set<string>();
  const out: VisionParseItem[] = [];
  for (const it of items) {
    let key: string;
    if (mode === "flashcard") {
      if (it.kind !== "flashcard") {
        continue;
      }
      key = flashKey(it);
    } else {
      if (it.kind !== "quiz") {
        continue;
      }
      key = quizKey(it);
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(it);
  }
  return out;
}
