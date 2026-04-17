/**
 * PDF text + page helpers (Phase 27 preview-first scheduling).
 */

export { extractPdfText, extractPdfTextForPageRange } from "./extractPdfText";
export { getPdfPageCount } from "./getPdfPageCount";

/** Preview-first window: first 3–5 pages (D-04). */
export const PREVIEW_FIRST_PAGE_BUDGET = 4;
