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
