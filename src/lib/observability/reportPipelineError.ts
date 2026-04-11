import * as Sentry from "@sentry/nextjs";
import {
  normalizeUnknownError,
  pipelineLog,
  type PipelineDomain,
} from "@/lib/logging/pipelineLogger";

const SAFE_META_KEYS = new Set([
  "studySetId",
  "pageCount",
  "pageIndex",
  "runKind",
]);

function filterMeta(
  meta?: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!meta) {
    return out;
  }
  for (const [k, v] of Object.entries(meta)) {
    if (!SAFE_META_KEYS.has(k)) {
      continue;
    }
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Local `pipelineLog` error + optional Sentry when DSN is configured (13-01).
 * Never pass raw PDF bytes, data URLs, question text, or API keys in `meta`.
 */
export function reportPipelineError(
  domain: PipelineDomain,
  stage: string,
  err: unknown,
  meta?: Record<string, string | number | boolean | null | undefined>,
): void {
  const normalized = normalizeUnknownError(err);
  const safeMeta = filterMeta(meta);
  pipelineLog(domain, stage, "error", normalized.message, {
    ...normalized,
    ...safeMeta,
  });

  const client = Sentry.getClient();
  if (!client?.getOptions()?.enabled) {
    return;
  }

  const toCapture = err instanceof Error ? err : new Error(normalized.message);
  Sentry.captureException(toCapture, {
    tags: {
      d2q_pipeline_domain: domain,
      d2q_pipeline_stage: stage,
    },
    extra: safeMeta,
  });
}
