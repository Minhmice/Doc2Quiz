/**
 * Phase 19 — declarative v1: which parse surfaces are allowed for the current forward BYOK config.
 * Rows are stable `reasonKey`s for UI; matrix rules may grow (e.g. modality probes) in later phases.
 */

import type { ForwardClientSettings } from "@/lib/ai/forwardSettings";

export const REASON_FORWARD_MISSING_API_KEY = "forward.missing_api_key";
export const REASON_FORWARD_MISSING_MODEL = "forward.missing_model";
export const REASON_FORWARD_INVALID_BASE_URL = "forward.invalid_base_url";

export type ParsePipelineSurface =
  | "text_mcq"
  | "ocr_forward"
  | "layout_chunk_llm"
  | "vision_multimodal"
  | "vision_attach"
  | "idb_bank_persist";

export type SurfaceAvailability = {
  surface: ParsePipelineSurface;
  status: "allowed" | "blocked";
  reasonKey?: string;
};

function isPlausibleHttpUrl(baseUrl: string): boolean {
  const t = baseUrl.trim();
  if (!t) {
    return true;
  }
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * v1 rules: require non-empty API key for any LLM/OCR forward surface; require model id when a custom base URL is set.
 * `idb_bank_persist` is always allowed (local-only; failures are IDB errors, not “missing key”).
 */
export function getSurfaceAvailability(args: {
  settings: ForwardClientSettings;
  attachPageImages: boolean;
}): SurfaceAvailability[] {
  const { settings, attachPageImages } = args;
  const keyOk = settings.apiKey.trim().length > 0;
  const urlOk = isPlausibleHttpUrl(settings.baseUrl);
  const hasCustomBase = settings.baseUrl.trim().length > 0;
  const modelOk = !hasCustomBase || settings.modelId.trim().length > 0;

  const llmBlocked = !keyOk
    ? REASON_FORWARD_MISSING_API_KEY
    : !urlOk
      ? REASON_FORWARD_INVALID_BASE_URL
      : !modelOk
        ? REASON_FORWARD_MISSING_MODEL
        : undefined;

  void attachPageImages;

  const llmRow = {
    status: (llmBlocked ? "blocked" : "allowed") as "allowed" | "blocked",
    reasonKey: llmBlocked,
  };

  return [
    {
      surface: "text_mcq" as const,
      ...llmRow,
    },
    {
      surface: "ocr_forward" as const,
      ...llmRow,
    },
    {
      surface: "layout_chunk_llm" as const,
      ...llmRow,
    },
    {
      surface: "vision_multimodal" as const,
      ...llmRow,
    },
    {
      surface: "vision_attach" as const,
      ...llmRow,
    },
    {
      surface: "idb_bank_persist" as const,
      status: "allowed" as const,
    },
  ];
}

export function isSurfaceAllowed(
  list: SurfaceAvailability[],
  surface: ParsePipelineSurface,
): boolean {
  return list.find((x) => x.surface === surface)?.status === "allowed";
}

export function surfaceBlockReason(
  list: SurfaceAvailability[],
  surface: ParsePipelineSurface,
): string | undefined {
  const row = list.find((x) => x.surface === surface);
  if (!row || row.status === "allowed") {
    return undefined;
  }
  return row.reasonKey;
}
