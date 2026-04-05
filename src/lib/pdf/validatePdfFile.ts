export type PdfValidationError = "type" | "size";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function validatePdfFile(
  file: File,
): { ok: true } | { ok: false; error: PdfValidationError } {
  const looksPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  if (!looksPdf) {
    return { ok: false, error: "type" };
  }

  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "size" };
  }

  return { ok: true };
}
