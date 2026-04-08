import type { OcrBlock, OcrCoordRef, OcrPoint, OcrRegion } from "@/types/ocr";

/** Minimum non-whitespace characters on the page aggregate `text` for a "success" OCR page. */
export const OCR_MIN_TEXT_CHARS = 20;

/** Minimum blocks with non-empty text after validation for "success". */
export const OCR_MIN_VALID_BLOCKS = 1;

const REL_EPS = 1e-4;

function inUnitRange(n: number): boolean {
  return n >= 0 && n <= 1;
}

/**
 * Validates a bbox in normalized [0,1] space (origin top-left of the rasterized page image).
 * Returns null if invalid; otherwise a clamped region with space "relative".
 */
export function validateRelativeBbox(
  x: number,
  y: number,
  width: number,
  height: number,
): OcrRegion | null {
  if (![x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n))) {
    return null;
  }
  if (width <= 0 || height <= 0) {
    return null;
  }
  if (!inUnitRange(x) || !inUnitRange(y)) {
    return null;
  }
  if (x + width > 1 + REL_EPS || y + height > 1 + REL_EPS) {
    return null;
  }
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.min(width, 1 - Math.max(0, x)),
    height: Math.min(height, 1 - Math.max(0, y)),
    space: "relative",
  };
}

/** Validates polygon in normalized [0,1] space; needs ≥3 points, all in range. */
export function validateRelativePolygon(points: OcrPoint[]): OcrPoint[] | null {
  if (!Array.isArray(points) || points.length < 3) {
    return null;
  }
  const out: OcrPoint[] = [];
  for (const p of points) {
    if (
      typeof p !== "object" ||
      p === null ||
      typeof p.x !== "number" ||
      typeof p.y !== "number" ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y)
    ) {
      return null;
    }
    if (!inUnitRange(p.x) || !inUnitRange(p.y)) {
      return null;
    }
    out.push({
      x: Math.max(0, Math.min(1, p.x)),
      y: Math.max(0, Math.min(1, p.y)),
    });
  }
  return out;
}

export const DEFAULT_OCR_COORD_REF: OcrCoordRef = {
  origin: "top-left",
  pageRef: "rasterized_pdf_page_jpeg",
  note:
    "bbox and polygon coordinates are normalized to the width and height of the JPEG sent to the OCR model (same aspect as pdf.js render).",
};

export type ValidatedOcrBlock = {
  block: OcrBlock;
  droppedBbox: boolean;
  droppedPolygon: boolean;
};

/**
 * Strips invalid geometry from a block; increments invalidGeom when bbox/polygon was present but rejected.
 */
export function validateOcrBlock(raw: OcrBlock): ValidatedOcrBlock {
  let droppedBbox = false;
  let droppedPolygon = false;
  const block: OcrBlock = { text: raw.text };

  if (typeof raw.confidence === "number" && Number.isFinite(raw.confidence)) {
    block.confidence = raw.confidence;
  }

  if (raw.bbox) {
    const { x, y, width, height, space } = raw.bbox;
    if (space === "relative") {
      const v = validateRelativeBbox(x, y, width, height);
      if (v) {
        block.bbox = v;
      } else {
        droppedBbox = true;
      }
    } else if (space === "pixel") {
      if ([x, y, width, height].every((n) => Number.isFinite(n)) && width > 0 && height > 0) {
        block.bbox = { x, y, width, height, space: "pixel" };
      } else {
        droppedBbox = true;
      }
    } else {
      droppedBbox = true;
    }
  }

  if (raw.polygon && raw.polygon.length > 0) {
    const poly = validateRelativePolygon(raw.polygon);
    if (poly) {
      block.polygon = poly;
    } else {
      droppedPolygon = true;
    }
  }

  return { block, droppedBbox, droppedPolygon };
}

export type OcrPageQuality = {
  status: "success" | "partial" | "failed";
  warnings: string[];
  invalidBlockCount: number;
};

export function assessOcrPageQuality(
  text: string,
  blocks: OcrBlock[],
  invalidBlockCount: number,
  apiError?: string,
): OcrPageQuality {
  const warnings: string[] = [];
  if (apiError) {
    return {
      status: "failed",
      warnings: [apiError],
      invalidBlockCount,
    };
  }

  const trimmed = text.trim();
  if (trimmed.length < OCR_MIN_TEXT_CHARS) {
    warnings.push(
      `Short OCR text (${trimmed.length} chars; minimum recommended ${OCR_MIN_TEXT_CHARS}).`,
    );
  }
  if (blocks.length < OCR_MIN_VALID_BLOCKS) {
    warnings.push(
      `Few valid blocks (${blocks.length}; minimum recommended ${OCR_MIN_VALID_BLOCKS}).`,
    );
  }
  if (invalidBlockCount > 0) {
    warnings.push(`${invalidBlockCount} block(s) had invalid geometry and were stripped.`);
  }

  const badText = trimmed.length < OCR_MIN_TEXT_CHARS;
  const badBlocks = blocks.length < OCR_MIN_VALID_BLOCKS;

  if (badText && badBlocks) {
    return { status: "failed", warnings, invalidBlockCount };
  }
  if (badText || badBlocks || invalidBlockCount > 0) {
    return { status: "partial", warnings, invalidBlockCount };
  }
  return { status: "success", warnings: [], invalidBlockCount };
}
