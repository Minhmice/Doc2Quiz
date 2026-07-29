import type { User } from "@supabase/supabase-js";

import type { UserAiTier } from "@/lib/server/ai-processing-config";

/**
 * Resolves subscription-style tier for server-side model routing.
 * Extend with billing tables or JWT claims when available.
 */
export function resolveUserAiTier(user: User): UserAiTier {
  const allow = trimCsv(process.env.AI_PRO_USER_IDS);
  if (allow.length > 0 && allow.includes(user.id)) {
    return "pro";
  }

  const meta = user.app_metadata as Record<string, unknown> | undefined;
  if (meta) {
    if (meta.doc2quiz_ai_tier === "pro") {
      return "pro";
    }
    if (meta.role === "admin") {
      return "pro";
    }
  }

  const umeta = user.user_metadata as Record<string, unknown> | undefined;
  if (umeta?.doc2quiz_ai_tier === "pro") {
    return "pro";
  }

  return "free";
}

function trimCsv(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
