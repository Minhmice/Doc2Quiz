"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  fileSummary,
  isPipelineVerbose,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { getPdfjs } from "@/lib/pdf/getPdfjs";
import {
  canUseImagePreprocessWorker,
  encodeJpegDataUrlInWorker,
} from "@/lib/pdf/imagePreprocess/encodeJpegInWorker";
import {
  applyGrayscaleGlobalThreshold,
  combineRasterScaleLimits,
  shouldApplyBitmapThreshold,
  type OcrPageRasterKind,
  type OcrRasterBatchStats,
} from "@/lib/pdf/ocrRasterPreprocess";

export const VISION_MAX_PAGES_DEFAULT = 20;
/** Max raster width (CSS px) before JPEG encode — keeps payloads bounded for vision APIs. */
export const VISION_MAX_WIDTH_DEFAULT = 832;
/**
 * Max raster height (CSS px). Pages are only width-capped today; very tall scans
 * can still produce huge canvases and multimodal timeouts (edge 524 ~125s).
 */
export const VISION_MAX_HEIGHT_DEFAULT = 1024;
/** JPEG quality for vision rasterization — lower = smaller uploads / faster vision steps. */
export const VISION_JPEG_QUALITY = 0.68;

export type PageImageResult = {
  pageIndex: number;
  dataUrl: string;
};

export type { OcrPageRasterKind };

function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException) return err.name === "AbortError";
  if (err instanceof Error) return err.name === "AbortError";
  return false;
}

/**
 * Renders PDF pages to JPEG data URLs for multimodal chat (OpenAI-style image_url).
 */
export async function renderPdfPagesToImages(
  file: File,
  options: {
    signal: AbortSignal;
    maxPages?: number;
    /** Optional 1-based page indices to rasterize (sorted asc after sanitization). */
    pageIndices?: number[];
    maxWidth?: number;
    maxHeight?: number;
    jpegQuality?: number;
    /** Fires after each page is rasterized (for progress UI / thumbnails). */
    onPageRendered?: (
      page: PageImageResult,
      meta: { totalPages: number },
    ) => void;
    /**
     * After the first min(budget, pagesToRender) pages rasterize, invoke once so
     * vision parse can start while the rest of the pages render.
     */
    previewPageBudget?: number;
    onPreviewPagesAvailable?: (pages: PageImageResult[]) => void;
    /**
     * Phase 35 — optional per-page kind for bitmap-only thresholding (Phase 29 routing).
     */
    pageRasterKind?: (pageIndex: number) => OcrPageRasterKind | undefined;
  },
): Promise<PageImageResult[]> {
  const meta = fileSummary(file);
  const pdfjsLib = await getPdfjs();
  const {
    signal,
    maxPages = VISION_MAX_PAGES_DEFAULT,
    pageIndices,
    maxWidth = VISION_MAX_WIDTH_DEFAULT,
    maxHeight = VISION_MAX_HEIGHT_DEFAULT,
    jpegQuality = VISION_JPEG_QUALITY,
    onPageRendered,
    previewPageBudget,
    onPreviewPagesAvailable,
    pageRasterKind,
  } = options;

  if (isPipelineVerbose()) {
    pipelineLog("PDF", "render-batch", "info", "renderPdfPagesToImages: reading arrayBuffer", {
      ...meta,
      maxPages,
      maxWidth,
      maxHeight,
      jpegQuality,
    });
  }
  const data = await file.arrayBuffer();
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  if (isPipelineVerbose()) {
    pipelineLog("PDF", "array-buffer", "info", "arrayBuffer ready (vision render)", {
      ...meta,
      byteLength: data.byteLength,
    });
  }

  let pdf: PDFDocumentProxy;
  try {
    pipelineLog("PDF", "open", "info", "getDocument() starting (vision render batch)", meta);
    pdf = await pdfjsLib.getDocument({ data }).promise;
  } catch (raw) {
    const norm = normalizeUnknownError(raw);
    pipelineLog("PDF", "open", "error", "getDocument() failed (vision render)", {
      ...meta,
      ...norm,
      raw,
    });
    throw raw;
  }

  try {
    const pageCount = pdf.numPages;
    const indices =
      Array.isArray(pageIndices) && pageIndices.length > 0
        ? [...pageIndices]
            .map((n) => Math.floor(n))
            .filter((n) => n >= 1 && n <= pageCount)
            .sort((a, b) => a - b)
        : null;
    const selectedIndices =
      indices && indices.length > 0 ? indices.slice(0, maxPages) : null;
    const limit = selectedIndices
      ? selectedIndices.length
      : Math.min(pageCount, maxPages);
    pipelineLog("PDF", "render-batch", "info", "PDF opened for rasterization", {
      ...meta,
      numPages: pageCount,
      pagesToRender: limit,
      selectedPageIndices:
        selectedIndices && selectedIndices.length > 0
          ? selectedIndices
          : undefined,
    });
    const out: PageImageResult[] = [];
    const previewFireAt =
      typeof previewPageBudget === "number" && previewPageBudget > 0
        ? Math.min(previewPageBudget, limit)
        : 0;
    let previewFired = false;
    let workerOk = canUseImagePreprocessWorker();
    const ocrRasterStats: OcrRasterBatchStats = {
      pagesRendered: 0,
      megapixelLimitedCount: 0,
      thresholdAppliedCount: 0,
    };

    for (let rendered = 0; rendered < limit; rendered++) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const pageIndex = selectedIndices ? selectedIndices[rendered] : rendered + 1;
      try {
        if (isPipelineVerbose()) {
          pipelineLog("PDF", "render-page", "info", "render page start", {
            ...meta,
            pageIndex,
            limit,
          });
        }
        const page = await pdf.getPage(pageIndex);
        const baseViewport = page.getViewport({ scale: 1 });
        const initialScale = Math.min(
          1,
          maxWidth / baseViewport.width,
          maxHeight / baseViewport.height,
        );
        const scale = combineRasterScaleLimits(
          baseViewport.width,
          baseViewport.height,
          initialScale,
        );
        if (scale < initialScale - 1e-9) {
          ocrRasterStats.megapixelLimitedCount += 1;
        }
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) {
          throw new Error("Canvas 2D context not available");
        }

        await page.render({ canvasContext, viewport }).promise;
        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const rasterKind = pageRasterKind?.(pageIndex);
        if (
          rasterKind &&
          shouldApplyBitmapThreshold(rasterKind) &&
          canvas.width > 0 &&
          canvas.height > 0
        ) {
          const imageData = canvasContext.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          );
          applyGrayscaleGlobalThreshold(imageData);
          canvasContext.putImageData(imageData, 0, 0);
          ocrRasterStats.thresholdAppliedCount += 1;
        }

        let dataUrl: string;
        if (workerOk) {
          try {
            dataUrl = await encodeJpegDataUrlInWorker({
              canvas,
              maxWidth,
              maxHeight,
              jpegQuality,
              signal,
            });
          } catch (err) {
            if (isAbortError(err)) {
              throw err;
            }
            workerOk = false;
            if (isPipelineVerbose()) {
              pipelineLog(
                "PDF",
                "render-page",
                "warn",
                "worker JPEG encode failed; falling back to canvas.toDataURL for remaining pages",
                { ...meta, pageIndex },
              );
            }
            dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
          }
        } else {
          dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
        }
        // Reduce peak memory pressure from large canvas backing stores.
        canvas.width = 0;
        canvas.height = 0;
        const pageResult = { pageIndex, dataUrl };
        out.push(pageResult);
        ocrRasterStats.pagesRendered += 1;
        onPageRendered?.(pageResult, { totalPages: limit });
        if (
          previewFireAt > 0 &&
          !previewFired &&
          rendered + 1 === previewFireAt &&
          onPreviewPagesAvailable
        ) {
          previewFired = true;
          onPreviewPagesAvailable(out.slice());
        }
        if (isPipelineVerbose()) {
          pipelineLog("PDF", "render-page", "info", "render page success", {
            ...meta,
            pageIndex,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
          });
        }
      } catch (raw) {
        const norm = normalizeUnknownError(raw);
        pipelineLog("PDF", "render-page", "error", "render page failed", {
          ...meta,
          pageIndex,
          ...norm,
          raw,
        });
        throw raw;
      }
    }

    pipelineLog("PDF", "render-batch", "info", "renderPdfPagesToImages complete", {
      ...meta,
      renderedCount: out.length,
      ocrRaster: {
        pagesRendered: ocrRasterStats.pagesRendered,
        megapixelLimitedCount: ocrRasterStats.megapixelLimitedCount,
        thresholdAppliedCount: ocrRasterStats.thresholdAppliedCount,
      },
    });
    return out;
  } finally {
    await pdf.destroy();
  }
}

