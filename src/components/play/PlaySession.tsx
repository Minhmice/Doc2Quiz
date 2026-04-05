"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ensureStudySetDb,
  getApprovedBank,
  getMediaBlob,
} from "@/lib/db/studySetDb";
import { isMcqComplete } from "@/lib/review/validateMcq";
import type { Question } from "@/types/question";

const LABELS = ["A", "B", "C", "D"] as const;

function MediaImage({ mediaId }: { mediaId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        await ensureStudySetDb();
        const blob = await getMediaBlob(mediaId);
        if (!blob || revoked) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        if (revoked) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setUrl(objectUrl);
      } catch {
        if (!revoked) {
          setUrl(null);
        }
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mediaId]);

  if (!url) {
    return (
      <span className="text-xs text-[var(--d2q-muted)]">Loading image…</span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- object URL from IndexedDB blob
    <img
      src={url}
      alt=""
      className="mt-1 max-h-48 max-w-full rounded border border-[var(--d2q-border)] object-contain"
    />
  );
}

export type PlaySessionProps = {
  studySetId: string;
};

export function PlaySession({ studySetId }: PlaySessionProps) {
  const [playable, setPlayable] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<0 | 1 | 2 | 3 | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await ensureStudySetDb();
      const bank = await getApprovedBank(studySetId);
      const list = (bank?.questions ?? []).filter(isMcqComplete);
      setPlayable(list);
      setIndex(0);
      setPicked(null);
      setCorrectCount(0);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load question bank.",
      );
      setPlayable([]);
    } finally {
      setLoading(false);
    }
  }, [studySetId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const current = playable[index];
  const finished = playable.length > 0 && index >= playable.length;
  const revealed = picked !== null;

  const goNext = useCallback(() => {
    if (picked === null || current === undefined) {
      return;
    }
    if (picked === current.correctIndex) {
      setCorrectCount((c) => c + 1);
    }
    setPicked(null);
    setIndex((i) => i + 1);
  }, [picked, current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || loading || loadError) {
        return;
      }
      if (!current) {
        return;
      }
      if (!revealed) {
        if (e.key >= "1" && e.key <= "4") {
          e.preventDefault();
          setPicked((Number.parseInt(e.key, 10) - 1) as 0 | 1 | 2 | 3);
        }
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, loading, loadError, current, revealed, goNext]);

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
  };

  if (loading) {
    return (
      <p className="text-sm text-[var(--d2q-muted)]" role="status">
        Loading…
      </p>
    );
  }

  if (loadError) {
    return (
      <p className="text-sm font-medium text-red-400" role="alert">
        {loadError}
      </p>
    );
  }

  if (playable.length === 0) {
    return (
      <div
        className="rounded-lg border border-orange-500/30 bg-orange-950/35 p-4 text-sm text-amber-100"
        role="status"
      >
        <p className="font-medium text-amber-200">No approved questions for a quiz yet.</p>
        <p className="mt-1 text-xs text-amber-100/90">
          Approve complete MCQs on Review first (stem, four options, correct
          answer).
        </p>
        <Link
          href={`/sets/${studySetId}/review`}
          className="mt-3 inline-block font-semibold text-[var(--d2q-accent-hover)] underline"
        >
          Go to Review
        </Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="rounded-xl border border-[var(--d2q-border)] bg-[var(--d2q-surface)] p-6 shadow-lg shadow-black/20">
        <p className="text-lg font-semibold text-[var(--d2q-text)]">Session complete</p>
        <p className="mt-2 text-sm text-[var(--d2q-muted)]">
          You got{" "}
          <span className="font-semibold text-emerald-400">
            {correctCount}
          </span>{" "}
          of <span className="font-semibold text-[var(--d2q-text)]">{playable.length}</span> correct.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={restart}
            className="rounded-lg bg-[var(--d2q-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--d2q-accent-hover)]"
          >
            Take quiz again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--d2q-text)] hover:bg-[var(--d2q-surface)]"
          >
            Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--d2q-border)] bg-[var(--d2q-surface)] p-6 shadow-lg shadow-black/20">
      <p className="text-xs font-medium text-[var(--d2q-muted)]">
        Question {index + 1} of {playable.length}
      </p>
      <p className="mt-3 text-base font-medium leading-snug text-[var(--d2q-text)]">
        {current.question}
      </p>
      {current.questionImageId ? (
        <div className="mt-2">
          <MediaImage mediaId={current.questionImageId} />
        </div>
      ) : null}

      <div
        className="mt-5 flex flex-col gap-2"
        role="group"
        aria-label="Answer choices"
      >
        {current.options.map((opt, idx) => {
          const i = idx as 0 | 1 | 2 | 3;
          const isPicked = picked === i;
          const isCorrect = i === current.correctIndex;
          let rowClass =
            "rounded-lg border px-3 py-2 text-left text-sm transition-colors";
          if (!revealed) {
            rowClass +=
              " border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] hover:bg-[var(--d2q-surface)] text-[var(--d2q-text)]";
          } else if (isCorrect) {
            rowClass +=
              " border-emerald-500/60 bg-emerald-950/40 text-[var(--d2q-text)] ring-1 ring-emerald-500/50";
          } else if (isPicked) {
            rowClass += " border-red-400/50 bg-red-950/40 text-[var(--d2q-text)]";
          } else {
            rowClass += " border-[var(--d2q-border)] bg-[var(--d2q-bg)] text-[var(--d2q-muted)]";
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={revealed}
              onClick={() => setPicked(i)}
              className={`flex w-full cursor-pointer items-start gap-3 ${rowClass} ${revealed ? "cursor-default" : ""}`}
            >
              <span
                className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded text-xs font-bold ${
                  revealed && isCorrect
                    ? "bg-emerald-600 text-white"
                    : revealed && isPicked
                      ? "bg-red-600 text-white"
                      : "bg-[var(--d2q-surface-elevated)] text-[var(--d2q-text)] ring-1 ring-[var(--d2q-border)]"
                }`}
              >
                {LABELS[idx]}
              </span>
              <span className="min-w-0 flex-1 pt-0.5 leading-snug">
                {opt}
                {current.optionImageIds?.[i] ? (
                  <MediaImage mediaId={current.optionImageIds[i]!} />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-[var(--d2q-muted)]">
        Keys <kbd className="rounded bg-[var(--d2q-surface-elevated)] px-1 text-[var(--d2q-text)]">1</kbd>–
        <kbd className="rounded bg-[var(--d2q-surface-elevated)] px-1 text-[var(--d2q-text)]">4</kbd> choose; when
        revealed,{" "}
        <kbd className="rounded bg-[var(--d2q-surface-elevated)] px-1 text-[var(--d2q-text)]">Enter</kbd> continues.
      </p>

      {revealed ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-[var(--d2q-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--d2q-accent-hover)]"
          >
            {index + 1 >= playable.length ? "See results" : "Next"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
