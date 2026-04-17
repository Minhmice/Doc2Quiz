"use client";

import {
  fileSummary,
  isPipelineVerbose,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { getPdfjs } from "@/lib/pdf/getPdfjs";
import { ensurePdfWorker } from "@/lib/pdf/pdfWorker";

function textContentToPageString(content: { items: readonly unknown[] }): string {
  let out = "";
  for (const raw of content.items) {
    if (
      raw &&
      typeof raw === "object" &&
      "str" in raw &&
      typeof (raw as { str: unknown }).str === "string"
    ) {
      const item = raw as { str: string; hasEOL?: boolean };
      out += item.str;
      if (item.hasEOL) {
        out += "\n";
      } else {
        out += " ";
      }
    }
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Extracts plain text from a PDF via pdf.js (text layer only; no OCR).
 * Never throws; returns "" on failure or abort.
 */
export async function extractPdfText(
  file: File,
  signal?: AbortSignal,
): Promise<string> {
  const meta = fileSummary(file);
  try {
    ensurePdfWorker();
    if (signal?.aborted) {
      pipelineLog("PDF", "extract-text", "warn", "aborted before start", meta);
      return "";
    }
    if (isPipelineVerbose()) {
      pipelineLog("PDF", "extract-text", "info", "starting text extraction", meta);
    }
    const data = await file.arrayBuffer();
    if (signal?.aborted) {
      return "";
    }
    if (isPipelineVerbose()) {
      pipelineLog("PDF", "array-buffer", "info", "arrayBuffer ready (extract)", {
        ...meta,
        byteLength: data.byteLength,
      });
    }
    pipelineLog("PDF", "open", "info", "getDocument() starting (text extract)", meta);
    const pdfjsLib = await getPdfjs();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    try {
      const numPages = pdf.numPages;
      const pageTexts: string[] = [];
      for (let i = 1; i <= numPages; i++) {
        if (signal?.aborted) {
          pipelineLog("PDF", "extract-text", "warn", "aborted mid extract", {
            ...meta,
            stoppedAtPage: i,
          });
          return "";
        }
        if (isPipelineVerbose()) {
          pipelineLog("PDF", "extract-text", "info", "getPage + getTextContent", {
            ...meta,
            pageIndex: i,
            numPages,
          });
        }
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageStr = textContentToPageString(textContent);
        if (pageStr.length > 0) {
          pageTexts.push(pageStr);
        }
      }
      const out = pageTexts.join("\n\n");
      pipelineLog("PDF", "extract-text", "info", "text extraction finished", {
        ...meta,
        numPages,
        nonEmptyPageCount: pageTexts.length,
        totalChars: out.length,
      });
      return out;
    } finally {
      await pdf.destroy();
    }
  } catch (raw) {
    const norm = normalizeUnknownError(raw);
    pipelineLog("PDF", "extract-text", "error", "text extraction failed (returning empty string)", {
      ...meta,
      ...norm,
      raw,
      hint:
        norm.pdfJsName === "PasswordException"
          ? "Encrypted PDF — text layer unavailable without password"
          : undefined,
    });
    return "";
  }
}

/**
 * Extract plain text for a 1-based inclusive page range (text layer only).
 * Clamps to the document page count; returns "" on abort or failure.
 */
export async function extractPdfTextForPageRange(
  file: File,
  firstPage: number,
  lastPageInclusive: number,
  signal?: AbortSignal,
): Promise<string> {
  const meta = fileSummary(file);
  const lo = Math.max(1, Math.min(firstPage, lastPageInclusive));
  const hi = Math.max(lo, lastPageInclusive);
  try {
    ensurePdfWorker();
    if (signal?.aborted) {
      pipelineLog("PDF", "extract-text", "warn", "aborted before start (range)", meta);
      return "";
    }
    const data = await file.arrayBuffer();
    if (signal?.aborted) {
      return "";
    }
    const pdfjsLib = await getPdfjs();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    try {
      const numPages = pdf.numPages;
      const start = Math.min(lo, numPages);
      const end = Math.min(hi, numPages);
      const pageTexts: string[] = [];
      for (let i = start; i <= end; i++) {
        if (signal?.aborted) {
          pipelineLog("PDF", "extract-text", "warn", "aborted mid extract (range)", {
            ...meta,
            stoppedAtPage: i,
          });
          return "";
        }
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageStr = textContentToPageString(textContent);
        if (pageStr.length > 0) {
          pageTexts.push(pageStr);
        }
      }
      return pageTexts.join("\n\n");
    } finally {
      await pdf.destroy();
    }
  } catch (raw) {
    const norm = normalizeUnknownError(raw);
    pipelineLog("PDF", "extract-text", "error", "range text extraction failed (returning empty)", {
      ...meta,
      ...norm,
      raw,
    });
    return "";
  }
}
