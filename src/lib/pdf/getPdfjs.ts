"use client";

import { pipelineLog } from "@/lib/logging/pipelineLogger";

export type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;
let workerConfigured = false;

/**
 * Loads pdf.js only in the browser so SSR/prerender never evaluates the main bundle
 * (pdfjs v5+ expects DOM APIs such as DOMMatrix).
 */
export async function getPdfjs(): Promise<PdfjsModule> {
  if (typeof window === "undefined") {
    throw new Error("pdf.js is only available in the browser");
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      if (!workerConfigured) {
        m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        workerConfigured = true;
        pipelineLog("PDF", "worker", "warn", "pdf.js GlobalWorkerOptions.workerSrc set (once per session)", {
          workerSrc: m.GlobalWorkerOptions.workerSrc,
        });
      }
      return m;
    });
  }
  return pdfjsPromise;
}
