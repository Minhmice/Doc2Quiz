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

function normalizePageIndices(indices: readonly number[], pageCount: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const raw of indices) {
    const n = Math.floor(raw);
    if (n < 1 || n > pageCount) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  out.sort((a, b) => a - b);
  return out;
}

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

/**
 * Finalizes a partially-built page plan by applying invariants:
 * - normalized, de-duped indices
 * - bitmap vision cap enforced (and dropped pages annotated with a stable reason code)
 */
export function finalizePageRoutePlan(args: {
  pageCount: number;
  pages: readonly PageRoutePlanPage[];
  limitsApplied: PageRoutePlan["limitsApplied"];
}): PageRoutePlan {
  const { pageCount, limitsApplied } = args;
  const pages = [...args.pages];

  const textPageIndices = normalizePageIndices(
    pages.filter((p) => p.kind === "text").map((p) => p.pageIndex),
    pageCount,
  );
  const bitmapPageIndicesAll = normalizePageIndices(
    pages.filter((p) => p.kind === "bitmap").map((p) => p.pageIndex),
    pageCount,
  );
  const bitmapPageIndicesForVision = bitmapPageIndicesAll.slice(
    0,
    limitsApplied.visionMaxPages,
  );
  const droppedBitmapPageIndices = bitmapPageIndicesAll.slice(
    limitsApplied.visionMaxPages,
  );

  if (droppedBitmapPageIndices.length > 0) {
    const dropped = new Set(droppedBitmapPageIndices);
    for (const p of pages) {
      if (p.kind !== "bitmap") continue;
      if (!dropped.has(p.pageIndex)) continue;
      if (!p.reasonCodes.includes(PAGE_DROPPED_VISION_CAP)) {
        p.reasonCodes.push(PAGE_DROPPED_VISION_CAP);
      }
    }
  }

  return {
    pageCount,
    pages,
    textPageIndices,
    bitmapPageIndicesAll,
    bitmapPageIndicesForVision,
    droppedBitmapPageIndices,
    droppedBitmapPagesCount: droppedBitmapPageIndices.length,
    limitsApplied,
  };
}

