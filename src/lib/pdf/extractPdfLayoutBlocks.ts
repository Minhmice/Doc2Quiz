"use client";

import {
  fileSummary,
  isPipelineVerbose,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { getPdfjs } from "@/lib/pdf/getPdfjs";
import {
  type BuildLayoutBlocksOptions,
  type PdfLayoutBlock,
  layoutBlocksFromTextLayer,
  pdfjsTextContentItemsToPdfTextItems,
} from "@/lib/pdf/layoutBlocksFromTextLayer";

export type ExtractPdfLayoutBlocksPage = {
  pageIndex1: number;
  blocks: PdfLayoutBlock[];
  truncated: boolean;
  itemCount: number;
};

export type ExtractPdfLayoutBlocksResult = {
  pageCount: number;
  pages: ExtractPdfLayoutBlocksPage[];
};

export type ExtractPdfLayoutBlocksOptions = {
  signal?: AbortSignal;
  build?: Partial<BuildLayoutBlocksOptions>;
};

/**
 * Extract layout blocks from the pdf.js text layer for a subset of 1-based page indices.
 * Never throws; returns `{ pageCount: 0, pages: [] }` on failure or abort.
 */
export async function extractPdfLayoutBlocksForPageIndices(
  file: File,
  pageIndices: number[],
  options?: ExtractPdfLayoutBlocksOptions,
): Promise<ExtractPdfLayoutBlocksResult> {
  const meta = fileSummary(file);
  const signal = options?.signal;

  try {
    const pdfjsLib = await getPdfjs();
    if (signal?.aborted) {
      pipelineLog("PDF", "extract-layout", "warn", "aborted before start", meta);
      return { pageCount: 0, pages: [] };
    }

    const uniqueSorted = Array.from(new Set(pageIndices))
      .map((n) => Math.trunc(n))
      .filter((n) => Number.isFinite(n) && n >= 1)
      .sort((a, b) => a - b);

    if (uniqueSorted.length === 0) {
      return { pageCount: 0, pages: [] };
    }

    const data = await file.arrayBuffer();
    if (signal?.aborted) {
      return { pageCount: 0, pages: [] };
    }

    if (isPipelineVerbose()) {
      pipelineLog("PDF", "extract-layout", "info", "opening PDF for layout blocks", {
        ...meta,
        requestedPages: uniqueSorted.length,
      });
    }

    const pdf = await pdfjsLib.getDocument({ data }).promise;
    try {
      const pageCount = pdf.numPages;
      const pages: ExtractPdfLayoutBlocksPage[] = [];

      for (const pageIndex1Raw of uniqueSorted) {
        if (signal?.aborted) {
          pipelineLog("PDF", "extract-layout", "warn", "aborted mid extract", {
            ...meta,
            stoppedAtPage: pageIndex1Raw,
          });
          return { pageCount, pages: [] };
        }

        const pageIndex1 = Math.min(pageIndex1Raw, pageCount);
        if (pageIndex1 < 1 || pageIndex1 > pageCount) {
          continue;
        }

        if (isPipelineVerbose()) {
          pipelineLog("PDF", "extract-layout", "info", "getPage + getTextContent", {
            ...meta,
            pageIndex: pageIndex1,
            pageCount,
          });
        }

        const page = await pdf.getPage(pageIndex1);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();

        const { items, truncated, itemCount } = pdfjsTextContentItemsToPdfTextItems({
          pageIndex: pageIndex1 - 1,
          items: textContent.items,
          viewportTransform: viewport.transform,
          maxItems: options?.build?.maxItemsPerPage,
        });

        const built = layoutBlocksFromTextLayer(items, options?.build);
        pages.push({
          pageIndex1,
          blocks: built.blocks,
          truncated: truncated || built.truncated,
          itemCount,
        });
      }

      return { pageCount, pages };
    } finally {
      await pdf.destroy();
    }
  } catch (raw) {
    const norm = normalizeUnknownError(raw);
    pipelineLog("PDF", "extract-layout", "error", "layout block extraction failed (returning empty)", {
      ...meta,
      ...norm,
      raw,
    });
    return { pageCount: 0, pages: [] };
  }
}

