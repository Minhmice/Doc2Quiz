"use client";

import {
  fileSummary,
  isPipelineVerbose,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { getPdfjs } from "@/lib/pdf/getPdfjs";
import { ensurePdfWorker } from "@/lib/pdf/pdfWorker";

export type TextLayerSignal = {
  sampledPages: number;
  nonEmptyPageRatio: number;
  charsPerPage: number;
  totalChars: number;
  nonEmptyPages: number;
};

const SAFE_UNKNOWN_SIGNAL: TextLayerSignal = {
  sampledPages: 0,
  nonEmptyPageRatio: 0,
  charsPerPage: 0,
  totalChars: 0,
  nonEmptyPages: 0,
};

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

function computeSignal(sampledPages: number, totalChars: number, nonEmptyPages: number): TextLayerSignal {
  if (sampledPages <= 0) {
    return SAFE_UNKNOWN_SIGNAL;
  }
  const charsPerPage = totalChars / sampledPages;
  const nonEmptyPageRatio = nonEmptyPages / sampledPages;
  return {
    sampledPages,
    nonEmptyPageRatio,
    charsPerPage,
    totalChars,
    nonEmptyPages,
  };
}

/**
 * Computes a document-level text-layer signal by sampling the first few pages via pdf.js text content.
 * - Caps sampling to 3–5 pages (or fewer if document has < 3 pages)
 * - Returns numeric metrics only (no extracted text)
 * - Never throws; returns a safe "unknown" signal on failure/abort
 */
export async function sampleTextLayerSignal(
  file: File,
  options?: { signal?: AbortSignal; samplePages?: number },
): Promise<TextLayerSignal> {
  const meta = fileSummary(file);
  const signal = options?.signal;

  try {
    ensurePdfWorker();

    if (signal?.aborted) {
      pipelineLog("PDF", "text-signal", "warn", "aborted before start", meta);
      return SAFE_UNKNOWN_SIGNAL;
    }

    if (isPipelineVerbose()) {
      pipelineLog("PDF", "text-signal", "info", "starting sampled text-layer signal", meta);
    }

    const data = await file.arrayBuffer();
    if (signal?.aborted) {
      pipelineLog("PDF", "text-signal", "warn", "aborted after arrayBuffer()", meta);
      return SAFE_UNKNOWN_SIGNAL;
    }

    pipelineLog("PDF", "open", "info", "getDocument() starting (text signal)", meta ?? {});
    const pdfjsLib = await getPdfjs();
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    try {
      const pageCount = pdf.numPages;
      const requested = options?.samplePages ?? 5;
      const sampleCount = Math.min(
        pageCount,
        pageCount < 3 ? pageCount : clampInt(requested, 3, 5),
      );

      let totalChars = 0;
      let nonEmptyPages = 0;

      for (let i = 1; i <= sampleCount; i++) {
        if (signal?.aborted) {
          pipelineLog("PDF", "text-signal", "warn", "aborted mid sample", {
            ...meta,
            stoppedAtPage: i,
            sampledPagesTarget: sampleCount,
          });
          return SAFE_UNKNOWN_SIGNAL;
        }
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageChars = countTextChars(textContent);
        totalChars += pageChars;
        if (pageChars > 0) {
          nonEmptyPages += 1;
        }
      }

      const out = computeSignal(sampleCount, totalChars, nonEmptyPages);

      pipelineLog("PDF", "text-signal", "info", "sampled text-layer signal computed", {
        ...meta,
        pageCount,
        ...out,
      });

      return out;
    } finally {
      await pdf.destroy();
    }
  } catch (raw) {
    const norm = normalizeUnknownError(raw);
    pipelineLog("PDF", "text-signal", "error", "text-layer signal sampling failed (returning unknown)", {
      ...meta,
      ...norm,
      hint:
        norm.pdfJsName === "PasswordException"
          ? "Encrypted PDF — text signal unavailable without password"
          : undefined,
    });
    return SAFE_UNKNOWN_SIGNAL;
  }
}

