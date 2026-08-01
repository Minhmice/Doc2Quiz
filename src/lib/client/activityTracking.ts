import { ACTIVITY_STATS_CHANGED_EVENT } from "@/lib/appEvents";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import { createSupabaseBrowserClient } from "@/lib/client/supabase";
import type {
  MistakeSetOverview,
  SmartResumeResult,
  StudyInteractionState,
  StudyMistake,
  StudyMode,
  StudyPractice,
  StudySession,
  StudySessionDraft,
} from "@/types/studySession";
import {
  MAX_STUDY_INTERACTION_ENTRIES,
  MAX_STUDY_SESSION_ITEMS,
} from "@/types/studySession";

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
  dailyAnsweredLast7Days: { date: string; count: number }[];
};

function last7DayBuckets(): { date: string; count: number }[] {
  const dailyAnsweredLast7Days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    dailyAnsweredLast7Days.push({ date: `${y}-${m}-${day}`, count: 0 });
  }
  return dailyAnsweredLast7Days;
}

const emptyStats = (): ActivityStats => ({
  totalQuizSessions: 0,
  questionsAnsweredThisWeek: 0,
  currentStreakDays: 0,
  dailyAnsweredLast7Days: last7DayBuckets(),
});

function dispatchStatsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACTIVITY_STATS_CHANGED_EVENT));
  }
}

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

  const { error: sessErr } = await supabase.from("quiz_sessions").insert({
    id,
    user_id: user.id,
    study_set_id: input.studySetId,
    completed_at: completedAt,
    total_questions: input.totalQuestions,
    correct_count: input.correctCount,
  });
  if (sessErr) {
    if (process.env.NODE_ENV !== "production") {
      console.error("recordQuizCompletion: quiz_sessions insert failed", sessErr);
    }
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
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "recordQuizCompletion: study_wrong_history upsert failed",
          whErr,
        );
      }
      return;
    }
  } else {
    await supabase
      .from("study_wrong_history")
      .delete()
      .eq("user_id", user.id)
      .eq("study_set_id", input.studySetId);
  }

  await supabase.rpc("record_learning_streak", {
    p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  dispatchStatsChanged();
}

export async function getLatestQuizSession(
  studySetId: string,
): Promise<{ correct: number; total: number; completedAt: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id,study_set_id,completed_at,total_questions,correct_count")
    .eq("user_id", user.id)
    .eq("study_set_id", studySetId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    completed_at: string;
    total_questions: number;
    correct_count: number;
  };

  return {
    correct: row.correct_count,
    total: row.total_questions,
    completedAt: row.completed_at,
  };
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

export async function hasMistakesForStudySet(
  studySetId: string,
): Promise<boolean> {
  const ids = await getMistakeQuestionIds(studySetId);
  return ids.length > 0;
}

export async function getActivityStats(): Promise<ActivityStats> {
  return emptyStats();
}

const SESSION_COLUMNS =
  "id,user_id,study_set_id,mode,practice,item_ids,current_item_id,next_item_id,interaction_state,revision,started_at,updated_at,completed_at";
const MISTAKE_COLUMNS =
  "user_id,study_set_id,item_id,mode,unresolved,mistake_count,first_mistake_at,last_mistake_at,last_practiced_at,resolved_at";

type SessionRow = {
  id: string; user_id: string; study_set_id: string; mode: StudyMode;
  practice: StudyPractice; item_ids: string[]; current_item_id: string | null;
  next_item_id: string | null; interaction_state: StudyInteractionState;
  revision: number; started_at: string; updated_at: string; completed_at: string | null;
};

type MistakeRow = {
  user_id: string; study_set_id: string; item_id: string; mode: StudyMode;
  unresolved: boolean; mistake_count: number; first_mistake_at: string;
  last_mistake_at: string; last_practiced_at: string; resolved_at: string | null;
};

function mapSession(row: SessionRow): StudySession {
  return { id: row.id, ownerId: row.user_id, studySetId: row.study_set_id,
    mode: row.mode, practice: row.practice, itemIds: row.item_ids,
    currentItemId: row.current_item_id, nextItemId: row.next_item_id,
    interaction: row.interaction_state, revision: row.revision,
    startedAt: row.started_at, updatedAt: row.updated_at, completedAt: row.completed_at };
}

function mapMistake(row: MistakeRow): StudyMistake {
  return { ownerId: row.user_id, studySetId: row.study_set_id, itemId: row.item_id,
    mode: row.mode, unresolved: row.unresolved, mistakeCount: row.mistake_count,
    firstMistakeAt: row.first_mistake_at, lastMistakeAt: row.last_mistake_at,
    lastPracticedAt: row.last_practiced_at, resolvedAt: row.resolved_at };
}

function assertBoundedDraft(draft: StudySessionDraft): void {
  const interactionCount = draft.interaction.mode === "quiz"
    ? Object.keys(draft.interaction.answers).length
    : Object.keys(draft.interaction.cards).length;
  if (draft.itemIds.length === 0 || draft.itemIds.length > MAX_STUDY_SESSION_ITEMS ||
      interactionCount > MAX_STUDY_INTERACTION_ENTRIES) {
    throw new Error("Study session payload exceeds supported bounds");
  }
  if (draft.interaction.mode !== draft.mode) throw new Error("Interaction mode mismatch");
}

async function authenticatedUserId(): Promise<string | null> {
  const { data: { user }, error } = await createSupabaseBrowserClient().auth.getUser();
  return error || !user ? null : user.id;
}

export async function startStudySession(draft: StudySessionDraft): Promise<StudySession | null> {
  assertBoundedDraft(draft);
  const supabase = createSupabaseBrowserClient();
  const userId = await authenticatedUserId();
  if (!userId) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("study_sessions").insert({
    id: createRandomUuid(), user_id: userId, study_set_id: draft.studySetId,
    mode: draft.mode, practice: draft.practice, item_ids: [...new Set(draft.itemIds)],
    current_item_id: draft.currentItemId, next_item_id: draft.nextItemId,
    interaction_state: draft.interaction, revision: 0, started_at: now, updated_at: now,
  }).select(SESSION_COLUMNS).single();
  return error || !data ? null : mapSession(data as SessionRow);
}

export async function saveStudySession(
  session: StudySession,
  patch: Pick<StudySessionDraft, "currentItemId" | "nextItemId" | "interaction">,
): Promise<{ status: "saved" | "stale"; session: StudySession | null }> {
  assertBoundedDraft({ ...session, ...patch });
  const supabase = createSupabaseBrowserClient();
  const userId = await authenticatedUserId();
  if (!userId || userId !== session.ownerId) return { status: "stale", session: null };
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase.from("study_sessions").update({
    current_item_id: patch.currentItemId, next_item_id: patch.nextItemId,
    interaction_state: patch.interaction, revision: session.revision + 1, updated_at: updatedAt,
  }).eq("id", session.id).eq("user_id", userId).eq("revision", session.revision)
    .eq("updated_at", session.updatedAt).is("completed_at", null)
    .select(SESSION_COLUMNS).maybeSingle();
  if (!error && data) return { status: "saved", session: mapSession(data as SessionRow) };
  const fresh = await getStudySession(session.id);
  return { status: "stale", session: fresh };
}

export async function completeStudySession(session: StudySession): Promise<StudySession | null> {
  const supabase = createSupabaseBrowserClient();
  const userId = await authenticatedUserId();
  if (!userId || userId !== session.ownerId || session.nextItemId !== null) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("study_sessions").update({
    completed_at: now, updated_at: now, revision: session.revision + 1,
  }).eq("id", session.id).eq("user_id", userId).eq("revision", session.revision)
    .eq("updated_at", session.updatedAt).is("completed_at", null)
    .select(SESSION_COLUMNS).maybeSingle();
  return error || !data ? null : mapSession(data as SessionRow);
}

export async function getStudySession(sessionId: string): Promise<StudySession | null> {
  const supabase = createSupabaseBrowserClient();
  const userId = await authenticatedUserId();
  if (!userId) return null;
  const { data, error } = await supabase.from("study_sessions").select(SESSION_COLUMNS)
    .eq("id", sessionId).eq("user_id", userId).maybeSingle();
  return error || !data ? null : mapSession(data as SessionRow);
}

export function reconcileStudySession(session: StudySession, availableItemIds: string[]): StudySession {
  const available = new Set(availableItemIds);
  const surviving = session.itemIds.filter((id) => available.has(id));
  const persisted = new Set(surviving);
  const appended = availableItemIds.filter((id) => !persisted.has(id)).sort();
  const itemIds = [...surviving, ...appended];
  const currentItemId = session.currentItemId && available.has(session.currentItemId)
    ? session.currentItemId
    : session.nextItemId && available.has(session.nextItemId)
      ? session.nextItemId : itemIds[0] ?? null;
  const nextItemId = session.nextItemId && available.has(session.nextItemId)
    ? session.nextItemId : itemIds.find((id) => id !== currentItemId) ?? null;
  return { ...session, itemIds, currentItemId, nextItemId };
}

export async function listUnfinishedStudySessions(): Promise<StudySession[]> {
  const supabase = createSupabaseBrowserClient();
  const userId = await authenticatedUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from("study_sessions").select(SESSION_COLUMNS)
    .eq("user_id", userId).is("completed_at", null).order("updated_at", { ascending: false });
  return error || !data ? [] : (data as SessionRow[]).map(mapSession);
}

export async function selectSmartResume(
  recent?: { studySetId: string; mode: StudyMode } | null,
): Promise<SmartResumeResult> {
  const sessions = await listUnfinishedStudySessions();
  if (sessions.length === 1) return { kind: "session", session: sessions[0] };
  if (sessions.length > 1) return { kind: "picker", sessions };
  return recent ? { kind: "recent", ...recent } : { kind: "empty" };
}

export function installStudySessionFinalFlush(flush: () => void | Promise<void>): () => void {
  const run = () => { void flush(); };
  const visibility = () => { if (document.visibilityState === "hidden") run(); };
  window.addEventListener("pagehide", run);
  document.addEventListener("visibilitychange", visibility);
  return () => { window.removeEventListener("pagehide", run); document.removeEventListener("visibilitychange", visibility); };
}

export async function incrementStudyMistake(input: {
  studySetId: string; itemId: string; mode: StudyMode; practicedAt?: string;
}): Promise<StudyMistake | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("record_study_mistake", {
    target_set_id: input.studySetId, target_item_id: input.itemId,
    target_mode: input.mode, practiced_at: input.practicedAt ?? new Date().toISOString(),
  });
  return error || !data ? null : mapMistake(data as MistakeRow);
}

export async function resolveStudyMistake(input: {
  studySetId: string; itemId: string; mode: StudyMode; practicedAt?: string;
}): Promise<StudyMistake | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("resolve_study_mistake", {
    target_set_id: input.studySetId, target_item_id: input.itemId,
    target_mode: input.mode, practiced_at: input.practicedAt ?? new Date().toISOString(),
  });
  return error || !data ? null : mapMistake(data as MistakeRow);
}

export async function listUnresolvedMistakeSets(): Promise<MistakeSetOverview[]> {
  const supabase = createSupabaseBrowserClient();
  const userId = await authenticatedUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from("study_mistakes").select(MISTAKE_COLUMNS)
    .eq("user_id", userId).eq("unresolved", true);
  if (error || !data) return [];
  const grouped = new Map<string, MistakeSetOverview>();
  for (const row of data as MistakeRow[]) {
    const key = `${row.study_set_id}:${row.mode}`;
    const current = grouped.get(key);
    grouped.set(key, { studySetId: row.study_set_id, mode: row.mode,
      mistakeCount: (current?.mistakeCount ?? 0) + row.mistake_count,
      lastPracticedAt: current && current.lastPracticedAt > row.last_practiced_at
        ? current.lastPracticedAt : row.last_practiced_at });
  }
  return [...grouped.values()].sort((a, b) =>
    b.mistakeCount - a.mistakeCount || b.lastPracticedAt.localeCompare(a.lastPracticedAt));
}
