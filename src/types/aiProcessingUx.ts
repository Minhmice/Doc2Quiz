/** Safe client-facing processing status (no URL, key, or model ids). */
export type AiProcessingUxStatus = {
  label: "Standard processing" | "Advanced processing";
  available: boolean;
};
