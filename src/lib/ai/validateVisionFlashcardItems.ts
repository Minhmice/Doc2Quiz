/**
 * Flashcard vision JSON → typed rows. When `requireSourcePages` is true (flashcard product lane),
 * any card missing valid, in-bounds `sourcePages` is **dropped** — never silently invent page ranges.
 */

import type {
  FlashcardVisionItem,
} from "@/types/visionParse";
import type {
  ValidateVisionPageBounds,
} from "@/lib/ai/validateVisionQuizItems";

export type ValidateVisionFlashcardOptions = {
  requireSourcePages?: boolean;
  pageBounds?: ValidateVisionPageBounds;
};

function readSourcePages(
  rec: Record<string, unknown>,
  opts: ValidateVisionFlashcardOptions | undefined,
): number[] | null {
  if (!opts?.requireSourcePages) {
    return null;
  }
  const sp = rec.sourcePages;
  if (!Array.isArray(sp) || sp.length === 0) {
    return null;
  }
  const pages: number[] = [];
  for (const x of sp) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1) {
      return null;
    }
    pages.push(x);
  }
  if (opts.pageBounds) {
    const { minPage, maxPage } = opts.pageBounds;
    if (!pages.every((p) => p >= minPage && p <= maxPage)) {
      return null;
    }
  }
  return pages;
}

function extractCardsArray(raw: unknown): unknown[] {
  if (raw === null || typeof raw !== "object") {
    return [];
  }
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.cards)) {
    return o.cards;
  }
  if (Array.isArray(o.flashcards)) {
    return o.flashcards;
  }
  return [];
}

/** Normalize raw model rows into flashcard vision items. */
export function validateVisionFlashcardItems(
  parsed: unknown,
  opts?: ValidateVisionFlashcardOptions,
): FlashcardVisionItem[] {
  const items = extractCardsArray(parsed);
  const out: FlashcardVisionItem[] = [];
  for (const item of items) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const front = rec.front;
    const back = rec.back;
    if (typeof front !== "string" || typeof back !== "string") {
      continue;
    }
    if (front.trim().length === 0 || back.trim().length === 0) {
      continue;
    }
    const sourcePages = readSourcePages(rec, opts);
    if (opts?.requireSourcePages && sourcePages === null) {
      continue;
    }
    out.push({
      kind: "flashcard",
      front: front.trim(),
      back: back.trim(),
      confidence: 0,
      ...(sourcePages !== null ? { sourcePages } : {}),
    });
  }
  return out;
}
