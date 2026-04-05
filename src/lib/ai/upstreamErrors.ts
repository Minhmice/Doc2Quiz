/**
 * Upstream APIs should return JSON; HTML usually means wrong URL, CDN, or WAF page.
 */

export function responseLooksLikeHtml(text: string): boolean {
  const head = text.trimStart().slice(0, 300);
  return /<!DOCTYPE\s+html/i.test(head) || /<html[\s>]/i.test(head);
}

/**
 * User-facing message for failed HTTP responses (avoid dumping HTML into the UI).
 */
export function describeBadAiResponse(status: number, bodyText: string): string {
  const html = responseLooksLikeHtml(bodyText);

  if (status === 530) {
    return html
      ? "HTTP 530: the network edge (often Cloudflare) returned an error page — usually the API origin is down, DNS/SSL is wrong, or the URL is not the JSON API (e.g. you pasted a dashboard or site URL). Use the exact chat-completions endpoint from your provider (…/v1/chat/completions or equivalent)."
      : "HTTP 530: origin unreachable from the CDN. Check the API URL, DNS, and that the service accepts HTTPS POST.";
  }

  if (status === 521) {
    return "HTTP 521: the web server is down (common Cloudflare message). Your API host may be offline or refusing connections.";
  }
  if (status === 522 || status === 523) {
    return `HTTP ${status}: connection timed out or unreachable to the API origin — check URL, firewall, and provider status.`;
  }
  if (status === 524) {
    return "HTTP 524: timeout waiting for the origin — server overloaded or too slow.";
  }

  if (html) {
    return `HTTP ${status}: received HTML instead of JSON — wrong path, WAF block, or login page. Use the documented API POST URL for chat/completions, not a browser page.`;
  }

  try {
    const j = JSON.parse(bodyText) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof j.error === "object" && j.error && typeof j.error.message === "string") {
      return `${status}: ${j.error.message}`;
    }
    if (typeof j.error === "string" && j.error.length > 0) {
      return `${status}: ${j.error}`;
    }
    if (typeof j.message === "string" && j.message.length > 0) {
      return `${status}: ${j.message}`;
    }
  } catch {
    /* not JSON */
  }

  const short = bodyText.trim().replace(/\s+/g, " ").slice(0, 180);
  if (short.length > 0) {
    return `Request failed (${status}): ${short}`;
  }
  return `Request failed (${status}).`;
}
