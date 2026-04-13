import { FatalParseError } from "@/lib/ai/errors";
import {
  DEFAULT_OPENAI_CHAT_URL,
  OPENAI_MODEL,
  resolveChatApiUrl,
  resolveModelId,
} from "@/lib/ai/parseChunk";
import type { AiProvider } from "@/types/question";
import {
  forwardAiPost,
  parseProxyForwardErrorBody,
} from "@/lib/ai/sameOriginForward";
import {
  describeBadAiResponse,
  responseLooksLikeHtml,
} from "@/lib/ai/upstreamErrors";
import { VISION_TEST_IMAGE_DATA_URL } from "@/lib/ai/visionTestImageData";

const AI_TEST_LOG = "[Doc2Quiz][AI-test]";

function newTestRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncateForLog(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}… [truncated, ${text.length} chars total]`;
}

function logAiTest(
  kind: "connection" | "vision",
  runId: string,
  step: string,
  payload: Record<string, unknown>,
): void {
  console.info(AI_TEST_LOG, kind, runId, step, payload);
}

function summarizeOpenAiSuccessBody(raw: string): Record<string, unknown> {
  try {
    const j = JSON.parse(raw) as {
      id?: string;
      model?: string;
      usage?: unknown;
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: unknown };
      }>;
    };
    const msg = j.choices?.[0]?.message?.content;
    let contentHint: string | unknown = msg;
    if (typeof msg === "string") {
      contentHint = truncateForLog(msg, 400);
    } else if (Array.isArray(msg)) {
      contentHint = `[${msg.length} parts]`;
    }
    return {
      responseId: j.id,
      responseModel: j.model,
      finishReason: j.choices?.[0]?.finish_reason,
      messageContent: contentHint,
      usage: j.usage,
    };
  } catch {
    return { parseNote: "Response body is not JSON or unexpected shape." };
  }
}

export type TestConnectionResult =
  | { ok: true }
  | { ok: false; message: string };

/** Re-export for callers that imported the probe image from this module. */
export { VISION_TEST_IMAGE_DATA_URL };

/** True when the assistant clearly did not get multimodal input (false “Vision OK”). */
export function visionTestReplyDeniesImage(reply: string): boolean {
  const t = reply.toLowerCase();
  const patterns = [
    "don't see",
    "dont see",
    "do not see",
    "no image",
    "not see an image",
    "not see any image",
    "cannot see",
    "can't see",
    "cant see",
    "unable to see",
    "didn't receive",
    "did not receive",
    "no picture",
    "no photo",
    "no visual",
    "not attached",
    "wasn't attached",
    "was not attached",
    "without an image",
    "without any image",
    "i don't have access",
    "i do not have access",
    "unable to view",
    "can't view",
    "no file",
    "haven't been given",
    "have not been given",
    "nothing attached",
    "there is no image",
    "there isn't an image",
    "i'm not able to view",
    "i am not able to view",
  ];
  return patterns.some((p) => t.includes(p));
}

export type TestVisionConnectionResult =
  | { ok: true; replyPreview: string }
  | { ok: false; message: string };

function stringifyChatMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const parts = content.map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }
      const p = part as { type?: string; text?: string };
      if (p.type === "text" && typeof p.text === "string") {
        return p.text;
      }
      return "";
    });
    return parts.join(" ").trim();
  }
  return "";
}

function readOpenAiChatMessageContent(text: string): string {
  let data: {
    choices?: Array<{ message?: { content?: string | unknown } }>;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    if (responseLooksLikeHtml(text)) {
      throw new Error(
        "API returned HTML instead of JSON — check the chat-completions URL.",
      );
    }
    throw new Error("Invalid JSON from chat API");
  }
  const raw = data.choices?.[0]?.message?.content;
  const out = stringifyChatMessageContent(raw);
  if (out.length === 0) {
    throw new Error(
      "Empty or non-text model reply — model may not support vision.",
    );
  }
  return out;
}

/**
 * Lightweight request to verify URL + API key (same shape as real parse calls).
 */
export async function testAiConnection(options: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  signal?: AbortSignal;
}): Promise<TestConnectionResult> {
  const { baseUrl, apiKey, modelId, signal } = options;
  const provider: AiProvider = baseUrl.trim() ? "custom" : "openai";
  const apiUrl = baseUrl;
  const model = modelId;
  const runId = newTestRunId();
  const key = apiKey.trim();
  if (!key) {
    logAiTest("connection", runId, "validation", {
      ok: false,
      reason: "missing_api_key",
    });
    return { ok: false, message: "Enter an API key." };
  }

  let endpoint: string;
  try {
    endpoint = resolveChatApiUrl(provider, apiUrl);
  } catch (e) {
    if (e instanceof FatalParseError) {
      logAiTest("connection", runId, "validation", {
        ok: false,
        reason: "bad_endpoint",
        message: e.message,
      });
      return { ok: false, message: e.message };
    }
    throw e;
  }

  try {
    const u = new URL(endpoint);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      logAiTest("connection", runId, "validation", {
        ok: false,
        reason: "bad_protocol",
        protocol: u.protocol,
      });
      return { ok: false, message: "URL must be http or https." };
    }
  } catch {
    logAiTest("connection", runId, "validation", {
      ok: false,
      reason: "invalid_url",
    });
    return { ok: false, message: "Invalid URL." };
  }

  let resolvedModelId: string;
  try {
    resolvedModelId = resolveModelId(provider, model);
  } catch (e) {
    if (e instanceof FatalParseError) {
      logAiTest("connection", runId, "validation", {
        ok: false,
        reason: "bad_model",
        message: e.message,
      });
      return { ok: false, message: e.message };
    }
    throw e;
  }

  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  logAiTest("connection", runId, "start", {
    provider,
    resolvedEndpoint: endpoint,
    modelId: resolvedModelId,
    forwardRoute: "POST /api/ai/forward",
    upstreamShape: "openai-compatible chat (text ping, max_tokens 1)",
  });

  try {
    const res = await forwardAiPost({
      provider: provider === "custom" ? "custom" : "openai",
      targetUrl: endpoint,
      apiKey: key,
      signal,
      body: {
        model: resolvedModelId,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      },
    });
    const errText = await res.text();
    const ms =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      t0;
    logAiTest("connection", runId, "upstream_response", {
      httpStatus: res.status,
      durationMs: Math.round(ms),
      responseChars: errText.length,
      bodySnippet: truncateForLog(errText, 2500),
    });
    if (res.ok) {
      logAiTest("connection", runId, "parsed_success", {
        ...summarizeOpenAiSuccessBody(errText),
      });
    }
    if (res.status === 401) {
      logAiTest("connection", runId, "result", { ok: false, reason: "401" });
      return { ok: false, message: "Invalid API key or unauthorized." };
    }
    if (res.status === 429) {
      logAiTest("connection", runId, "result", { ok: false, reason: "429" });
      return { ok: false, message: "Rate limited. Try again shortly." };
    }
    if (!res.ok) {
      const proxyMsg =
        res.status === 502 ? parseProxyForwardErrorBody(errText) : null;
      if (proxyMsg) {
        logAiTest("connection", runId, "result", {
          ok: false,
          reason: "upstream_via_proxy",
          proxyMessage: proxyMsg,
        });
        return { ok: false, message: proxyMsg };
      }
      const msg = describeBadAiResponse(res.status, errText);
      logAiTest("connection", runId, "result", {
        ok: false,
        reason: "http_error",
        userMessage: msg,
      });
      return {
        ok: false,
        message: msg,
      };
    }
    logAiTest("connection", runId, "result", { ok: true });
    return { ok: true };
  } catch (e) {
    const ms =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      t0;
    if (e instanceof DOMException && e.name === "AbortError") {
      logAiTest("connection", runId, "result", {
        ok: false,
        reason: "aborted",
        durationMs: Math.round(ms),
      });
      return { ok: false, message: "Cancelled." };
    }
    const msg = e instanceof Error ? e.message : "Network error.";
    logAiTest("connection", runId, "result", {
      ok: false,
      reason: "exception",
      durationMs: Math.round(ms),
      errorName: e instanceof Error ? e.name : typeof e,
      message: msg,
    });
    return {
      ok: false,
      message: msg,
    };
  }
}

/**
 * Sends one multimodal chat request (tiny PNG + short prompt) through the same
 * forward route as vision parsing. Use to confirm the model/gateway accepts images.
 */
export async function testAiVisionConnection(options: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  signal?: AbortSignal;
}): Promise<TestVisionConnectionResult> {
  const { baseUrl, apiKey, modelId, signal } = options;
  const provider: AiProvider = baseUrl.trim() ? "custom" : "openai";
  const apiUrl = baseUrl;
  const model = modelId;
  const runId = newTestRunId();
  const key = apiKey.trim();
  if (!key) {
    logAiTest("vision", runId, "validation", {
      ok: false,
      reason: "missing_api_key",
    });
    return { ok: false, message: "Enter an API key." };
  }

  let endpoint: string;
  try {
    endpoint = resolveChatApiUrl(provider, apiUrl);
  } catch (e) {
    if (e instanceof FatalParseError) {
      logAiTest("vision", runId, "validation", {
        ok: false,
        reason: "bad_endpoint",
        message: e.message,
      });
      return { ok: false, message: e.message };
    }
    throw e;
  }

  try {
    const u = new URL(endpoint);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      logAiTest("vision", runId, "validation", {
        ok: false,
        reason: "bad_protocol",
        protocol: u.protocol,
      });
      return { ok: false, message: "URL must be http or https." };
    }
  } catch {
    logAiTest("vision", runId, "validation", {
      ok: false,
      reason: "invalid_url",
    });
    return { ok: false, message: "Invalid URL." };
  }

  let visionResolvedModelId: string;
  try {
    visionResolvedModelId = resolveModelId(provider, model);
  } catch (e) {
    if (e instanceof FatalParseError) {
      logAiTest("vision", runId, "validation", {
        ok: false,
        reason: "bad_model",
        message: e.message,
      });
      return { ok: false, message: e.message };
    }
    throw e;
  }

  const forwardProvider = provider === "custom" ? "custom" : "openai";
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const hostedTestPng =
    origin.length > 0 ? `${origin}/api/ai/vision-test-image` : null;

  const prefersHostedFirst =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  const attemptUrls: string[] = [];
  if (hostedTestPng) {
    if (prefersHostedFirst) {
      attemptUrls.push(hostedTestPng, VISION_TEST_IMAGE_DATA_URL);
    } else {
      attemptUrls.push(VISION_TEST_IMAGE_DATA_URL, hostedTestPng);
    }
  } else {
    attemptUrls.push(VISION_TEST_IMAGE_DATA_URL);
  }

  const userPrompt =
    "The user message includes an attached image: a 128×128 pixel square of one solid color. Reply with exactly one English word naming that color (e.g. red). If you truly cannot see any image, reply starting with the exact phrase NO_IMAGE: and briefly why.";

  logAiTest("vision", runId, "start", {
    provider,
    forwardProvider,
    resolvedEndpoint: endpoint,
    modelId: visionResolvedModelId,
    forwardRoute: "POST /api/ai/forward",
    attemptPlan: attemptUrls.map((u) =>
      u.startsWith("data:") ? "data_url_png" : "hosted_same_origin",
    ),
    hostedProbeUrl: hostedTestPng,
    prefersHostedFirst,
    dataUrlLengthChars: VISION_TEST_IMAGE_DATA_URL.length,
    note: "Many gateways strip data: URLs; second attempt uses HTTPS URL on this app so upstream can fetch the PNG.",
  });

  try {
    let lastVisionFailure: TestVisionConnectionResult | null = null;

    for (let i = 0; i < attemptUrls.length; i++) {
      const imageUrl = attemptUrls[i];
      const transport = imageUrl.startsWith("data:") ? "data_url" : "https_hosted";

      logAiTest("vision", runId, "attempt", {
        index: i + 1,
        total: attemptUrls.length,
        transport,
        imageRef:
          transport === "data_url"
            ? { kind: "data_url", lengthChars: imageUrl.length }
            : { kind: "url", href: imageUrl },
      });

      const res = await forwardAiPost({
        provider: forwardProvider,
        targetUrl: endpoint,
        apiKey: key,
        signal,
        body: {
          model: visionResolvedModelId,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                {
                  type: "image_url",
                  image_url: { url: imageUrl },
                },
              ],
            },
          ],
          max_tokens: 32,
          stream: false,
        },
      });
      const errText = await res.text();
      const ms =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        t0;
      logAiTest("vision", runId, "upstream_response", {
        attempt: i + 1,
        transport,
        httpStatus: res.status,
        durationMs: Math.round(ms),
        responseChars: errText.length,
        bodySnippet: truncateForLog(errText, 2500),
      });
      if (res.ok) {
        logAiTest("vision", runId, "parsed_envelope", {
          attempt: i + 1,
          ...summarizeOpenAiSuccessBody(errText),
        });
      }

      if (res.status === 401) {
        logAiTest("vision", runId, "result", { ok: false, reason: "401" });
        return { ok: false, message: "Invalid API key or unauthorized." };
      }
      if (res.status === 429) {
        logAiTest("vision", runId, "result", { ok: false, reason: "429" });
        return { ok: false, message: "Rate limited. Try again shortly." };
      }

      if (!res.ok) {
        const proxyMsg =
          res.status === 502 ? parseProxyForwardErrorBody(errText) : null;
        const msg = proxyMsg ?? describeBadAiResponse(res.status, errText);
        lastVisionFailure = { ok: false, message: msg };
        logAiTest("vision", runId, "attempt_http_error", {
          attempt: i + 1,
          transport,
          willRetry: i < attemptUrls.length - 1,
          message: msg,
        });
        continue;
      }

      let reply: string;
      try {
        reply = readOpenAiChatMessageContent(errText);
      } catch (e) {
        const parseErr =
          e instanceof Error ? e.message : "Could not read model reply.";
        lastVisionFailure = { ok: false, message: parseErr };
        logAiTest("vision", runId, "attempt_parse_error", {
          attempt: i + 1,
          transport,
          willRetry: i < attemptUrls.length - 1,
          message: parseErr,
        });
        continue;
      }

      logAiTest("vision", runId, "assistant_text", {
        attempt: i + 1,
        transport,
        replyChars: reply.length,
        replyFull: truncateForLog(reply, 800),
        noImagePrefix: /^no_image\s*:/i.test(reply.trim()),
        deniesImageHeuristic: visionTestReplyDeniesImage(reply),
      });

      const trimmedReply = reply.trim();
      if (
        /^no_image\s*:/i.test(trimmedReply) ||
        visionTestReplyDeniesImage(reply)
      ) {
        const denialMsg = `Model did not acknowledge the image (${transport}). It said: ${reply.length > 200 ? `${reply.slice(0, 197)}…` : reply}`;
        lastVisionFailure = { ok: false, message: denialMsg };
        logAiTest("vision", runId, "attempt_denied_image", {
          attempt: i + 1,
          transport,
          willRetry: i < attemptUrls.length - 1,
          matchedDenialHeuristic: visionTestReplyDeniesImage(reply),
          matchedNoImagePrefix: /^no_image\s*:/i.test(trimmedReply),
        });
        continue;
      }

      const preview =
        reply.length > 120 ? `${reply.slice(0, 117)}…` : reply;
      logAiTest("vision", runId, "result", {
        ok: true,
        attempt: i + 1,
        transport,
        replyPreview: preview,
        durationMs: Math.round(ms),
      });
      return { ok: true, replyPreview: preview };
    }

    const suffix =
      attemptUrls.length > 1
        ? " If both data: and hosted URLs failed, use a vision-capable model or a router that forwards image_url to the provider."
        : "";
    logAiTest("vision", runId, "result", {
      ok: false,
      reason: "all_attempts_failed",
      attempts: attemptUrls.length,
    });
    return {
      ok: false,
      message: lastVisionFailure
        ? `${lastVisionFailure.message}${suffix}`
        : `Vision test failed.${suffix}`,
    };
  } catch (e) {
    const ms =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      t0;
    if (e instanceof DOMException && e.name === "AbortError") {
      logAiTest("vision", runId, "result", {
        ok: false,
        reason: "aborted",
        durationMs: Math.round(ms),
      });
      return { ok: false, message: "Cancelled." };
    }
    const msg = e instanceof Error ? e.message : "Network error.";
    logAiTest("vision", runId, "result", {
      ok: false,
      reason: "exception",
      durationMs: Math.round(ms),
      errorName: e instanceof Error ? e.name : typeof e,
      message: msg,
    });
    return {
      ok: false,
      message: msg,
    };
  }
}

export function defaultForwardEndpointHint(): string {
  return DEFAULT_OPENAI_CHAT_URL;
}

export function defaultForwardModelPlaceholder(): string {
  return OPENAI_MODEL;
}
