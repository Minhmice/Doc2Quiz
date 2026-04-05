"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Question } from "@/types/question";
import {
  deleteMedia,
  ensureStudySetDb,
  getDraftQuestions,
  putApprovedBankForStudySet,
  putDraftQuestions,
  touchStudySetMeta,
} from "@/lib/db/studySetDb";
import { allMcqsComplete } from "@/lib/review/validateMcq";
import { ReviewList } from "@/components/review/ReviewList";

export type ReviewSectionProps = {
  studySetId: string;
  draftReloadKey?: number;
};

const APPROVE_ERROR = "Some questions are incomplete. Please fix before saving.";

export function ReviewSection({
  studySetId,
  draftReloadKey = 0,
}: ReviewSectionProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initialTotalRef = useRef(0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await ensureStudySetDb();
      const loaded = await getDraftQuestions(studySetId);
      setQuestions(loaded);
      if (loaded.length > 0) {
        initialTotalRef.current = loaded.length;
      }
    } finally {
      setLoading(false);
    }
    setEditingId(null);
    setApproveError(null);
  }, [studySetId]);

  useEffect(() => {
    void reload();
  }, [studySetId, draftReloadKey, reload]);

  const handleEditRequest = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleSaveEdit = useCallback(
    async (_id: string, next: Question) => {
      setQuestions((prev) => {
        const nextList = prev.map((q) => (q.id === next.id ? next : q));
        void putDraftQuestions(studySetId, nextList);
        void touchStudySetMeta(studySetId, {});
        return nextList;
      });
      setEditingId(null);
      setApproveError(null);
    },
    [studySetId],
  );

  const handleSetCorrectIndex = useCallback(
    (qid: string, index: 0 | 1 | 2 | 3) => {
      setApproveError(null);
      setQuestions((prev) => {
        const nextList = prev.map((q) =>
          q.id === qid ? { ...q, correctIndex: index } : q,
        );
        void putDraftQuestions(studySetId, nextList);
        void touchStudySetMeta(studySetId, {});
        return nextList;
      });
    },
    [studySetId],
  );

  const handleDelete = useCallback(
    (qid: string) => {
      setQuestions((prev) => {
        const removed = prev.find((q) => q.id === qid);
        if (removed) {
          void (async () => {
            try {
              if (removed.questionImageId) {
                await deleteMedia(removed.questionImageId);
              }
              const oi = removed.optionImageIds;
              if (oi) {
                for (const mid of oi) {
                  if (mid) {
                    await deleteMedia(mid);
                  }
                }
              }
            } catch {
              /* ignore */
            }
          })();
        }
        const nextList = prev.filter((q) => q.id !== qid);
        void putDraftQuestions(studySetId, nextList);
        void touchStudySetMeta(studySetId, {});
        return nextList;
      });
      setEditingId((e) => (e === qid ? null : e));
      setApproveError(null);
    },
    [studySetId],
  );

  const handleDone = useCallback(async () => {
    setApproveError(null);
    if (questions.length === 0) {
      return;
    }
    if (!allMcqsComplete(questions)) {
      setApproveError(APPROVE_ERROR);
      return;
    }
    const payload = {
      version: 1 as const,
      savedAt: new Date().toISOString(),
      questions,
    };
    try {
      await putApprovedBankForStudySet(studySetId, payload);
      await putDraftQuestions(studySetId, questions);
      await touchStudySetMeta(studySetId, { status: "ready" });
      router.push("/dashboard");
    } catch {
      setApproveError(APPROVE_ERROR);
    }
  }, [questions, studySetId, router]);

  const removed = Math.max(0, initialTotalRef.current - questions.length);
  const approveDisabled = questions.length === 0;

  if (loading) {
    return (
      <p className="text-sm text-[var(--d2q-muted)]" aria-busy="true">
        Loading questions…
      </p>
    );
  }

  return (
    <section aria-labelledby="review-heading">
      <h2
        id="review-heading"
        className="text-lg font-semibold tracking-tight text-[var(--d2q-text)]"
      >
        Review &amp; save
      </h2>
      <p className="mt-1 text-sm text-[var(--d2q-muted)]">
        Edit or remove questions, then press Done to save the bank and return to
        the library.
      </p>

      <p className="mt-4 text-sm font-medium text-[var(--d2q-text)]">
        {questions.length} questions ready — {removed} removed
      </p>

      {approveError ? (
        <p
          className="mt-3 text-sm font-medium text-red-400"
          role="alert"
          aria-live="polite"
        >
          {approveError}
        </p>
      ) : null}

      {questions.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--d2q-muted)]">
          No questions yet. Run{" "}
          <strong className="font-medium text-[var(--d2q-text)]">Parse</strong> on
          the Source tab to generate questions.
        </p>
      ) : (
        <ReviewList
          studySetId={studySetId}
          questions={questions}
          editingId={editingId}
          onEditRequest={handleEditRequest}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={handleSaveEdit}
          onDelete={handleDelete}
          onSetCorrectIndex={handleSetCorrectIndex}
        />
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => void handleDone()}
          disabled={approveDisabled}
          className="cursor-pointer rounded-lg bg-[var(--d2q-accent)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition-colors duration-200 hover:bg-[var(--d2q-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </section>
  );
}
