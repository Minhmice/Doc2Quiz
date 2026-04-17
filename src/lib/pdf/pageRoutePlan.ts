export type PageKind = "text" | "bitmap";

export type PageTextLayerSignal = {
  /** 1-based, aligned with pdf.js */
  pageIndex: number;
  /** Total text-layer character count for the page (numeric-only; no strings) */
  charCount: number;
  hasAnyText: boolean;
};

export const PAGE_TEXT_STRONG = "page_text_strong";
export const PAGE_TEXT_WEAK = "page_text_weak";
export const PAGE_SIGNAL_UNKNOWN_DEFAULT_BITMAP =
  "page_signal_unknown_default_bitmap";
export const PAGE_SIGNAL_SAMPLED_TEXT_LAYER = "page_signal_sampled_text_layer";
export const PAGE_DROPPED_VISION_CAP = "page_dropped_vision_cap";

export type PageRoutePlanPage = {
  /** 1-based, aligned with pdf.js */
  pageIndex: number;
  kind: PageKind;
  reasonCodes: string[];
};

export type PageRoutePlan = {
  pageCount: number;
  pages: PageRoutePlanPage[];

  /** 1-based indices */
  textPageIndices: number[];
  /** 1-based indices */
  bitmapPageIndicesAll: number[];
  /** 1-based indices */
  bitmapPageIndicesForVision: number[];
  /** 1-based indices */
  droppedBitmapPageIndices: number[];
  droppedBitmapPagesCount: number;

  limitsApplied: {
    previewFirstPageBudget: number;
    visionMaxPages: number;
  };
};

