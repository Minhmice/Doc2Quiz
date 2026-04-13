import {
  REASON_FORWARD_INVALID_BASE_URL,
  REASON_FORWARD_MISSING_API_KEY,
  REASON_FORWARD_MISSING_MODEL,
} from "@/lib/ai/parseCapabilities";

/** Short English copy for parse UI when a surface is blocked. */
export function parseCapabilityUserMessage(reasonKey: string | undefined): string {
  switch (reasonKey) {
    case REASON_FORWARD_MISSING_API_KEY:
      return "Add an API key in Settings to run OCR, layout parse, or vision.";
    case REASON_FORWARD_MISSING_MODEL:
      return "Enter a model id in Settings when using a custom API base URL.";
    case REASON_FORWARD_INVALID_BASE_URL:
      return "Fix the API base URL in Settings (must be http or https).";
    default:
      return "Check AI settings before parsing.";
  }
}
