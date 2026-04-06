"use client";

import * as pdfjsLib from "pdfjs-dist";

let workerConfigured = false;

export function ensurePdfWorker(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
  }
}
