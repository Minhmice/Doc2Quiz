import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  aiAgentPingHttpStatus,
  runAiAgentPing,
} from "@/lib/server/ai-agent-ping";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }

  const tier = resolveUserAiTier(auth.user);
  const result = await runAiAgentPing({ tier });
  return NextResponse.json(result, { status: aiAgentPingHttpStatus(result) });
}

export const runtime = "nodejs";
export const maxDuration = 30;
