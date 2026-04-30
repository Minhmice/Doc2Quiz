import { NextResponse } from "next/server";

import {
  getAiProcessingConfig,
  getEmbeddingsUrl,
  getServerEmbeddingModel,
  isAiProcessingConfigured,
} from "@/lib/server/ai-processing-config";
import { AI_PROCESSING_UNAVAILABLE_MESSAGE } from "@/lib/ai/processingMessages";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  /** Ignored — auth uses server env. */
  provider?: unknown;
  /** Partial embeddings body; `model` is always overridden server-side. */
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
 * URL and key come from server env only.
 */
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

  const targetUrl = getEmbeddingsUrl(cfg.url);
  const allowed = isAllowedTargetUrl(targetUrl);
  if (!allowed.ok) {
    return NextResponse.json(
      { error: AI_PROCESSING_UNAVAILABLE_MESSAGE },
      { status: 503 },
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
      { error: "Embeddings URL could not be resolved from AI_PROVIDER_URL." },
      { status: 400 },
    );
  }

  const partial =
    typeof parsed.body === "object" && parsed.body !== null && !Array.isArray(parsed.body)
      ? (parsed.body as Record<string, unknown>)
      : {};

  const embeddingModel = getServerEmbeddingModel();
  const merged = {
    ...partial,
    model: embeddingModel,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.key}`,
  };

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(merged),
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
