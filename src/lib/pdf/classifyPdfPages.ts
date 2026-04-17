"use client";

import {
  fileSummary,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import {
  MIN_CHARS_PER_PAGE_FOR_TEXT_SIGNAL,
} from "@/lib/ai/parseRoutePolicy";
import { getPdfjs } from "@/lib/pdf/getPdfjs";
import { VISION_MAX_PAGES_DEFAULT } from "@/lib/pdf/renderPagesToImages";
import {
  PAGE_DROPPED_VISION_CAP,
  PAGE_SIGNAL_SAMPLED_TEXT_LAYER,
  PAGE_SIGNAL_UNKNOWN_DEFAULT_BITMAP,
  PAGE_TEXT_STRONG,
  PAGE_TEXT_WEAK,
  type PageRoutePlan,
  type PageRoutePlanPage,
  type PageTextLayerSignal,
} from "@/lib/pdf/pageRoutePlan";

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function countTextChars(textContent: { items: readonly unknown[] }): number {
  let chars = 0;
  for (const raw of textContent.items) {
    if (
      raw &&
      typeof raw === "object" &&
      "str" in raw &&
      typeof (raw as { str: unknown }).str === "string"
    ) {
      chars += (raw as { str: string }).str.length;
    }
  }
  return chars;
}

function buildConservativeAllBitmapPlan(
  pageCount: number,
  limitsApplied: PageRoutePlan["limitsApplied"],
  reasonCode = PAGE_SIGNAL_UNKNOWN_DEFAULT_BITMAP,
): PageRoutePlan {
  const pages: PageRoutePlanPage[] = [];
  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
    pages.push({
      pageIndex,
      kind: "bitmap",
      reasonCodes: [reasonCode],
    });
  }
  const bitmapPageIndicesAll = pages.map((p) => p.pageIndex);
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
      if (dropped.has(p.pageIndex)) {
        p.reasonCodes.push(PAGE_DROPPED_VISION_CAP);
      }
    }
  }
  return {
    pageCount,
    pages,
    textPageIndices: [],
    bitmapPageIndicesAll,
    bitmapPageIndicesForVision,
    droppedBitmapPageIndices,
    droppedBitmapPagesCount: droppedBitmapPageIndices.length,
    limitsApplied,
  };
}

export type ClassifyPdfPagesOptions = {
  signal?: AbortSignal;
  /** Caller-provided budget; clamped to 3–5 when pageCount >= 3. */
  previewFirstPageBudget: number;
  /** Cap for bitmap pages eligible for vision. */
  visionMaxPages?: number;
};

/**
 * Deterministic per-page routing plan derived from pdf.js text-layer evidence.
 *
 * Notes:
 * - Numeric-only outputs (page indices + char counts); never returns extracted strings.
 * - Never throws; returns a conservative "all bitmap" plan on failure/abort.
 * - Work is bounded: only the first `max(previewFirstPageBudget, visionMaxPages)` pages are sampled.
 */
