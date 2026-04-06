"use client";

import * as pdfjsLib from "pdfjs-dist";
import { ensurePdfWorker } from "@/lib/pdf/pdfWorker";

/** Opens the PDF with pdf.js and returns `numPages` (no text extraction). */
export async function getPdfPageCount(file: File): Promise<number> {
  ensurePdfWorker();
  const data = await file.arrayBuffer();
  try {
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    return pdf.numPages;
  } catch {
    throw new Error("PDF_OPEN_FAILED");
  }
}
