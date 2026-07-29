/**
 * Typed controls for vision-only theory flashcard generation.
 * Quiz / MCQ owns a separate lane — never mix `Question[]` with this config.
 */

export type FlashcardLearningDepth = "quick_recall" | "standard" | "deep";

export type FlashcardFocusMode =
  | "definitions"
  | "key_points"
  | "formulas"
  | "processes"
  | "comparisons"
  | "mixed";

export type FlashcardGenerationConfig = {
  /** `"auto"` lets the model choose density for the batch; number = target band (10–60) when not auto. */
  targetCount: "auto" | number;
  learningDepth: FlashcardLearningDepth;
  focusMode: FlashcardFocusMode;
};

export const DEFAULT_FLASHCARD_GENERATION_CONFIG: FlashcardGenerationConfig = {
  targetCount: "auto",
  learningDepth: "standard",
  focusMode: "mixed",
};

const TARGET_MIN = 10;
const TARGET_MAX = 60;

/** Clamp and normalize user-facing config before prompts / persistence. */
export function normalizeFlashcardGenerationConfig(
  input: Partial<FlashcardGenerationConfig> | undefined,
): FlashcardGenerationConfig {
  const base = { ...DEFAULT_FLASHCARD_GENERATION_CONFIG, ...input };
  let targetCount: FlashcardGenerationConfig["targetCount"] = base.targetCount;
  if (targetCount !== "auto") {
    const raw =
      typeof targetCount === "number" && Number.isFinite(targetCount)
        ? Math.round(targetCount)
        : 24;
    targetCount = Math.min(TARGET_MAX, Math.max(TARGET_MIN, raw));
  }
  const learningDepth: FlashcardLearningDepth = [
    "quick_recall",
    "standard",
    "deep",
  ].includes(base.learningDepth)
    ? base.learningDepth
    : "standard";
  const focusMode: FlashcardFocusMode = [
    "definitions",
    "key_points",
    "formulas",
    "processes",
    "comparisons",
    "mixed",
  ].includes(base.focusMode)
    ? base.focusMode
    : "mixed";
  return { targetCount, learningDepth, focusMode };
}
