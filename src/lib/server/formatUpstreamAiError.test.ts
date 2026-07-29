import { describe, expect, it } from "vitest";

import { formatUpstreamAiError, isRetryableUpstreamAiError } from "@/lib/server/formatUpstreamAiError";

describe("formatUpstreamAiError", () => {
  it("maps Cloudflare 524 HTML to a short message", () => {
    const html =
      "<!DOCTYPE html><title>minhmice.com | 524: A timeout occurred</title>";
    expect(formatUpstreamAiError(524, html)).toContain("Cloudflare 524");
    expect(formatUpstreamAiError(524, html).length).toBeLessThan(300);
  });

  it("detects retryable upstream timeouts", () => {
    expect(isRetryableUpstreamAiError(524, "524: A timeout occurred")).toBe(true);
    expect(isRetryableUpstreamAiError(200, "ok")).toBe(false);
  });
});
