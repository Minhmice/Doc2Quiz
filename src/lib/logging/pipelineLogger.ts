/**
 * Structured console logging for PDF intake, OCR, vision, and IDB.
 * - `info`: only when `NODE_ENV === "development"` or `NEXT_PUBLIC_D2Q_PIPELINE_DEBUG === "1"`.
 * - `warn` / `error`: always emitted (for diagnosing failures in any environment).
 */

import type { VisionPipelineEvent } from "@/types/visionParse";

export type PipelineDomain =
  | "PDF"
  | "OCR"
  | "VISION"
  | "IDB"
  | "STUDY_SET"
  | "MAPPING";

export function isPipelineVerbose(): boolean {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    return true;
  }
  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_D2Q_PIPELINE_DEBUG === "1"
  ) {
    return true;
  }
  return false;
}

export function fileSummary(
  file: File | null | undefined,
): Record<string, unknown> | undefined {
  if (!file) {
    return undefined;
  }
  const name = file.name;
  const ext = name.includes(".")
    ? name.slice(name.lastIndexOf(".")).toLowerCase()
    : "";
  return {
    fileName: name,
    fileSize: file.size,
    fileType: file.type && file.type.length > 0 ? file.type : "(empty mime)",
    extension: ext || "(no extension)",
  };
}

export type NormalizedError = {
  message: string;
  name?: string;
  stack?: string;
  cause?: unknown;
  pdfJsName?: string;
  /** Original when safe to stringify for console */
  rawType?: string;
};

export function normalizeUnknownError(err: unknown): NormalizedError {
  const pdfJsName =
    err !== null &&
    typeof err === "object" &&
    "name" in err &&
    typeof (err as { name: unknown }).name === "string"
      ? (err as { name: string }).name
      : undefined;

  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
      cause: err.cause,
      pdfJsName: pdfJsName ?? err.name,
      rawType: err.constructor?.name,
    };
  }
  if (err !== null && typeof err === "object") {
    const m = (err as { message?: unknown }).message;
    return {
      message: typeof m === "string" ? m : JSON.stringify(err),
      pdfJsName,
      rawType: (err as { constructor?: { name?: string } }).constructor?.name,
    };
  }
  return { message: String(err), rawType: typeof err };
}

export function pipelineLog(
  domain: PipelineDomain,
  stage: string,
  level: "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
): void {
  const prefix = `[${domain}][${stage}]`;
  const payload = { message, ...context };
  if (level === "error") {
    console.error(prefix, payload);
    return;
  }
  if (level === "warn") {
    console.warn(prefix, payload);
    return;
  }
  if (isPipelineVerbose()) {
    console.info(prefix, payload);
  }
}

/**
 * Structured vision MVP events (Phase 21). Flattens into `pipelineLog` info — no console.error.
 */
export function visionPipelineEvent(event: VisionPipelineEvent): void {
  const { stage, message, ...ctx } = event;
  const payload: Record<string, unknown> = { stage, ...ctx };
  if (message) {
    payload.humanMessage = message;
  }
  pipelineLog("VISION", stage, "info", message ?? stage, payload);
}