/**
 * Renders one PDF page to a JPEG data URL using the same defaults as batch vision rasterization.
 */
export async function renderSinglePdfPageToDataUrl(
  file: File,
  pageIndex: number,
  options?: {
    signal?: AbortSignal;
    maxWidth?: number;
    maxHeight?: number;
    jpegQuality?: number;
  },
): Promise<string | null> {
  const meta = fileSummary(file);
  const pdfjsLib = await getPdfjs();
  const maxWidth = options?.maxWidth ?? VISION_MAX_WIDTH_DEFAULT;
  const maxHeight = options?.maxHeight ?? VISION_MAX_HEIGHT_DEFAULT;
  const jpegQuality = options?.jpegQuality ?? VISION_JPEG_QUALITY;
  const signal = options?.signal;
  if (signal?.aborted) {
    return null;
  }
  try {
    const data = await file.arrayBuffer();
    if (signal?.aborted) {
      return null;
    }
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    try {
      if (pageIndex < 1 || pageIndex > pdf.numPages) {
        pipelineLog("PDF", "render-page", "warn", "single page render: index out of range", {
          ...meta,
          pageIndex,
          numPages: pdf.numPages,
        });
        return null;
      }
      if (signal?.aborted) {
        return null;
      }
      const page = await pdf.getPage(pageIndex);
      const baseViewport = page.getViewport({ scale: 1 });
      const initialScale = Math.min(
        1,
        maxWidth / baseViewport.width,
        maxHeight / baseViewport.height,
      );
      const scale = combineRasterScaleLimits(
        baseViewport.width,
        baseViewport.height,
        initialScale,
      );
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) {
        pipelineLog("PDF", "render-page", "error", "single page: no canvas 2d context", {
          ...meta,
          pageIndex,
        });
        return null;
      }

      await page.render({ canvasContext, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
      canvas.width = 0;
      canvas.height = 0;
      return dataUrl;
    } finally {
      await pdf.destroy();
    }
  } catch (raw) {
    pipelineLog("PDF", "render-page", "error", "renderSinglePdfPageToDataUrl failed", {
      ...meta,
      pageIndex,
      ...normalizeUnknownError(raw),
      raw,
    });
    return null;
  }
}
