import type {
  OcrBlock,
  OcrBlockRegionVerdict,
  OcrPageRegionVerification,
  OcrPageResult,
} from "@/types/ocr";

/** Minimum relative area (width×height) so a bbox is not noise-level. */
export const OCR_CROP_MIN_REL_AREA = 0.00035;

/** Bbox covering nearly the full page is not a useful question-level region. */
export const OCR_CROP_MAX_REL_AREA = 0.92;

const MAX_ASPECT = 24;

function verifyOneBlock(block: OcrBlock, blockIndex: number): OcrBlockRegionVerdict {
  const issues: string[] = [];
  const bbox = block.bbox;
  const hasRelativeBbox = bbox?.space === "relative";
  const hasPolygon = (block.polygon?.length ?? 0) >= 3;

  if (!hasRelativeBbox && !hasPolygon) {
    return {
      blockIndex,
      hasRelativeBbox: false,
      hasPolygon: false,
      cropReady: false,
      issues: ["no bbox or polygon"],
    };
  }

  if (hasPolygon && !hasRelativeBbox) {
    issues.push("polygon only — no axis-aligned bbox for rectangle crop");
  }

  if (!hasRelativeBbox || !bbox || bbox.space !== "relative") {
    return {
      blockIndex,
      hasRelativeBbox: false,
      hasPolygon,
      cropReady: false,
      issues,
    };
  }

  const area = bbox.width * bbox.height;
  if (!Number.isFinite(area) || area <= 0) {
    issues.push("non-finite or zero bbox area");
    return {
      blockIndex,
      hasRelativeBbox: true,
      hasPolygon,
      cropReady: false,
      issues,
    };
  }

  if (area < OCR_CROP_MIN_REL_AREA) {
    issues.push(`bbox area ${area.toFixed(5)} below crop minimum`);
  }
  if (area > OCR_CROP_MAX_REL_AREA) {
    issues.push("bbox covers most of page — not a tight region");
  }

  const ar =
    bbox.height > 0 ? bbox.width / bbox.height : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(ar) || ar > MAX_ASPECT || ar < 1 / MAX_ASPECT) {
    issues.push("extreme width/height ratio");
  }

  const cropReady = issues.length === 0;

  return {
    blockIndex,
    hasRelativeBbox: true,
    hasPolygon,
    cropReady,
    issues,
  };
}

/**
 * Inspects OCR geometry for a single page for future crop — does not mutate `page`.
 * Inferred from existing `OcrBlock` shapes produced by `ocrAdapter` + `ocrValidate`.
 */
export function verifyOcrPageRegions(page: OcrPageResult): OcrPageRegionVerification {
  const pageIssues: string[] = [];
  const st = page.status ?? "success";
  if (st === "failed" && !page.text.trim() && page.blocks.length === 0) {
    pageIssues.push("OCR page failed or empty");
  }

  const blocks: OcrBlockRegionVerdict[] = page.blocks.map((b, i) =>
    verifyOneBlock(b, i),
  );

  let relativeBboxBlockCount = 0;
  let cropReadyBlockCount = 0;
  for (const v of blocks) {
    if (v.hasRelativeBbox) {
      relativeBboxBlockCount += 1;
    }
    if (v.cropReady) {
      cropReadyBlockCount += 1;
    }
  }

  const pageUsableForCrop =
    pageIssues.length === 0 &&
    cropReadyBlockCount > 0 &&
    st !== "failed";

  return {
    pageIndex: page.pageIndex,
    pageUsableForCrop,
    relativeBboxBlockCount,
    cropReadyBlockCount,
    blocks,
    pageIssues,
  };
}
