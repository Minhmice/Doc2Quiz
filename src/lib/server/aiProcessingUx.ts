import type { UserAiTier } from "@/lib/server/ai-processing-config";
import {
  isAiProcessingConfigured,
} from "@/lib/server/ai-processing-config";
import { AI_PROCESSING_UNAVAILABLE_MESSAGE } from "@/lib/ai/processingMessages";
import type { AiProcessingUxStatus } from "@/types/aiProcessingUx";

export function buildAiProcessingUxStatus(tier: UserAiTier): AiProcessingUxStatus {
  return {
    label: tier === "pro" ? "Advanced processing" : "Standard processing",
    available: isAiProcessingConfigured(),
  };
}

export { AI_PROCESSING_UNAVAILABLE_MESSAGE };
