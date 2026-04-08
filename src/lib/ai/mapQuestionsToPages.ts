import { verifyOcrPageRegions } from "@/lib/ai/ocrRegionVerify";
import type { OcrPageResult, OcrRunResult } from "@/types/ocr";
import type { Question } from "@/types/question";

export type VisionParseMode = "attach_single" | "single" | "pair";

/** Minimum normalized overlap score to trust OCR-based page choice. */
const OCR_OVERLAP_MIN_SCORE = 0.18;

/** Best page must lead runner-up by at least this margin. */
const OCR_OVERLAP_MIN_MARGIN = 0.05;

function tokenize(text: string): Set<string> {
  const raw = text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  return new Set(raw);
}

function overlapScore(q: Question, pageText: string): number {
  const qTokens = tokenize([q.question, ...q.options].join(" "));
  if (qTokens.size === 0) {
    return 0;
  }
  const pTokens = tokenize(pageText);
  let hit = 0;
  for (const t of qTokens) {
    if (pTokens.has(t)) {
      hit += 1;
    }
  }
  return hit / qTokens.size;
}

function pageVerification(
  pageByIndex: Map<number, OcrPageResult>,
  pageIndex: number,
): ReturnType<typeof verifyOcrPageRegions> | undefined {
  const p = pageByIndex.get(pageIndex);
  if (!p) {
    return undefined;
  }
  return p.regionVerification ?? verifyOcrPageRegions(p);
}

function setProvenanceMapping(
  q: Question,
  pageByIndex: Map<number, OcrPageResult>,
  ctx: { parseMode: VisionParseMode },
): void {
  const idx = q.sourcePageIndex;
  if (idx === undefined || idx < 1) {
    return;
  }
  q.imagePageIndex = idx;
  q.ocrPageIndex = idx;
  const ver = pageVerification(pageByIndex, idx);
  q.verifiedRegionAvailable = Boolean(
    ver && ver.pageUsableForCrop && ver.cropReadyBlockCount > 0,
  );

  if (ctx.parseMode === "attach_single") {
    q.mappingMethod = "vision_provenance";
    q.mappingConfidence = 0.92;
    q.mappingReason =
      "Page-scoped vision parse with attach: question inherits that page index.";
    return;
  }
  if (ctx.parseMode === "single") {
    q.mappingMethod = "vision_single_page";
    q.mappingConfidence = 0.9;
    q.mappingReason = "Single full-document vision pass: questions mapped to page 1.";
    return;
  }
  q.mappingMethod = "vision_provenance";
  q.mappingConfidence = 0.88;
  q.mappingReason =
    "Source page index was present on the question after vision (non-attach or mixed pipeline).";
}

function tryOcrOverlapMapping(
  q: Question,
  ocr: OcrRunResult,
  pageByIndex: Map<number, OcrPageResult>,
): void {
  const ranked = ocr.pages
    .map((p) => ({
      pageIndex: p.pageIndex,
      score: overlapScore(q, p.text),
      failed: (p.status ?? "success") === "failed" && !p.text.trim(),
    }))
    .filter((x) => !x.failed || x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    q.mappingMethod = "unresolved";
    q.mappingConfidence = 0;
    q.mappingReason = "No OCR pages available for overlap ranking.";
    q.verifiedRegionAvailable = false;
    return;
  }

  const best = ranked[0]!;
  const second = ranked[1]?.score ?? 0;
  const margin = best.score - second;

  if (
    best.score >= OCR_OVERLAP_MIN_SCORE &&
    margin >= OCR_OVERLAP_MIN_MARGIN
  ) {
    q.sourcePageIndex = best.pageIndex;
    q.imagePageIndex = best.pageIndex;
    q.ocrPageIndex = best.pageIndex;
    q.mappingMethod = "ocr_text_overlap";
    q.mappingConfidence = Math.min(0.82, best.score);
    q.mappingReason = `OCR token overlap: page ${best.pageIndex} wins (score ${best.score.toFixed(2)}, margin ${margin.toFixed(2)} over next).`;
    const ver = pageVerification(pageByIndex, best.pageIndex);
    q.verifiedRegionAvailable = Boolean(
      ver && ver.pageUsableForCrop && ver.cropReadyBlockCount > 0,
    );
    return;
  }

  q.mappingMethod = "unresolved";
  q.mappingConfidence = best.score;
  q.mappingReason = `OCR overlap inconclusive (best ${best.score.toFixed(2)}, margin ${margin.toFixed(2)}; thresholds ${OCR_OVERLAP_MIN_SCORE} / ${OCR_OVERLAP_MIN_MARGIN}). Left source page unset; page-image attach unchanged.`;
  q.verifiedRegionAvailable = false;
}

/**
 * Adds traceable page mapping metadata on each question after vision + OCR persist.
 * Mutates `questions` in place. Does not change `questionImageId` or crop images.
 */
export function applyQuestionPageMapping(
  questions: Question[],
  ocr: OcrRunResult | null | undefined,
  ctx: { parseMode: VisionParseMode },
): void {
  const pageByIndex = new Map<number, OcrPageResult>();
  if (ocr?.pages) {
    for (const p of ocr.pages) {
      pageByIndex.set(p.pageIndex, p);
    }
  }

  for (const q of questions) {
    if (q.sourcePageIndex !== undefined && q.sourcePageIndex >= 1) {
      setProvenanceMapping(q, pageByIndex, ctx);
      continue;
    }

    if (!ocr?.pages.length) {
      q.mappingMethod = "unresolved";
      q.mappingConfidence = 0;
      q.mappingReason =
        "No vision source page and no OCR run — cannot map to a PDF page.";
      q.verifiedRegionAvailable = false;
      continue;
    }

    tryOcrOverlapMapping(q, ocr, pageByIndex);
  }
}
