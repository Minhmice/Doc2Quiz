import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/requireApiUser";
import type { LearningStreak } from "@/lib/streak";

function timezone(request: Request): string | null {
  const value = request.headers.get("x-timezone");
  return value && value.length <= 64 ? value : null;
}

function mapStreak(row: Record<string, unknown> | null): LearningStreak {
  return {
    currentStreak: Number(row?.current_streak ?? 0),
    lostStreak: Number(row?.lost_streak ?? 0),
    lostAt: typeof row?.lost_at === "string" ? row.lost_at : null,
    recoveryStartedAt: typeof row?.recovery_started_at === "string" ? row.recovery_started_at : null,
    recoveryQuizCount: Number(row?.recovery_quiz_count ?? 0),
    recoveriesThisMonth: Number(row?.recoveries_this_month ?? 0),
  };
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const clientTimezone = timezone(request);
  if (!clientTimezone) return NextResponse.json({ error: "invalid_timezone" }, { status: 400 });
  const { data, error } = await auth.supabase.rpc("get_learning_streak", { p_timezone: clientTimezone });
  if (error) return NextResponse.json({ error: "streak_unavailable" }, { status: 500 });
  return NextResponse.json({ data: mapStreak(data) });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const clientTimezone = timezone(request);
  if (!clientTimezone) return NextResponse.json({ error: "invalid_timezone" }, { status: 400 });
  const { data, error } = await auth.supabase.rpc("start_learning_streak_recovery", { p_timezone: clientTimezone });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: mapStreak(data) });
}

export const runtime = "nodejs";
