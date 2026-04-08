export type OcrProvider = "openai" | "custom";

export type OcrCoordSpace = "relative" | "pixel";

/**
 * Explicit coordinate system metadata for OCR geometry.
 * - `origin: "top-left"`: x grows right, y grows down.
 * - `units: "relative_0_1"`: normalized coordinates in [0..1].
 * - `units: "pixel"`: raster pixel coordinates.
 */
export type OcrCoordSystem = {
  origin: "top-left";
  units: "relative_0_1" | "pixel";
};

/**
 * Coordinate contract for bbox / polygon:
 * - `origin: "top-left"`: x grows right, y grows down (browser / canvas convention).
 * - `pageRef: "rasterized_pdf_page_jpeg"`: numbers refer to the same pixel grid as the
 *   JPEG built by `renderPdfPagesToImages` (or single-page render for inspection).
 * - `space: "relative"`: x, y, width, height (bbox) or polygon vertices are in 0..1
 *   normalized to that raster width/height.
 * - `space: "pixel"`: bbox x,y,width,height are in pixels of that raster (rare; model-dependent).
 */
export type OcrCoordRef = {
  origin: "top-left";
  pageRef: "rasterized_pdf_page_jpeg";
  note?: string;
};

export type OcrPoint = {
  x: number;
  y: number;
};

export type OcrRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  space: OcrCoordSpace;
};

export type OcrBlock = {
  text: string;
  bbox?: OcrRegion;
  polygon?: OcrPoint[];
  confidence?: number;
};

export type OcrPageStatus = "success" | "partial" | "failed";

/** Per-block verdict for future rectangle crop (not cropping yet). */
export type OcrBlockRegionVerdict = {
  blockIndex: number;
  hasRelativeBbox: boolean;
  hasPolygon: boolean;
  /** Relative bbox is present and passes size/shape heuristics for a future crop. */
  cropReady: boolean;
  issues: string[];
};

/** Page-level geometry audit persisted with OCR for inspector + question mapping. */
export type OcrPageRegionVerification = {
  pageIndex: number;
  /** True when at least one block is `cropReady` and page OCR did not hard-fail. */
  pageUsableForCrop: boolean;
  relativeBboxBlockCount: number;
  cropReadyBlockCount: number;
  blocks: OcrBlockRegionVerdict[];
  pageIssues: string[];
};

export type OcrPageResult = {
  pageIndex: number;
  text: string;
  blocks: OcrBlock[];
  /** Per-page OCR outcome after validation and quality gates. */
  status?: OcrPageStatus;
  warnings?: string[];
  /** Bbox/polygon pairs rejected or stripped as invalid. */
  invalidBlockCount?: number;
  coordRef?: OcrCoordRef;
  coordSystem?: OcrCoordSystem;
  providerMeta?: Record<string, unknown>;
  /** Filled when OCR run completes; used for crop-prep and `verifiedRegionAvailable` on questions. */
  regionVerification?: OcrPageRegionVerification;
};

export type OcrRunStats = {
  totalPages: number;
  successPages: number;
  partialPages: number;
  failedPages: number;
  totalBlocks: number;
  invalidBlocks: number;
};

export type OcrRunResult = {
  /** v2 adds per-page status, stats, and explicit coordRef. v1 rows may omit new fields. */
  version: 1 | 2;
  provider: OcrProvider;
  savedAt: string;
  pages: OcrPageResult[];
  /** Run-level OCR quality summary. */
  stats?: OcrRunStats;
};

/** One spatial reading-order slice of OCR blocks on a page (layout-aware chunk parse). */
export type LayoutChunk = {
  id: string;
  pageIndex: number;
  text: string;
  blockIndices: number[];
};

export const LS_OCR_PROVIDER = "doc2quiz:ocr:provider";
export const LS_OCR_KEY = "doc2quiz:ocr:key";
export const LS_OCR_URL = "doc2quiz:ocr:url";
export const LS_OCR_MODEL = "doc2quiz:ocr:model";

/*
 * Crop phase (not implemented): see `applyQuestionPageMapping` in `mapQuestionsToPages.ts` and
 * `verifyOcrPageRegions` in `ocrRegionVerify.ts`. Insert rectangle crop of page JPEG using blocks
 * where `cropReady`; then `putMediaBlob` + set `questionImageId` (question-level attach).
 */
