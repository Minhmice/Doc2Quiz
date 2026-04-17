/**
 * Phase 19 — per-stage retry policy (max attempts, backoff, retryable predicates).
 *
 * **Mapping:** no automatic retry — log + toast + continue (Phase 14). Do not add MAPPING retries here.
 *
 * **json_validate:** maxAttempts 1 — structural validation is local; re-prompt is a higher layer.
 */

import { FatalParseError, isAbortError } from "@/lib/ai/errors";

export type PipelineRetryStage =
  | "ocr_page"
  | "llm_chunk"
  | "llm_validator"
  | "llm_vision"
  | "json_validate"
  | "idb_put";

export type StageRetryPolicy = {
  maxAttempts: number;
  delaysMs: number[];
  shouldRetry: (err: unknown) => boolean;
};

function isTransientNetworkish(err: unknown): boolean {
  if (err instanceof FatalParseError) {
    return false;
  }
  if (isAbortError(err)) {
    return false;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("fetch") ||
    m.includes("network") ||
    m.includes("failed to fetch")
  );
}

function isEmptyOrJsonParseFailure(err: unknown): boolean {
  if (err instanceof FatalParseError) {
    return false;
  }
  if (isAbortError(err)) {
    return false;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Empty OpenAI message content") ||
    msg.includes("Invalid JSON") ||
    msg.includes("No JSON object") ||
    msg.includes("Unbalanced JSON")
  );
}

/** OCR page: model returned prose/markdown/HTML instead of JSON, or empty content — worth one or two more attempts. */
function isOcrPageModelOutputRetryable(err: unknown): boolean {
  if (err instanceof FatalParseError) {
    return false;
  }
  if (isAbortError(err)) {
    return false;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.toLowerCase();
  return (
    m.includes("did not return valid json") ||
    m.includes("invalid json from chat api") ||
    m.includes("invalid json") ||
    m.includes("empty model message") ||
    m.includes("empty openai message") ||
    m.includes("html instead of json")
  );
}

function shouldRetryOcrPage(err: unknown): boolean {
  return isTransientNetworkish(err) || isOcrPageModelOutputRetryable(err);
}

function isIdbTransient(err: unknown): boolean {
  if (isAbortError(err)) {
    return false;
  }
  const name = err instanceof DOMException ? err.name : (err as Error)?.name;
  return name === "QuotaExceededError" || name === "UnknownError";
}

export const STAGE_RETRY: Record<PipelineRetryStage, StageRetryPolicy> = {
  ocr_page: {
    maxAttempts: 3,
    delaysMs: [350, 700, 1200],
    shouldRetry: shouldRetryOcrPage,
  },
  llm_chunk: {
    maxAttempts: 2,
    delaysMs: [350],
    shouldRetry: isEmptyOrJsonParseFailure,
  },
  llm_validator: {
    maxAttempts: 2,
    delaysMs: [350],
    shouldRetry: isEmptyOrJsonParseFailure,
  },
  llm_vision: {
    maxAttempts: 2,
    delaysMs: [350],
    shouldRetry: isEmptyOrJsonParseFailure,
  },
  json_validate: {
    maxAttempts: 1,
    delaysMs: [],
    shouldRetry: () => false,
  },
  idb_put: {
    maxAttempts: 3,
    delaysMs: [50, 150, 400],
    shouldRetry: isIdbTransient,
  },
};

export async function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * Runs `fn` up to `policy.maxAttempts` times. Honors `signal` — no retry after abort.
 */
export async function withRetries<T>(
  stage: PipelineRetryStage,
  signal: AbortSignal | undefined,
  fn: (attemptIndex: number) => Promise<T>,
): Promise<T> {
  const policy = STAGE_RETRY[stage];
  let lastErr: unknown;
  for (let i = 0; i < policy.maxAttempts; i++) {
    if (signal?.aborted) {
      throw signal.reason;
    }
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      if (signal?.aborted || isAbortError(e)) {
        throw e;
      }
      const can = i < policy.maxAttempts - 1 && policy.shouldRetry(e);
      if (!can) {
        throw e;
      }
      const delay = policy.delaysMs[i] ?? policy.delaysMs.at(-1) ?? 300;
      await sleepMs(delay, signal);
    }
  }
  throw lastErr;
}
