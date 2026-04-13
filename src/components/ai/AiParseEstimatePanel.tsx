"use client";

import type { ParseRunEstimate } from "@/lib/ai/estimateParseRun";

type Props = {
  estimate: ParseRunEstimate | null;
};

export function AiParseEstimatePanel({ estimate }: Props) {
  if (!estimate) {
    return null;
  }

  const visionSteps = estimate.visionApiCalls;
  const chunkUpper = estimate.chunkParseApiCallsUpperBound;
  const fallbackVision = estimate.visionFallbackApiCallsUpperBound;
  const noPrimarySteps = visionSteps === 0 && chunkUpper === 0;

  const hideVisionTokenLine =
    estimate.estimatedVisionInputTokensUpper === 0 &&
    estimate.estimatedVisionOutputTokensUpper === 0 &&
    estimate.estimatedChunkInputTokensUpper === 0 &&
    estimate.estimatedChunkOutputTokensUpper === 0;

  return (
    <div
      className="space-y-1 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-foreground"
      aria-live="polite"
      aria-atomic="true"
    >
      {noPrimarySteps ? (
        <p>No API steps estimated.</p>
      ) : (
        <>
          {visionSteps > 0 ? (
            <p>~{visionSteps} vision API step(s)</p>
          ) : null}
          {chunkUpper > 0 ? (
            <p>
              Up to ~{chunkUpper} chunk parse call(s) (upper bound)
            </p>
          ) : null}
        </>
      )}
      {fallbackVision > 0 ? (
        <p>
          If chunk path fails, up to ~{fallbackVision} vision fallback step(s)
        </p>
      ) : null}
      <p>
        About {estimate.estimatedDurationSecondsMin}–
        {estimate.estimatedDurationSecondsMax} s (rough)
      </p>
      {!hideVisionTokenLine ? (
        <p>
          Vision tokens (upper ~): ~{estimate.estimatedVisionInputTokensUpper}{" "}
          in / ~{estimate.estimatedVisionOutputTokensUpper} out
        </p>
      ) : null}
      {estimate.estimatedChunkInputTokensUpper > 0 ||
      estimate.estimatedChunkOutputTokensUpper > 0 ? (
        <p>
          Chunk parse tokens (upper ~): ~
          {estimate.estimatedChunkInputTokensUpper} in / ~
          {estimate.estimatedChunkOutputTokensUpper} out
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">{estimate.disclaimer}</p>
    </div>
  );
}
