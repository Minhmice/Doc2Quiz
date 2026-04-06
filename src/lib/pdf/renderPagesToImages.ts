"use client";

import * as pdfjsLib from "pdfjs-dist";
import { ensurePdfWorker } from "@/lib/pdf/pdfWorker";

export const VISION_MAX_PAGES_DEFAULT = 20;
export const VISION_MAX_WIDTH_DEFAULT = 1024;
export const VISION_JPEG_QUALITY = 0.78;

export type PageImageResult = {
  pageIndex: number;
  dataUrl: string;
};

/**
 * Renders PDF pages to JPEG data URLs for multimodal chat (OpenAI-style image_url).
 */
export async function renderPdfPagesToImages(
  file: File,
  options: {
    signal: AbortSignal;
    maxPages?: number;
    maxWidth?: number;
    jpegQuality?: number;
    /** Fires after each page is rasterized (for progress UI / thumbnails). */
    onPageRendered?: (
      page: PageImageResult,
      meta: { totalPages: number },
    ) => void;
  },
): Promise<PageImageResult[]> {
  ensurePdfWorker();
  const {
    signal,
    maxPages = VISION_MAX_PAGES_DEFAULT,
    maxWidth = VISION_MAX_WIDTH_DEFAULT,
    jpegQuality = VISION_JPEG_QUALITY,
    onPageRendered,
  } = options;

  const data = await file.arrayBuffer();
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const pdf = await pdfjsLib.getDocument({ data }).promise;
  try {
    const pageCount = pdf.numPages;
    const limit = Math.min(pageCount, maxPages);
    const out: PageImageResult[] = [];

    for (let i = 1; i <= limit; i++) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const page = await pdf.getPage(i);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale =
        baseViewport.width > maxWidth ? maxWidth / baseViewport.width : 1;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas 2D context not available");
      }

      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
      const pageResult = { pageIndex: i, dataUrl };
      out.push(pageResult);
      onPageRendered?.(pageResult, { totalPages: limit });
    }

    return out;
  } finally {
    await pdf.destroy();
  }
}
