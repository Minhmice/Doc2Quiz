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

/** Emitted when `extractedTextCharCount` clears the strong-text bar (grep-stable for UI). */
export const TEXT_LAYER_STRONG = "text_layer_strong";

export type ParseRouteExecutionFamily = "vision_pages" | "layout_chunk";

export type ParseRoutePolicyInput = {
  pageCount: number | null;
  extractedTextCharCount: number;
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

/**
 * Pure policy: recommends layout-chunk **intent** vs vision-first, plus stable reason codes for logs/UI.
 */
export function decideParseRoute(
  input: ParseRoutePolicyInput,
): ParseRouteDecision {
  const { pageCount, extractedTextCharCount, parseStrategy, enableOcr } = input;

  if (parseStrategy === "accurate") {
    return {
      executionFamily: "vision_pages",
      reasonCodes: ["strategy_accurate_vision_first"],
      rationale:
        "Accurate always uses full-page vision first (same as the Accurate parse handler).",
    };
  }

  const strong = hasStrongTextSignal(pageCount, extractedTextCharCount);

  if (parseStrategy === "fast") {
    if (!enableOcr) {
      return {
        executionFamily: "vision_pages",
        reasonCodes: ["strategy_fast", "ocr_disabled_vision_fallback"],
        rationale:
          "Fast needs OCR for layout chunks; OCR is off, so vision-only fallback matches the component.",
      };
    }
    if (strong) {
      return {
        executionFamily: "layout_chunk",
        reasonCodes: ["strategy_fast", TEXT_LAYER_STRONG],
        rationale:
          "Strong PDF text layer for the page count — layout-aware chunk parse is the intended primary path.",
      };
    }
    return {
      executionFamily: "layout_chunk",
      reasonCodes: ["strategy_fast", "text_layer_weak_or_unknown"],
      rationale:
        "Layout-aware chunks are intended; text signal is weak or unknown until OCR runs.",
    };
  }

  // hybrid — mirror Fast for executionFamily; always tag strategy_hybrid
  if (!enableOcr) {
    return {
      executionFamily: "vision_pages",
      reasonCodes: ["strategy_hybrid", "ocr_disabled_vision_fallback"],
      rationale:
        "Hybrid with OCR disabled falls back to full-page vision like Accurate.",
    };
  }
  if (strong) {
    return {
      executionFamily: "layout_chunk",
      reasonCodes: ["strategy_hybrid", TEXT_LAYER_STRONG],
      rationale:
        "Strong text layer — hybrid starts from Fast-style layout chunks; OCR strength gates still apply in the handler.",
    };
  }
  return {
    executionFamily: "layout_chunk",
    reasonCodes: ["strategy_hybrid", "text_layer_weak_or_unknown"],
    rationale:
      "Hybrid prefers Fast-style layout when OCR is usable; text signal alone is weak or unknown.",
  };
}
