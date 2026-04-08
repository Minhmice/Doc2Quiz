"use client";

import * as pdfjsLib from "pdfjs-dist";
import { isPipelineVerbose, pipelineLog } from "@/lib/logging/pipelineLogger";

let workerConfigured = false;

export function ensurePdfWorker(): void {
  if (typeof window === "undefined") {
    if (isPipelineVerbose()) {
      pipelineLog(
        "PDF",
        "worker",
        "warn",
        "ensurePdfWorker skipped (no window — SSR or non-browser)",
        {},
      );
    }
    return;
  }
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
    pipelineLog("PDF", "worker", "warn", "pdf.js GlobalWorkerOptions.workerSrc set (once per session)", {
      workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
    });
  }
}
