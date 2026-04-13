import type { FlashcardVisionItem, QuizVisionItem } from "@/types/visionParse";

function clamp01(n: number): number {
  if (Number.isNaN(n)) {
    return 0;
  }
  return Math.max(0, Math.min(1, n));
}

/** Heuristic structure quality for quiz rows (not model self-score). */
export function computeQuizConfidence(item: QuizVisionItem): number {
  const q = item.question.trim();
  if (q.length < 8) {
    return clamp01(0.15);
  }
  let score = 0.45;
  if (q.length >= 24) {
    score += 0.15;
  }
  const opts = item.options;
  const minOpt = Math.min(...opts.map((o) => o.trim().length));
  if (minOpt >= 2) {
    score += 0.15;
  }
  if (item.correctIndex >= 0 && item.correctIndex <= 3) {
    score += 0.15;
  }
  if (opts.every((o) => o.trim().length > 0)) {
    score += 0.1;
  }
  return clamp01(Math.max(item.confidence, score));
}

export function computeFlashcardConfidence(item: FlashcardVisionItem): number {
  const f = item.front.trim();
  const b = item.back.trim();
  if (f.length < 2 || b.length < 2) {
    return clamp01(0.1);
  }
  let score = 0.4;
  if (f.length >= 8 && b.length >= 8) {
    score += 0.25;
  }
  if (f.length >= 20 || b.length >= 20) {
    score += 0.15;
  }
  return clamp01(Math.max(item.confidence, score));
}
