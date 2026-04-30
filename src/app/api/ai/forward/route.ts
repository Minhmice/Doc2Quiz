import { NextResponse } from "next/server";

import { deriveOpenAiModelsListUrlFromChatCompletions } from "@/lib/ai/openAiEndpoint";
import {
  getAiProcessingConfig,
  getChatCompletionsUrl,
  isAiProcessingConfigured,
} from "@/lib/server/ai-processing-config";
import { AI_PROCESSING_UNAVAILABLE_MESSAGE } from "@/lib/ai/processingMessages";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  /** Ignored — routing uses server env. Kept for backward-compatible clients. */
  provider?: unknown;
  body?: unknown;
  /** Default POST. GET sends no JSON body upstream (e.g. OpenAI-compatible `/v1/models`). */
  method?: unknown;
};

const DEFAULT_OPENAI_CHAT_MAX_TOKENS = 16384;

function serializeUpstreamPostBody(
  targetUrl: string,
  body: unknown,
): { serialized: string; bodyKeys: string[] } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    const serialized = JSON.stringify(body ?? {});
    return {
      serialized,
      bodyKeys:
        body && typeof body === "object" && !Array.isArray(body)
          ? Object.keys(body as Record<string, unknown>).slice(0, 20)
          : [],
    };
  }
  let pathname = "";
  try {
    pathname = new URL(targetUrl).pathname;
  } catch {
    return {
      serialized: JSON.stringify(body),
      bodyKeys: Object.keys(body as Record<string, unknown>).slice(0, 20),
    };
  }
  const isChatCompletions =
    pathname.endsWith("/chat/completions") ||
    pathname.endsWith("/v1/chat/completions");
  const o = body as Record<string, unknown>;
  if (
    !isChatCompletions ||
    !Array.isArray(o.messages) ||
    o.max_tokens != null
  ) {
    return {
      serialized: JSON.stringify(body),
      bodyKeys: Object.keys(o).slice(0, 20),
    };
  }
  const merged = { ...o, max_tokens: DEFAULT_OPENAI_CHAT_MAX_TOKENS };
  return {
    serialized: JSON.stringify(merged),
    bodyKeys: Object.keys(merged).slice(0, 20),
  };
}

function isAllowedTargetUrl(href: string): { ok: true; url: URL } | { ok: false } {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ok: false };
  }
  if (url.protocol === "https:") {
    return { ok: true, url };
  }
  if (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    return { ok: true, url };
  }
  return { ok: false };
}

function mergeChatModel(body: unknown, model: string): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return body;
  }
  return { ...(body as Record<string, unknown>), model };
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAiProcessingConfigured()) {
    return NextResponse.json(
      { error: AI_PROCESSING_UNAVAILABLE_MESSAGE },
      { status: 503 },
    );
  }

  let parsed: Body;
  try {
    parsed = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tier = resolveUserAiTier(user);
  let cfg;
  try {
    cfg = getAiProcessingConfig(tier);
  } catch {
    return NextResponse.json(
      { error: AI_PROCESSING_UNAVAILABLE_MESSAGE },
      { status: 503 },
    );
  }

  const chatBase = getChatCompletionsUrl(cfg.url);
  const allowedBase = isAllowedTargetUrl(chatBase);
  if (!allowedBase.ok) {
    return NextResponse.json(
      { error: AI_PROCESSING_UNAVAILABLE_MESSAGE },
      { status: 503 },
    );
  }

  const method = parsed.method === "GET" ? "GET" : "POST";

  let targetUrl = chatBase;
  if (method === "GET") {
    const modelsUrl = deriveOpenAiModelsListUrlFromChatCompletions(chatBase);
    if (!modelsUrl) {
      return NextResponse.json(
        { error: "Models probe is not available for this upstream URL." },
        { status: 400 },
      );
    }
    const allowedModels = isAllowedTargetUrl(modelsUrl);
    if (!allowedModels.ok) {
      return NextResponse.json(
        { error: AI_PROCESSING_UNAVAILABLE_MESSAGE },
        { status: 503 },
      );
    }
    targetUrl = modelsUrl;
  }

  const mergedBody =
    method === "POST"
      ? mergeChatModel(parsed.body ?? {}, cfg.model)
      : parsed.body;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.key}`,
  };

  const upstreamPost =
    method === "POST"
      ? serializeUpstreamPostBody(targetUrl, mergedBody)
      : null;

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  } else {
    headers.Accept = "application/json";
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      targetUrl,
      method === "GET"
        ? { method: "GET", headers }
        : {
            method: "POST",
            headers,
            body: upstreamPost?.serialized ?? JSON.stringify(mergedBody ?? {}),
          },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upstream request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const text = await upstream.text();
  const contentType =
    upstream.headers.get("content-type") ?? "application/json";
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
