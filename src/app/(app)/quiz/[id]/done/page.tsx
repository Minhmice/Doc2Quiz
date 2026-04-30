"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  getApprovedBank,
  getStudySetMeta,
} from "@/lib/db/studySetDb";
import { useStudySetProductSurfaceRedirect } from "@/hooks/useStudySetProductSurfaceRedirect";
import { editQuiz } from "@/lib/routes/studySetPaths";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
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
    id: string;
    study_set_id: string;
    completed_at: string;
    total_questions: number;
    correct_count: number;
  };
  return {
    id: row.id,
    studySetId: row.study_set_id,
    completedAt: row.completed_at,
    totalQuestions: row.total_questions,
    correctCount: row.correct_count,
  };
}

export default function QuizDonePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const routeReady = useStudySetProductSurfaceRedirect(
    id || undefined,
    "done-quiz",
  );

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
    if (!id || !routeReady) {
      return;
    }
    setLoadError(null);
    try {
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
  }, [id, routeReady]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!id) {
    return null;
  }

  if (!routeReady) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading…
      </p>
    );
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
          Study set ready. {approvedCount} approved item
          {approvedCount === 1 ? "" : "s"} saved to your account.
        </p>
      </header>

      <div className="rounded-lg border border-[var(--d2q-accent)]/35 bg-[var(--d2q-accent-muted)] p-4 text-sm text-[var(--d2q-text)]">
        <p className="font-medium">
          You can return to Review to edit content, or open another set from the
          library.
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
