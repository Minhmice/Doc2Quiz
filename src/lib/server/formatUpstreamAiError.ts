const HTML_PREFIX = /^\s*<!DOCTYPE/i;

export function isRetryableUpstreamAiError(status: number, body: string): boolean {
  if (status === 520 || status === 524 || status === 502 || status === 503 || status === 429) {
    return true;
  }
  const sample = body.slice(0, 2000);
  return /524:\s*a timeout occurred|error code 524|timed out|timeout occurred/i.test(
    sample,
  );
}

export function formatUpstreamAiError(status: number, body: string): string {
  const sample = body.slice(0, 4000);

  if (
    status === 524 ||
    /524:\s*a timeout occurred|error code 524/i.test(sample)
  ) {
    return (
      "AI gateway timed out (Cloudflare 524). The document may be too large for the current AI route — " +
      "retry with a smaller file or fewer pages, or use a faster AI endpoint."
    );
  }

  if (status === 520) {
    return "AI provider is temporarily unavailable (Cloudflare 520). Your document was processed with the built-in fallback; retry later for an AI-enhanced result.";
  }

  if (HTML_PREFIX.test(body.trim()) || sample.includes("cf-error-details")) {
    return `AI gateway returned an error page (${status}). Your document was processed with the built-in fallback; retry later or check AI_PROVIDER_URL for an AI-enhanced result.`;
  }

  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) {
    return `AI request failed (${status}).`;
  }
  return `AI request failed (${status}): ${compact.slice(0, 400)}`;
}
