import {
  REASON_FORWARD_INVALID_BASE_URL,
  REASON_FORWARD_MISSING_API_KEY,
  REASON_FORWARD_MISSING_MODEL,
} from "@/lib/ai/parseCapabilities";
import { AI_PROCESSING_UNAVAILABLE_MESSAGE } from "@/lib/ai/processingMessages";

/** Short English copy for parse UI when a surface is blocked. */
export function parseCapabilityUserMessage(reasonKey: string | undefined): string {
  switch (reasonKey) {
    case REASON_FORWARD_MISSING_API_KEY:
      return AI_PROCESSING_UNAVAILABLE_MESSAGE;
    case REASON_FORWARD_MISSING_MODEL:
      return AI_PROCESSING_UNAVAILABLE_MESSAGE;
    case REASON_FORWARD_INVALID_BASE_URL:
      return AI_PROCESSING_UNAVAILABLE_MESSAGE;
    default:
      return AI_PROCESSING_UNAVAILABLE_MESSAGE;
  }
}
