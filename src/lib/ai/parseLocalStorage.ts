export const LS_ATTACH_PAGE_IMAGE = "doc2quiz:parse:attachPageImage";
export const LS_ENABLE_OCR = "doc2quiz:parse:enableOcr";
export const LS_PARSE_STRATEGY = "doc2quiz:parse:strategy";

export type ParseStrategy = "fast" | "accurate" | "hybrid";

export function readAttachPageImagePreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const v = localStorage.getItem(LS_ATTACH_PAGE_IMAGE);
    if (v === null) {
      return true;
    }
    return v === "1";
  } catch {
    return true;
  }
}

export function readEnableOcrPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const v = localStorage.getItem(LS_ENABLE_OCR);
    if (v === null) {
      return true;
    }
    return v === "1";
  } catch {
    return true;
  }
}

export function readParseStrategyPreference(): ParseStrategy {
  if (typeof window === "undefined") {
    return "accurate";
  }
  try {
    const v = localStorage.getItem(LS_PARSE_STRATEGY);
    if (v === "fast" || v === "hybrid") {
      return v;
    }
    return "accurate";
  } catch {
    return "accurate";
  }
}

export function persistAttachPageImageToStorage(next: boolean): void {
  try {
    localStorage.setItem(LS_ATTACH_PAGE_IMAGE, next ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function persistEnableOcrToStorage(next: boolean): void {
  try {
    localStorage.setItem(LS_ENABLE_OCR, next ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function persistParseStrategyToStorage(next: ParseStrategy): void {
  try {
    localStorage.setItem(LS_PARSE_STRATEGY, next);
  } catch {
    /* ignore */
  }
}
