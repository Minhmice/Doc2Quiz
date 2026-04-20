import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  provider?: unknown;
  targetUrl?: unknown;
  apiKey?: unknown;
  /** OpenAI-compatible: `{ model, input: string }` */
  body?: unknown;
};

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

/**
 * Same-origin proxy for OpenAI-compatible `POST /v1/embeddings`.
 * Keys are never stored server-side (see `/api/ai/forward`).
 */
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

  const pathLower = (() => {
    try {
      return new URL(targetUrl).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (!pathLower.includes("embedding")) {
    return NextResponse.json(
      { error: "targetUrl must be an embeddings endpoint" },
      { status: 400 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (provider === "openai" || provider === "custom") {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(parsed.body ?? {}),
    });
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
