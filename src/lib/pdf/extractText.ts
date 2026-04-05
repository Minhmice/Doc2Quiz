"use client";

import * as pdfjsLib from "pdfjs-dist";
import type { ExtractResult } from "@/types/pdf";

let workerConfigured = false;

export function ensurePdfWorker(): void {
  if (typeof window === "undefined") return;
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
  }
}

export async function extractText(file: File): Promise<ExtractResult> {
  ensurePdfWorker();
  const data = await file.arrayBuffer();

  try {
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pageCount = pdf.numPages;
    const parts: string[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const line = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      parts.push(line);
    }

    const text = parts.join("\n\n").trim();
    return { text, pageCount };
  } catch {
    const err = new Error("PDF_EXTRACT_FAILED");
    throw err;
  }
}
