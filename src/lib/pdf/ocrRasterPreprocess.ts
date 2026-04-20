/**
 * Phase 35 — OCR / vision raster preprocessing: DPI/megapixel limits and optional
 * bitmap thresholding before JPEG encode. Pure helpers + one mutating transform.
 *
 * pdf.js viewports use CSS pixels where 1 unit ≈ 1/72 inch (points); effective
 * DPI ≈ `scale * 72` for `page.getViewport({ scale })`.
 */

/** Target upper bound on effective raster DPI (downscale only when scale would exceed). */
export const OCR_RASTER_TARGET_DPI = 300;

/** Max width × height in pixels before JPEG encode (memory + API payload bound). */
export const OCR_RASTER_MAX_MEGAPIXELS = 4;

const PDF_POINTS_PER_INCH = 72;

export type OcrPageRasterKind = "text" | "bitmap" | "unknown";

export function effectiveDpiFromViewportScale(scale: number): number {
  return scale * PDF_POINTS_PER_INCH;
}

/**
 * Clamp scale so effective DPI does not exceed `maxEffectiveDpi` (typically 300).
 * When `scale <= 1` (usual downscale-from-native case), this is a no-op.
 */
export function capScaleForMaxEffectiveDpi(
  scale: number,
  maxEffectiveDpi: number = OCR_RASTER_TARGET_DPI,
): number {
  const maxScale = maxEffectiveDpi / PDF_POINTS_PER_INCH;
  return Math.min(scale, maxScale);
}

/**
 * Returns a multiplier in (0, 1] to shrink dimensions so width×height ≤ max megapixels.
 */
export function megapixelScaleDownFactor(
  widthPx: number,
  heightPx: number,
  maxMegapixels: number = OCR_RASTER_MAX_MEGAPIXELS,
): number {
  const pixels = widthPx * heightPx;
  const maxPx = maxMegapixels * 1_000_000;
  if (pixels <= maxPx || pixels <= 0) {
    return 1;
  }
  return Math.sqrt(maxPx / pixels);
}

/**
 * Combine DPI cap + megapixel cap into one scale factor applied to the pdf.js viewport scale.
 */
export function combineRasterScaleLimits(
  baseViewportWidth: number,
  baseViewportHeight: number,
  scale: number,
): number {
  const s0 = capScaleForMaxEffectiveDpi(scale);
  const w = baseViewportWidth * s0;
  const h = baseViewportHeight * s0;
  const f = megapixelScaleDownFactor(w, h);
  return s0 * f;
}

/**
 * Grayscale + global threshold (bitmap / scanned heuristic). Mutates `ImageData` in place.
 */
export function applyGrayscaleGlobalThreshold(
  imageData: ImageData,
  threshold = 128,
): void {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
    const v = g >= threshold ? 255 : 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
}

export function shouldApplyBitmapThreshold(kind: OcrPageRasterKind): boolean {
  return kind === "bitmap";
}

export type OcrRasterBatchStats = {
  pagesRendered: number;
  megapixelLimitedCount: number;
  thresholdAppliedCount: number;
};
