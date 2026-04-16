/**
 * Phase 12 — unified parse route **intent** (text signal vs OCR vs vision).
 * Aligns with `AiParseSection` handlers: Accurate → vision; Fast/Hybrid →
 * layout-chunk when OCR is on (component still renders pages for OCR/vision).
 *
 * Inputs are counts only — never pass raw `extractedText` (PII / size).
 */
import type { ParseStrategy } from "@/lib/ai/parseLocalStorage";

/** Tunable after UAT — chars per page threshold for “strong” native text signal. */
export const MIN_CHARS_PER_PAGE_FOR_TEXT_SIGNAL = 40;

/** Minimum fraction of sampled pages that must have any text to count as "strong". */
export const MIN_NON_EMPTY_PAGE_RATIO_FOR_TEXT_SIGNAL = 0.8;

/** Emitted when `extractedTextCharCount` clears the strong-text bar (grep-stable for UI). */
export const TEXT_LAYER_STRONG = "text_layer_strong";
export const TEXT_LAYER_WEAK_OR_UNKNOWN = "text_layer_weak_or_unknown";
export const TEXT_LAYER_UNCERTAIN_DEFAULT_VISION =
  "text_layer_uncertain_default_vision";
export const TEXT_LAYER_SAMPLED_FIRST_PAGES = "text_layer_sampled_first_pages";

export type ParseRouteExecutionFamily = "vision_pages" | "layout_chunk";

export type TextLayerSignalInput = {
  sampledPages: number;
  charsPerPage: number;
  nonEmptyPageRatio: number;
};

export type ParseRoutePolicyInput = {
  pageCount: number | null;
  extractedTextCharCount: number;
  /**
   * Phase 25 — numeric-only text-layer signal derived from sampling first pages.
   * Policy remains pure: caller supplies these counts (no pdf.js here).
   */
  textLayerSignal?: TextLayerSignalInput;
  parseStrategy: ParseStrategy;
  enableOcr: boolean;
};

export type ParseRouteDecision = {
  executionFamily: ParseRouteExecutionFamily;
  reasonCodes: readonly string[];
  rationale: string;
};

function hasStrongTextSignal(
  pageCount: number | null,
  extractedTextCharCount: number,
): boolean {
  if (pageCount == null || pageCount <= 0) {
    return false;
  }
  return (
    extractedTextCharCount >= pageCount * MIN_CHARS_PER_PAGE_FOR_TEXT_SIGNAL
  );
}

function classifyTextLayerSignal(
  input: ParseRoutePolicyInput,
): { kind: "strong" | "weak" | "uncertain"; reasonCodes: string[]; hint: string } {
  const { pageCount, extractedTextCharCount, textLayerSignal } = input;

  if (textLayerSignal) {
    const { sampledPages, charsPerPage, nonEmptyPageRatio } = textLayerSignal;
    const reasonCodes = [TEXT_LAYER_SAMPLED_FIRST_PAGES];
    const hint = `text signal (sampledPages=${sampledPages}, chars/page=${charsPerPage.toFixed(
      0,
    )}, nonEmptyRatio=${nonEmptyPageRatio.toFixed(2)})`;

    if (sampledPages <= 0) {
      return { kind: "uncertain", reasonCodes, hint };
    }

    const strong =
      charsPerPage >= MIN_CHARS_PER_PAGE_FOR_TEXT_SIGNAL &&
      nonEmptyPageRatio >= MIN_NON_EMPTY_PAGE_RATIO_FOR_TEXT_SIGNAL;
    return {
      kind: strong ? "strong" : "weak",
      reasonCodes: strong ? [...reasonCodes, TEXT_LAYER_STRONG] : [...reasonCodes, TEXT_LAYER_WEAK_OR_UNKNOWN],
      hint,
    };
  }

  if (pageCount == null || pageCount <= 0) {
    return {
      kind: "uncertain",
      reasonCodes: [TEXT_LAYER_UNCERTAIN_DEFAULT_VISION],
      hint: "text signal unknown (no pageCount / no sampled signal)",
    };
  }

  const strong = hasStrongTextSignal(pageCount, extractedTextCharCount);
  return {
    kind: strong ? "strong" : "weak",
    reasonCodes: [strong ? TEXT_LAYER_STRONG : TEXT_LAYER_WEAK_OR_UNKNOWN],
    hint: `text signal (pageCount=${pageCount}, extractedChars=${extractedTextCharCount})`,
  };
}

/**
 * Pure policy: recommends layout-chunk **intent** vs vision-first, plus stable reason codes for logs/UI.
 */
export function decideParseRoute(
  input: ParseRoutePolicyInput,
): ParseRouteDecision {
  const { parseStrategy, enableOcr } = input;

  if (parseStrategy === "accurate") {
    return {
      executionFamily: "vision_pages",
      reasonCodes: ["strategy_accurate_vision_first"],
      rationale: "Accurate: vision-first (full-page).",
    };
  }

  const text = classifyTextLayerSignal(input);

  if (parseStrategy === "fast") {
    if (!enableOcr) {
      return {
        executionFamily: "vision_pages",
        reasonCodes: ["strategy_fast", "ocr_disabled_vision_fallback"],
        rationale: "Fast: OCR off → vision fallback.",
      };
    }
    if (text.kind === "uncertain") {
      return {
        executionFamily: "vision_pages",
        reasonCodes: ["strategy_fast", TEXT_LAYER_UNCERTAIN_DEFAULT_VISION],
        rationale: `Fast: ${text.hint} → uncertain, default vision.`,
      };
    }
    if (text.kind === "strong") {
      return {
        executionFamily: "layout_chunk",
        reasonCodes: ["strategy_fast", ...text.reasonCodes],
        rationale: `Fast: ${text.hint} → strong, prefer layout chunks.`,
      };
    }
    return {
      executionFamily: "layout_chunk",
      reasonCodes: ["strategy_fast", ...text.reasonCodes],
      rationale: `Fast: ${text.hint} → weak/unknown, still prefer layout chunks.`,
    };
  }

  // hybrid — mirror Fast for executionFamily; always tag strategy_hybrid
  if (!enableOcr) {
    return {
      executionFamily: "vision_pages",
      reasonCodes: ["strategy_hybrid", "ocr_disabled_vision_fallback"],
      rationale: "Hybrid: OCR off → vision fallback.",
    };
  }
  if (text.kind === "uncertain") {
    return {
      executionFamily: "vision_pages",
      reasonCodes: ["strategy_hybrid", TEXT_LAYER_UNCERTAIN_DEFAULT_VISION],
      rationale: `Hybrid: ${text.hint} → uncertain, default vision.`,
    };
  }
  if (text.kind === "strong") {
    return {
      executionFamily: "layout_chunk",
      reasonCodes: ["strategy_hybrid", ...text.reasonCodes],
      rationale: `Hybrid: ${text.hint} → strong, prefer layout chunks.`,
    };
  }
  return {
    executionFamily: "layout_chunk",
    reasonCodes: ["strategy_hybrid", ...text.reasonCodes],
    rationale: `Hybrid: ${text.hint} → weak/unknown, prefer layout chunks.`,
  };
}
