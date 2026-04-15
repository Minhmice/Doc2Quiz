/**
 * Many gateways (e.g. 9router) show a "Base URL" like https://host/v1.
 * OpenAI-compatible chat calls must POST to …/v1/chat/completions.
 */
export function normalizeOpenAiChatCompletionsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return trimmed;
  }
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const pl = path.toLowerCase();
  if (pl.endsWith("/chat/completions")) {
    return u.toString();
  }
  if (pl === "/v1" || pl.endsWith("/v1")) {
    u.pathname = `${path}/chat/completions`;
    return u.toString();
  }
  return u.toString();
}

/**
 * When `endpoint` is OpenAI-style `…/chat/completions`, returns sibling `…/models`
 * for a cheap GET key check. Otherwise `null`.
 */
export function deriveOpenAiModelsListUrlFromChatCompletions(
  chatCompletionsUrl: string,
): string | null {
  let u: URL;
  try {
    u = new URL(chatCompletionsUrl.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return null;
  }
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const pl = path.toLowerCase();
  const suffix = "/chat/completions";
  if (!pl.endsWith(suffix)) {
    return null;
  }
  u.pathname = `${path.slice(0, path.length - suffix.length)}/models`;
  return u.toString();
}
