import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  provider?: unknown;
  targetUrl?: unknown;
  apiKey?: unknown;
  body?: unknown;
  /** Default POST. GET sends no JSON body upstream (e.g. OpenAI-compatible `/v1/models`). */
  method?: unknown;
};

const DEFAULT_OPENAI_CHAT_MAX_TOKENS = 16384;

/**
 * OpenAI-compatible `chat/completions` bodies sometimes omit `max_tokens` (older
 * client bundles, alternate call sites). Proxies still wait on huge completions;
 * ensure a cap so upstream + logs reflect the same shape.
 */
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

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: Body;
  try {
    parsed = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const provider = parsed.provider;
  if (
    provider !== "openai" &&
    provider !== "anthropic" &&
    provider !== "custom"
  ) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const targetUrl =
    typeof parsed.targetUrl === "string" ? parsed.targetUrl.trim() : "";
  const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
  if (!targetUrl || !apiKey) {
    return NextResponse.json(
      { error: "targetUrl and apiKey are required" },
      { status: 400 },
    );
  }

  const allowed = isAllowedTargetUrl(targetUrl);
  if (!allowed.ok) {
    return NextResponse.json(
      {
        error:
          "URL must be https, or http://localhost / http://127.0.0.1 for a local proxy",
      },
      { status: 400 },
    );
  }

  const method = parsed.method === "GET" ? "GET" : "POST";
  const headers: Record<string, string> = {};
  const upstreamPost =
    method === "POST"
      ? serializeUpstreamPostBody(targetUrl, parsed.body)
      : null;

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  } else {
    headers.Accept = "application/json";
  }
  if (provider === "openai" || provider === "custom") {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
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
            body: upstreamPost?.serialized ?? JSON.stringify(parsed.body ?? {}),
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
