import { getChatCompletionsUrl } from "@/lib/server/ai-processing-config";

type PostArgs = {
  configUrl: string;
  apiKey: string;
  model: string;
  messages: unknown[];
  responseFormatJsonObject?: boolean;
  /** Defaults to 0 for deterministic server pipelines when omitted. */
  temperature?: number;
  /** OpenAI-compatible chat seed (integer). */
  seed?: number;
  signal?: AbortSignal;
};

/**
 * Direct OpenAI-compatible chat completion (server-only). Does not pass through the browser.
 */
export async function postChatCompletionAssistantText(
  args: PostArgs,
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const targetUrl = getChatCompletionsUrl(args.configUrl);
  const body: Record<string, unknown> = {
    model: args.model,
    messages: args.messages,
    stream: false,
    max_tokens: 16384,
    temperature: args.temperature ?? 0,
  };
  if (args.seed !== undefined) {
    body.seed = args.seed;
  }
  if (args.responseFormatJsonObject) {
    body.response_format = { type: "json_object" };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.apiKey}`,
    "Content-Type": "application/json",
  };

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: args.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upstream request failed";
    return { ok: false, status: 502, body: msg };
  }

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text.slice(0, 4000) };
  }

  let data: { choices?: Array<{ message?: { content?: string | null } }> };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return { ok: false, status: 502, body: "Invalid JSON from chat API" };
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    return { ok: false, status: 502, body: "Empty assistant content" };
  }
  return { ok: true, text: content.trim() };
}
