/**
 * Declarative v1: which parse surfaces are allowed given server AI availability.
 */

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

/**
 * v1 rules: LLM/OCR forward surfaces require server-side AI processing to be configured
 * (`/api/ai/processing-status` → available).
 */
export function getSurfaceAvailability(args: {
  serverProcessingAvailable: boolean;
  attachPageImages: boolean;
}): SurfaceAvailability[] {
  const { serverProcessingAvailable, attachPageImages } = args;

  const llmBlocked = serverProcessingAvailable
    ? undefined
    : REASON_FORWARD_MISSING_API_KEY;

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
