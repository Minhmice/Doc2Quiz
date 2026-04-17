"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  fileSummary,
  isPipelineVerbose,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { getPdfjs } from "@/lib/pdf/getPdfjs";
import { ensurePdfWorker } from "@/lib/pdf/pdfWorker";

/** Opens the PDF with pdf.js and returns `numPages` (no text extraction). */
export async function getPdfPageCount(file: File): Promise<number> {
  const meta = fileSummary(file);
  ensurePdfWorker();
  let pdf: PDFDocumentProxy | undefined;
  try {
    if (isPipelineVerbose()) {
      pipelineLog("PDF", "array-buffer", "info", "reading arrayBuffer (page count)", meta);
    }
    const data = await file.arrayBuffer();
    if (isPipelineVerbose()) {
      pipelineLog("PDF", "array-buffer", "info", "arrayBuffer ready", {
        ...meta,
        byteLength: data.byteLength,
      });
    }
    pipelineLog("PDF", "open", "info", "getDocument() starting (page count)", meta);
    const pdfjsLib = await getPdfjs();
    pdf = await pdfjsLib.getDocument({ data }).promise;
    const numPages = pdf.numPages;
    pipelineLog("PDF", "page-count", "info", "PDF opened; numPages read", {
      ...meta,
      numPages,
    });
    return numPages;
  } catch (raw) {
    const norm = normalizeUnknownError(raw);
    pipelineLog("PDF", "open", "error", "getDocument() failed (page count path)", {
      ...meta,
      ...norm,
      raw,
      hint:
        norm.pdfJsName === "PasswordException"
          ? "Likely password-protected / encrypted PDF"
          : norm.pdfJsName === "InvalidPDFException"
            ? "Invalid or corrupted PDF structure"
            : norm.pdfJsName === "MissingPDFException"
              ? "Missing or empty PDF data"
              : undefined,
    });
    throw new Error("PDF_OPEN_FAILED", { cause: raw });
  } finally {
    await pdf?.destroy();
  }
}
