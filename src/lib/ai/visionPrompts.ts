/**
 * Vision batch prompts for quiz (MCQ) vs flashcard (theory-only) lanes.
 *
 * Product split (migration): **Flashcards are vision-only, theory-only** — no OCR/chunk/hybrid,
 * no `Question[]` / MCQ prompts in the flashcard lane. **Quiz** owns MCQ extraction, parsers,
 * and review routes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUIZ LANE (mode === "quiz"):
 *   - Question extraction only (MCQ format: question, 4 options, correctIndex).
 *   - Do NOT generate flashcards, concept cards, or summaries.
 *   - Quiz is VISION-ONLY — no OCR or text-chunk prompts in this module.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { FlashcardGenerationConfig } from "@/types/flashcardGeneration";
import type { ParseOutputMode } from "@/types/visionParse";

export type VisionPromptContext = {
  /** When true, each extracted item must include `sourcePages` (1-based PDF page indices). */
  requirePerItemSourcePages?: boolean;
  /** Flashcard lane: controls density, depth, and topical focus (theory cards only). */
  flashcardGeneration?: FlashcardGenerationConfig;
};

function flashcardTargetGuidance(cfg: FlashcardGenerationConfig): string {
  if (cfg.targetCount === "auto") {
    return "Target card count: auto — choose a reasonable number of high-signal theory cards for this page batch (omit noise).";
  }
  return `Target card count band: aim for roughly ${cfg.targetCount} strong theory cards across the **full document** when aggregating mentally; for **this batch's pages only**, extract what the images support without padding weak cards.`;
}

function flashcardDepthGuidance(cfg: FlashcardGenerationConfig): string {
  if (cfg.learningDepth === "quick_recall") {
    return "Learning depth: quick recall — backs are short reminders; fronts name the concept.";
  }
  if (cfg.learningDepth === "deep") {
    return "Learning depth: deep — backs may include short structured explanations, caveats, or mini-lists when the source supports them.";
  }
  return "Learning depth: standard — balanced front/back length for spaced repetition.";
}

function flashcardFocusGuidance(cfg: FlashcardGenerationConfig): string {
  const byMode: Record<FlashcardGenerationConfig["focusMode"], string> = {
    definitions:
      "Focus: definitions — prioritize precise definitions and terminology.",
    key_points:
      "Focus: key points — distill main takeaways and section themes.",
    formulas:
      "Focus: formulas & notation — equations, symbols, units when visible.",
    processes:
      "Focus: processes — ordered steps, mechanisms, algorithms as theory.",
    comparisons:
      "Focus: comparisons — contrasts, tradeoffs, before/after as concept pairs.",
    mixed:
      "Focus: mixed — combine the above proportionally to what the pages emphasize.",
  };
  return byMode[cfg.focusMode];
}

/**
 * Quiz lane: question extraction only (MCQ).
 * Do not generate flashcards, concept cards, or summaries.
 * Quiz is vision-only — no OCR or text-chunk prompts.
 *
 * Flashcard lane: theory/concept extraction only.
 * Do not generate MCQ or quiz-style items in the flashcard lane.
 *
 * Short stable system prompt — mode-specific output contract.
 */
export function buildVisionSystemPrompt(
  mode: ParseOutputMode,
  ctx?: VisionPromptContext,
): string {
  const strict = ctx?.requirePerItemSourcePages === true;
  if (mode === "flashcard") {
    const cfg = ctx?.flashcardGeneration;
    const configBlock =
      cfg !== undefined
        ? [
            flashcardTargetGuidance(cfg),
            flashcardDepthGuidance(cfg),
            flashcardFocusGuidance(cfg),
          ].join(" ")
        : flashcardTargetGuidance({
            targetCount: "auto",
            learningDepth: "standard",
            focusMode: "mixed",
          });
    return [
      "You extract **theory study cards** from textbook / lecture page images — not exam Q&A, not interview questions, not multiple-choice stems.",
      "Each card is a **concept** pair: `front` names or cues the idea; `back` explains or elaborates in neutral study tone.",
      "Do **not** write flashcards as multiple-choice, true/false, or fill-in-blank exam items. Do **not** ask the learner to pick an answer letter.",
      configBlock,
      '{ "cards": [ { "front": string, "back": string, "sourcePages": number[] } ] } — JSON only, no markdown fences.',
      "Each card MUST include non-empty `sourcePages`: one or more **1-based** PDF page numbers from the images in this request that substantiate that card. Use only pages that actually support the card.",
      "If you cannot ground a card in visible pages, omit it. Empty `cards` is allowed.",
      "Merge duplicates across pages in this batch; omit fragments without clear concepts.",
      "Do not invent facts beyond the images; preserve the document language.",
    ].join(" ");
  }
  const schema = strict
    ? '{ "questions": [ { "question": string, "options": [s,s,s,s], "correctIndex": 0|1|2|3, "sourcePages": number[], "includePageImage"?: boolean } ] }'
    : '{ "questions": [ { "question": string, "options": [s,s,s,s], "correctIndex": 0|1|2|3, "includePageImage"?: boolean } ] }';
  return [
    "Extract multiple-choice questions only from the page images you receive.",
    `JSON only, no markdown fences. Top-level: ${schema}.`,
    strict
      ? "Each question must include non-empty `sourcePages`: one or more 1-based PDF page numbers indicating which provided image(s) the MCQ came from."
      : "",
    "Each option string must be answer text only — no leading \"A.\", \"B)\", \"(c)\", \"Đáp án A\", etc.; the UI shows A–D labels separately.",
    "Optional `includePageImage`: false when stem and all four options are plain text only and no page snapshot is needed to answer; omit or true when figures, tables, or handwriting on the page are essential.",
    "Exactly four non-empty options per question; correctIndex in range.",
    "Merge duplicates across pages within this batch; omit incomplete stems.",
    "If nothing qualifies, return { \"questions\": [] }.",
    "Do not invent questions; only visible MCQs from the images.",
    "Preserve the document language.",
  ]
    .filter((s) => s.length > 0)
    .join(" ");
}

export type VisionUserPromptInput = {
  mode: ParseOutputMode;
  startPage: number;
  endPage: number;
  totalPages: number;
  requirePerItemSourcePages?: boolean;
  flashcardGeneration?: FlashcardGenerationConfig;
};

export function buildVisionUserPrompt(input: VisionUserPromptInput): string {
  const {
    mode,
    startPage,
    endPage,
    totalPages,
    requirePerItemSourcePages,
    flashcardGeneration,
  } = input;
  const range = `pages ${startPage}–${endPage} of ${totalPages} total`;
  const strictNote =
    requirePerItemSourcePages || mode === "flashcard"
      ? " Include `sourcePages` on every card (1-based page indices supported by those pages)."
      : "";
  if (mode === "flashcard") {
    const cfgNote =
      flashcardGeneration !== undefined
        ? ` Generation settings: targetCount=${flashcardGeneration.targetCount === "auto" ? "auto" : flashcardGeneration.targetCount}, learningDepth=${flashcardGeneration.learningDepth}, focusMode=${flashcardGeneration.focusMode}.`
        : "";
    return `Batch covers ${range}.${strictNote}${cfgNote} Return only { "cards": [...] } as instructed — theory cards only, JSON only.`;
  }
  const strictQuizNote = requirePerItemSourcePages
    ? " Include `sourcePages` on every item (1-based page indices)."
    : "";
  return `Batch covers ${range}.${strictQuizNote} Return only { "questions": [...] } as instructed.`;
}