export async function classifyPdfPages(
  file: File,
  options: ClassifyPdfPagesOptions,
): Promise<PageRoutePlan> {
  const meta = fileSummary(file);
  const signal = options.signal;
  const visionMaxPages =
    options.visionMaxPages ?? VISION_MAX_PAGES_DEFAULT;

  const limitsApplied = {
    previewFirstPageBudget: options.previewFirstPageBudget,
    visionMaxPages,
  };

  try {
    const pdfjsLib = await getPdfjs();
    if (signal?.aborted) {
      pipelineLog("PDF", "page-classify", "warn", "aborted before start", meta);
      return buildConservativeAllBitmapPlan(0, limitsApplied);
    }

    const data = await file.arrayBuffer();
    if (signal?.aborted) {
      pipelineLog("PDF", "page-classify", "warn", "aborted after arrayBuffer()", meta);
      return buildConservativeAllBitmapPlan(0, limitsApplied);
    }

    pipelineLog("PDF", "open", "info", "getDocument() starting (page classify)", meta);
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    try {
      const pageCount = pdf.numPages;
      const requestedPreview = options.previewFirstPageBudget;
      const previewBudget =
        pageCount < 3 ? pageCount : clampInt(requestedPreview, 3, 5);

      const scanBudget = Math.min(
        pageCount,
        Math.max(previewBudget, visionMaxPages),
      );

      const sampledSignalsByPage = new Map<number, PageTextLayerSignal>();

      for (let pageIndex = 1; pageIndex <= scanBudget; pageIndex++) {
        if (signal?.aborted) {
          pipelineLog("PDF", "page-classify", "warn", "aborted mid scan", {
            ...meta,
            stoppedAtPage: pageIndex,
            scanBudget,
            pageCount,
          });
          return buildConservativeAllBitmapPlan(pageCount, limitsApplied);
        }

        const page = await pdf.getPage(pageIndex);
        const textContent = await page.getTextContent();
        const charCount = countTextChars(textContent);
        const hasAnyText = charCount > 0;
        sampledSignalsByPage.set(pageIndex, {
          pageIndex,
          charCount,
          hasAnyText,
        });
      }

      const pages: PageRoutePlanPage[] = [];
      const textPageIndices: number[] = [];
      const bitmapPageIndicesAll: number[] = [];

      for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
        const sig = sampledSignalsByPage.get(pageIndex);
        if (!sig) {
          pages.push({
            pageIndex,
            kind: "bitmap",
            reasonCodes: [PAGE_SIGNAL_UNKNOWN_DEFAULT_BITMAP],
          });
          bitmapPageIndicesAll.push(pageIndex);
          continue;
        }

        const isText =
          sig.hasAnyText &&
          sig.charCount >= MIN_CHARS_PER_PAGE_FOR_TEXT_SIGNAL;

        if (isText) {
          pages.push({
            pageIndex,
            kind: "text",
            reasonCodes: [PAGE_SIGNAL_SAMPLED_TEXT_LAYER, PAGE_TEXT_STRONG],
          });
          textPageIndices.push(pageIndex);
        } else {
          pages.push({
            pageIndex,
            kind: "bitmap",
            reasonCodes: [PAGE_SIGNAL_SAMPLED_TEXT_LAYER, PAGE_TEXT_WEAK],
          });
          bitmapPageIndicesAll.push(pageIndex);
        }
      }

      const bitmapPageIndicesForVision = bitmapPageIndicesAll.slice(
        0,
        visionMaxPages,
      );
      const droppedBitmapPageIndices = bitmapPageIndicesAll.slice(visionMaxPages);

      if (droppedBitmapPageIndices.length > 0) {
        const dropped = new Set(droppedBitmapPageIndices);
        for (const p of pages) {
          if (p.kind === "bitmap" && dropped.has(p.pageIndex)) {
            p.reasonCodes.push(PAGE_DROPPED_VISION_CAP);
          }
        }
      }

      pipelineLog("PDF", "page-classify", "info", "page route plan computed", {
        ...meta,
        pageCount,
        previewBudget,
        scanBudget,
        textPages: textPageIndices.length,
        bitmapPages: bitmapPageIndicesAll.length,
        bitmapForVision: bitmapPageIndicesForVision.length,
        droppedBitmapPages: droppedBitmapPageIndices.length,
      });

      return {
        pageCount,
        pages,
        textPageIndices,
        bitmapPageIndicesAll,
        bitmapPageIndicesForVision,
        droppedBitmapPageIndices,
        droppedBitmapPagesCount: droppedBitmapPageIndices.length,
        limitsApplied: {
          previewFirstPageBudget: previewBudget,
          visionMaxPages,
        },
      };
    } finally {
      await pdf.destroy();
    }
  } catch (raw) {
    const norm = normalizeUnknownError(raw);
    pipelineLog("PDF", "page-classify", "error", "page classification failed (conservative all-bitmap)", {
      ...meta,
      ...norm,
      hint:
        norm.pdfJsName === "PasswordException"
          ? "Encrypted PDF — classification unavailable without password"
          : undefined,
    });
    return buildConservativeAllBitmapPlan(0, limitsApplied);
  }
}

