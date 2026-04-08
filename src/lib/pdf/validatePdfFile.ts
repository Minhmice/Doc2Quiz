import { fileSummary, pipelineLog } from "@/lib/logging/pipelineLogger";

export type PdfValidationError = "type" | "size";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function validatePdfFile(
  file: File,
): { ok: true } | { ok: false; error: PdfValidationError } {
  const meta = fileSummary(file);
  const looksPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  if (!looksPdf) {
    pipelineLog("PDF", "validate", "warn", "validation failed: not a PDF by type or extension", {
      ...meta,
      error: "type",
    });
    return { ok: false, error: "type" };
  }

  if (file.size > MAX_PDF_BYTES) {
    pipelineLog("PDF", "validate", "warn", "validation failed: file too large", {
      ...meta,
      error: "size",
      maxBytes: MAX_PDF_BYTES,
    });
    return { ok: false, error: "size" };
  }

  pipelineLog("PDF", "validate", "info", "validation passed", meta);
  return { ok: true };
}
