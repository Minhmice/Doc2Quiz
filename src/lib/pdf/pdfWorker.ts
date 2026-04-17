"use client";

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
    void (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        if (workerConfigured) {
          return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        workerConfigured = true;
        pipelineLog(
          "PDF",
          "worker",
          "warn",
          "pdf.js GlobalWorkerOptions.workerSrc set (once per session)",
          { workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc },
        );
      } catch (raw) {
        pipelineLog("PDF", "worker", "error", "Failed to configure pdf.js worker", {
          error: raw instanceof Error ? raw.message : String(raw),
        });
      }
    })();
  }
}
