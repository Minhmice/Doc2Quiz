import type { ParseOutputMode } from "@/types/visionParse";

export type VisionPromptContext = {
  /** When true, each extracted item must include `sourcePages` (1-based PDF page indices). */
  requirePerItemSourcePages?: boolean;
};

/** Short stable system prompt — mode-specific output contract. */
export function buildVisionSystemPrompt(
  mode: ParseOutputMode,
  ctx?: VisionPromptContext,
): string {
  const strict = ctx?.requirePerItemSourcePages === true;
  if (mode === "flashcard") {
    const schema = strict
      ? '{ "cards": [ { "front": string, "back": string, "sourcePages": number[] } ] }'
      : '{ "cards": [ { "front": string, "back": string } ] }';
    return [
      "Extract flashcards only from the page images you receive.",
      `JSON only, no markdown fences. Top-level: ${schema}.`,
      strict
        ? "Each card must include non-empty `sourcePages`: one or more 1-based PDF page numbers indicating which provided image(s) the card came from."
        : "",
      "Each card must have non-empty front and back from visible document text.",
      "Merge duplicates across pages within this batch; omit incomplete fragments.",
      "If nothing qualifies, return { \"cards\": [] }.",
      "Do not invent content from general knowledge; only what appears in the images.",
      "Preserve the document language (e.g. Vietnamese stays Vietnamese).",
    ]
      .filter((s) => s.length > 0)
      .join(" ");
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
};

export function buildVisionUserPrompt(input: VisionUserPromptInput): string {
  const { mode, startPage, endPage, totalPages, requirePerItemSourcePages } =
    input;
  const range = `pages ${startPage}–${endPage} of ${totalPages} total`;
  const strictNote = requirePerItemSourcePages
    ? " Include `sourcePages` on every item (1-based page indices)."
    : "";
  if (mode === "flashcard") {
    return `Batch covers ${range}.${strictNote} Return only { "cards": [...] } as instructed.`;
  }
  return `Batch covers ${range}.${strictNote} Return only { "questions": [...] } as instructed.`;
}
