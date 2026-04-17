"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ActivityStats } from "@/lib/sets/activityTracking";

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function computeStreak(answerDays: Set<string>): number {
  if (answerDays.size === 0) {
    return 0;
  }
  const today = localDateKey(new Date());
  const d = new Date();
  if (!answerDays.has(today)) {
    d.setDate(d.getDate() - 1);
  }
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const key = localDateKey(d);
    if (answerDays.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export async function getCloudActivityStats(): Promise<ActivityStats> {
  const supabase = createSupabaseBrowserClient();

  const weekStart = startOfWeekMonday(new Date());
  const cutoffIso = new Date(
    Date.now() - 1000 * 60 * 60 * 24 * 32,
  ).toISOString();

  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("ended_at, settings")
    .gte("ended_at", cutoffIso)
    .order("ended_at", { ascending: false });

  if (error) throw error;

  const sessions = (data ?? []) as {
    ended_at: string | null;
    settings: unknown;
  }[];
  const totalQuizSessions = sessions.length;

  let questionsAnsweredThisWeek = 0;
  const answerDays = new Set<string>();

  const dailyAnsweredLast7Days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    dailyAnsweredLast7Days.push({ date: key, count: 0 });
  }
  const dayIndex = new Map(dailyAnsweredLast7Days.map((x, i) => [x.date, i]));

  for (const s of sessions) {
    const endedAt = s.ended_at ? new Date(s.ended_at) : null;
    if (!endedAt || !Number.isFinite(endedAt.getTime())) continue;

    const totalQuestions =
      s.settings && typeof s.settings === "object"
        ? Number((s.settings as { totalQuestions?: unknown }).totalQuestions ?? 0)
        : 0;
    const q = Number.isFinite(totalQuestions) ? Math.max(0, totalQuestions) : 0;

    if (endedAt.getTime() >= weekStart.getTime()) {
      questionsAnsweredThisWeek += q;
    }
    const key = localDateKey(endedAt);
    answerDays.add(key);

    const idx = dayIndex.get(key);
    if (idx !== undefined) {
      dailyAnsweredLast7Days[idx]!.count += q;
    }
  }

  const currentStreakDays = computeStreak(answerDays);

  return {
    totalQuizSessions,
    questionsAnsweredThisWeek,
    currentStreakDays,
    dailyAnsweredLast7Days,
  };
}

export async function hasCloudMistakesForStudySet(studySetId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("wrong_history")
    .select(
      `
        id,
        approved_questions!inner (
          study_set_id
        )
      `,
    )
    .eq("approved_questions.study_set_id", studySetId)
    .limit(1);

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}

