import { ACTIVITY_STATS_CHANGED_EVENT } from "@/lib/appEvents";
import { ensureStudySetDb } from "@/lib/db/studySetDb";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";

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

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IDB transaction aborted"));
  });
}

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
  const db = await ensureStudySetDb();
  if (!db.objectStoreNames.contains("quizSessions")) {
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

  const stores: string[] = ["quizSessions"];
  if (db.objectStoreNames.contains("studyWrongHistory")) {
    stores.push("studyWrongHistory");
  }
  const tx = db.transaction(stores, "readwrite");
  tx.objectStore("quizSessions").put(session);
  if (db.objectStoreNames.contains("studyWrongHistory")) {
    if (input.wrongQuestionIds.length > 0) {
      const row: StudyWrongHistoryRecord = {
        studySetId: input.studySetId,
        questionIds: [...new Set(input.wrongQuestionIds)],
        updatedAt: completedAt,
      };
      tx.objectStore("studyWrongHistory").put(row);
    } else {
      tx.objectStore("studyWrongHistory").delete(input.studySetId);
    }
  }
  await txDone(tx);
  dispatchStatsChanged();
}

export async function getMistakeQuestionIds(
  studySetId: string,
): Promise<string[]> {
  const db = await ensureStudySetDb();
  if (!db.objectStoreNames.contains("studyWrongHistory")) {
    return [];
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction("studyWrongHistory", "readonly");
    const req = tx.objectStore("studyWrongHistory").get(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as StudyWrongHistoryRecord | undefined;
      resolve(Array.isArray(row?.questionIds) ? row.questionIds : []);
    };
  });
}

export async function hasMistakesForStudySet(studySetId: string): Promise<boolean> {
  const ids = await getMistakeQuestionIds(studySetId);
  return ids.length > 0;
}

async function getAllQuizSessions(db: IDBDatabase): Promise<QuizSessionRecord[]> {
  if (!db.objectStoreNames.contains("quizSessions")) {
    return [];
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction("quizSessions", "readonly");
    const req = tx.objectStore("quizSessions").getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () =>
      resolve((req.result as QuizSessionRecord[]) ?? []);
  });
}

/**
 * Aggregate stats for the dashboard widget.
 */
export async function getActivityStats(): Promise<ActivityStats> {
  const db = await ensureStudySetDb();
  const sessions = await getAllQuizSessions(db);
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

  const dailyAnsweredLast7Days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    dailyAnsweredLast7Days.push({ date: key, count: 0 });
  }
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
