"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ensureStudySetDb,
  getApprovedBank,
  getStudySetMeta,
} from "@/lib/db/studySetDb";
import { editQuiz } from "@/lib/routes/studySetPaths";

type QuizSessionRecord = {
  id: string;
  studySetId: string;
  completedAt: string;
  totalQuestions: number;
  correctCount: number;
};

async function getLatestQuizSessionForStudySet(
  studySetId: string,
): Promise<QuizSessionRecord | null> {
  const db = await ensureStudySetDb();
  if (!db.objectStoreNames.contains("quizSessions")) {
    return null;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction("quizSessions", "readonly");
    const store = tx.objectStore("quizSessions");
    const index = store.index("byStudySetId");
    const req = index.getAll(studySetId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rows = (req.result as QuizSessionRecord[]) ?? [];
      if (rows.length === 0) {
        resolve(null);
        return;
      }
      rows.sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );
      resolve(rows[0] ?? null);
    };
  });
}

export default function QuizDonePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const [sourceName, setSourceName] = useState<string | undefined>();
  const [approvedCount, setApprovedCount] = useState(0);
  const [latestScore, setLatestScore] = useState<{
    correct: number;
    total: number;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    setLoadError(null);
    try {
      await ensureStudySetDb();
      const meta = await getStudySetMeta(id);
      if (!meta) {
        setLoadError("Study set not found.");
        return;
      }
      setHeadline(meta.title);
      setSubtitle(meta.subtitle);
      setSourceName(meta.sourceFileName);
      const bank = await getApprovedBank(id);
      setApprovedCount(bank?.questions.length ?? 0);
      const latest = await getLatestQuizSessionForStudySet(id);
      setLatestScore(
        latest ? { correct: latest.correctCount, total: latest.totalQuestions } : null,
      );
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load study set.",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!id) {
    return null;
  }

  if (loadError) {
    return (
      <div>
        <p className="text-red-400">{loadError}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-(--d2q-accent-hover)">
          ← Library
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[var(--d2q-text)] sm:text-3xl">
          Done · {headline || "…"}
        </h1>
        {latestScore ? (
          <p className="text-base font-semibold text-[var(--d2q-text)]">
            Score: {latestScore.correct}/{latestScore.total}
          </p>
        ) : null}
        {subtitle ? (
          <p className="text-sm font-medium text-[var(--d2q-muted)]">
            {subtitle}
          </p>
        ) : null}
        {sourceName ? (
          <p className="text-xs text-[var(--d2q-muted)]">Source: {sourceName}</p>
        ) : null}
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          Study set ready. {approvedCount} approved question
          {approvedCount === 1 ? "" : "s"} saved locally.
        </p>
      </header>

      <div className="rounded-lg border border-[var(--d2q-accent)]/35 bg-[var(--d2q-accent-muted)] p-4 text-sm text-[var(--d2q-text)]">
        <p className="font-medium">
          You can return to Review to edit questions, or open another set from
          the library.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-[var(--d2q-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--d2q-accent-hover)]"
          >
            Library
          </Link>
          <Link
            href={editQuiz(id)}
            className="rounded-lg border border-[var(--d2q-border-strong)] bg-[var(--d2q-surface)] px-4 py-2 text-sm font-semibold text-[var(--d2q-text)] hover:bg-[var(--d2q-surface-elevated)]"
          >
            Review
          </Link>
        </div>
      </div>
    </div>
  );
}
