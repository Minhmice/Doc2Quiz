import { ACTIVITY_STATS_CHANGED_EVENT } from "@/lib/appEvents";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type QuizSessionRecord = {
  id: string;
  studySetId: string;
  completedAt: string;
  totalQuestions: number;
  correctCount: number;
};

export type StudyWrongHistoryRecord = {
  studySetId: string;
  questionIds: string[];
  updatedAt: string;
};

export type ActivityStats = {
  totalQuizSessions: number;
  questionsAnsweredThisWeek: number;
  currentStreakDays: number;
  /** Local calendar dates YYYY-MM-DD, last 7 days including today */
  dailyAnsweredLast7Days: { date: string; count: number }[];
};

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

function computeStreak(sessionDays: Set<string>): number {
  if (sessionDays.size === 0) {
    return 0;
  }
  const today = localDateKey(new Date());
  const d = new Date();
  if (!sessionDays.has(today)) {
    d.setDate(d.getDate() - 1);
  }
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const key = localDateKey(d);
    if (sessionDays.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function dispatchStatsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACTIVITY_STATS_CHANGED_EVENT));
  }
}

/**
 * Persist a completed quiz session and the last wrong-question ids for review.
 */
export async function recordQuizCompletion(input: {
  studySetId: string;
  totalQuestions: number;
  correctCount: number;
  wrongQuestionIds: string[];
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return;
  }

  const id = createRandomUuid();
  const completedAt = new Date().toISOString();
  const session: QuizSessionRecord = {
    id,
    studySetId: input.studySetId,
    completedAt,
    totalQuestions: input.totalQuestions,
    correctCount: input.correctCount,
  };

  const { error: sessErr } = await supabase.from("quiz_sessions").insert({
    id: session.id,
    user_id: user.id,
    study_set_id: session.studySetId,
    completed_at: session.completedAt,
    total_questions: session.totalQuestions,
    correct_count: session.correctCount,
  });
  if (sessErr) {
    return;
  }

  if (input.wrongQuestionIds.length > 0) {
    const { error: whErr } = await supabase.from("study_wrong_history").upsert(
      {
        user_id: user.id,
        study_set_id: input.studySetId,
        question_ids: [...new Set(input.wrongQuestionIds)],
        updated_at: completedAt,
      },
      { onConflict: "user_id,study_set_id" },
    );
    if (whErr) {
      return;
    }
  } else {
    await supabase
      .from("study_wrong_history")
      .delete()
      .eq("user_id", user.id)
      .eq("study_set_id", input.studySetId);
  }
  dispatchStatsChanged();
}

export async function getMistakeQuestionIds(
  studySetId: string,
): Promise<string[]> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }
  const { data, error } = await supabase
    .from("study_wrong_history")
    .select("question_ids")
    .eq("user_id", user.id)
    .eq("study_set_id", studySetId)
    .maybeSingle();
  if (error || !data) {
    return [];
  }
  const ids = (data as { question_ids: string[] | null }).question_ids;
  return Array.isArray(ids) ? ids : [];
}

export async function hasMistakesForStudySet(studySetId: string): Promise<boolean> {
  const ids = await getMistakeQuestionIds(studySetId);
  return ids.length > 0;
}

function last7DayBuckets(): { date: string; count: number }[] {
  const dailyAnsweredLast7Days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    dailyAnsweredLast7Days.push({ date: key, count: 0 });
  }
  return dailyAnsweredLast7Days;
}

/**
 * Aggregate stats for the dashboard widget.
 */
export async function getActivityStats(): Promise<ActivityStats> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      totalQuizSessions: 0,
      questionsAnsweredThisWeek: 0,
      currentStreakDays: 0,
      dailyAnsweredLast7Days: last7DayBuckets(),
    };
  }

  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id,study_set_id,completed_at,total_questions,correct_count")
    .eq("user_id", user.id);
  if (error || !data) {
    return {
      totalQuizSessions: 0,
      questionsAnsweredThisWeek: 0,
      currentStreakDays: 0,
      dailyAnsweredLast7Days: last7DayBuckets(),
    };
  }

  const sessions: QuizSessionRecord[] = (data as {
    id: string;
    study_set_id: string;
    completed_at: string;
    total_questions: number;
    correct_count: number;
  }[]).map((r) => ({
    id: r.id,
    studySetId: r.study_set_id,
    completedAt: r.completed_at,
    totalQuestions: r.total_questions,
    correctCount: r.correct_count,
  }));
  const totalQuizSessions = sessions.length;

  const weekStart = startOfWeekMonday(new Date());
  let questionsThisWeek = 0;
  for (const s of sessions) {
    const t = new Date(s.completedAt).getTime();
    if (!Number.isFinite(t)) {
      continue;
    }
    if (t >= weekStart.getTime()) {
      questionsThisWeek += s.totalQuestions;
    }
  }

  const sessionDays = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.completedAt);
    if (Number.isFinite(d.getTime())) {
      sessionDays.add(localDateKey(d));
    }
  }
  const currentStreakDays = computeStreak(sessionDays);

  const dailyAnsweredLast7Days = last7DayBuckets();
  const dayIndex = new Map(dailyAnsweredLast7Days.map((x, i) => [x.date, i]));
  for (const s of sessions) {
    const d = new Date(s.completedAt);
    if (!Number.isFinite(d.getTime())) {
      continue;
    }
    const key = localDateKey(d);
    const idx = dayIndex.get(key);
    if (idx !== undefined) {
      dailyAnsweredLast7Days[idx]!.count += s.totalQuestions;
    }
  }

  return {
    totalQuizSessions,
    questionsAnsweredThisWeek: questionsThisWeek,
    currentStreakDays,
    dailyAnsweredLast7Days,
  };
}
