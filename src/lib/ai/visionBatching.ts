import type { PageImageResult } from "@/lib/pdf/renderPagesToImages";
import { VISION_MAX_PAGES_DEFAULT } from "@/lib/pdf/renderPagesToImages";
import type { PageBatchMeta } from "@/types/visionParse";

export type PageBatch = PageBatchMeta & {
  pages: PageImageResult[];
};

/** Legacy Phase 21 sliding windows (overlap dedupe across batch edges). */
export const VISION_BATCH_LEGACY_PAGE_SIZE = 10;
export const VISION_BATCH_LEGACY_OVERLAP = 2;

/**
 * Hard cap on **pages per multimodal chat request** (images + prompt).
 *
 * Rationale (runtime): edge proxies (e.g. Cloudflare) often return **524** after
 * ~100–125s when a single `/v1/chat/completions` carries many full-page JPEGs.
 * Logs also showed **524 at ~125s** for 3-page and 1-page batches on slow routers,
 * so default to **one page per multimodal request** (more round-trips, shorter waits).
 */
export const VISION_MULTIMODAL_MAX_PAGES_PER_REQUEST = 1;

/**
 * `min_requests` — fewest chat calls: windows of up to `VISION_MAX_PAGES_DEFAULT`
 * pages with **overlap 0** (model must tag `sourcePages` per item).
 * `legacy_10_2` — Phase 21 default (10 pages, 2 overlap).
 */
export type VisionBatchingPreset = "min_requests" | "legacy_10_2";

/**
 * Build batches for vision API scheduling (same contract as `buildVisionBatches`).
 */
export function planVisionBatches(
  pages: PageImageResult[],
  preset: VisionBatchingPreset = "min_requests",
): PageBatch[] {
  if (pages.length === 0) {
    return [];
  }
  if (preset === "legacy_10_2") {
    const batchSize = Math.max(
      1,
      Math.min(
        VISION_BATCH_LEGACY_PAGE_SIZE,
        pages.length,
        VISION_MULTIMODAL_MAX_PAGES_PER_REQUEST,
      ),
    );
    const overlap =
      batchSize > 1
        ? Math.min(VISION_BATCH_LEGACY_OVERLAP, batchSize - 1)
        : 0;
    return buildVisionBatches(pages, batchSize, overlap);
  }
  const batchSize = Math.max(
    1,
    Math.min(
      pages.length,
      VISION_MAX_PAGES_DEFAULT,
      VISION_MULTIMODAL_MAX_PAGES_PER_REQUEST,
    ),
  );
  return buildVisionBatches(pages, batchSize, 0);
}

/**
 * Build overlapping windows for vision batch API calls.
 *
 * Invariants:
 * - Every page appears in at least one batch; order preserved.
 * - `overlap` pages repeat at the end of batch K and start of batch K+1.
 * - Last batch may have fewer than `batchSize` pages.
 *
 * Example (20 pages, 1-based pageIndex 1..20, batchSize=10, overlap=2):
 * - Batch 0: pages 1–10
 * - Batch 1: pages 9–18
 * - Batch 2: pages 17–20
 */
export function buildVisionBatches(
  pages: PageImageResult[],
  batchSize = 10,
  overlap = 2,
): PageBatch[] {
  if (pages.length === 0) {
    return [];
  }
  if (batchSize < 1) {
    throw new Error("batchSize must be >= 1");
  }
  if (overlap < 0 || overlap >= batchSize) {
    throw new Error("overlap must be in [0, batchSize)");
  }

  const batches: PageBatch[] = [];
  let startIdx = 0;
  let batchIndex = 0;
  const step = batchSize - overlap;

  while (startIdx < pages.length) {
    const endIdx = Math.min(startIdx + batchSize, pages.length) - 1;
    const slice = pages.slice(startIdx, endIdx + 1);
    const first = slice[0]!;
    const last = slice[slice.length - 1]!;
    const pageIndexes = slice.map((p) => p.pageIndex) as readonly number[];

    batches.push({
      batchIndex,
      startPage: first.pageIndex,
      endPage: last.pageIndex,
      pageIndexes,
      pages: slice,
    });

    if (endIdx >= pages.length - 1) {
      break;
    }
    startIdx += step;
    batchIndex += 1;
  }

  return batches;
}
