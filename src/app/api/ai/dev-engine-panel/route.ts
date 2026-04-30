import { NextResponse } from "next/server";

import {
  getAiProcessingConfig,
  getChatCompletionsUrl,
  isAiProcessingConfigured,
  isDevEnginePanelEnabled,
  resolveAiModel,
} from "@/lib/server/ai-processing-config";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";
import { deriveOpenAiModelsListUrlFromChatCompletions } from "@/lib/ai/openAiEndpoint";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function denyDevPanel(): NextResponse | null {
  if (process.env.NODE_ENV === "production" || !isDevEnginePanelEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

/**
 * Developer-only: resolved tier/model + configured flags (never raw secrets).
 */
export async function GET() {
  const denied = denyDevPanel();
  if (denied) {
    return denied;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = resolveUserAiTier(user);
  let resolvedModel = "";
  try {
    resolvedModel = resolveAiModel(tier);
  } catch {
    resolvedModel = "";
  }

  const configured = isAiProcessingConfigured();
  return NextResponse.json({
    tier,
    resolvedModel,
    urlConfigured: configured,
    keyConfigured: configured,
  });
}

/**
 * Developer-only: probe upstream using server env (same auth as forward route).
 */
export async function POST() {
  const denied = denyDevPanel();
  if (denied) {
    return denied;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAiProcessingConfigured()) {
    return NextResponse.json({
      ok: false,
      message: "URL or API key not configured on server.",
    });
  }

  const tier = resolveUserAiTier(user);
  let cfg;
  try {
    cfg = getAiProcessingConfig(tier);
  } catch {
    return NextResponse.json({
      ok: false,
      message: "AI processing config invalid.",
    });
  }

  const chatUrl = getChatCompletionsUrl(cfg.url);
  const modelsUrl = deriveOpenAiModelsListUrlFromChatCompletions(chatUrl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.key}`,
    Accept: "application/json",
  };

  try {
    if (modelsUrl) {
      const res = await fetch(modelsUrl, { method: "GET", headers });
      if (res.ok) {
        return NextResponse.json({ ok: true });
      }
      const text = await res.text();
      return NextResponse.json({
        ok: false,
        message: `Upstream ${res.status}: ${text.slice(0, 200)}`,
      });
    }

    const res = await fetch(chatUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
    });
    if (res.ok) {
      return NextResponse.json({ ok: true });
    }
    const text = await res.text();
    return NextResponse.json({
      ok: false,
      message: `Upstream ${res.status}: ${text.slice(0, 200)}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connection failed";
    return NextResponse.json({ ok: false, message });
  }
}
