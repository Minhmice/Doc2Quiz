import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  aiAgentPingHttpStatus,
  runAiAgentPing,
} from "@/lib/server/ai-agent-ping";
import {
  getAiProcessingConfig,
  isAiProcessingConfigured,
  isDevEnginePanelEnabled,
} from "@/lib/server/ai-processing-config";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

function panelDisabled() {
  return (
    !isDevEnginePanelEnabled() || process.env.NODE_ENV === "production"
  );
}

export async function GET() {
  if (panelDisabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }

  const tier = resolveUserAiTier(auth.user);
  const configured = isAiProcessingConfigured();
  const urlConfigured = Boolean(process.env.AI_PROVIDER_URL?.trim());
  const keyConfigured = Boolean(process.env.AI_PROVIDER_KEY?.trim());

  let resolvedModel = "";
  if (configured) {
    try {
      resolvedModel = getAiProcessingConfig(tier).model;
    } catch {
      resolvedModel = "";
    }
  }

  return NextResponse.json({
    tier,
    resolvedModel,
    urlConfigured,
    keyConfigured,
    configured,
  });
}

export async function POST() {
  if (panelDisabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }

  const tier = resolveUserAiTier(auth.user);
  const result = await runAiAgentPing({ tier });

  return NextResponse.json(
    {
      ...result,
      message: result.ok
        ? `Connection OK${result.latencyMs != null ? ` (${result.latencyMs}ms)` : ""}`
        : result.error ?? "Test failed.",
    },
    { status: aiAgentPingHttpStatus(result) },
  );
}

export const runtime = "nodejs";
export const maxDuration = 30;
