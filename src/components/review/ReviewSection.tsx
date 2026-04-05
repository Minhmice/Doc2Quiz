"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApprovedBank, Question } from "@/types/question";
import { loadApprovedBank, saveApprovedBank } from "@/lib/review/approvedBank";
import {
  loadDraftQuestions,
  persistDraftQuestions,
} from "@/lib/review/draftQuestions";
import { allMcqsComplete } from "@/lib/review/validateMcq";
import { ReviewList } from "@/components/review/ReviewList";

export type ReviewSectionProps = {
  draftReloadKey?: number;
  onBeginPractice?: () => void;
};

const APPROVE_ERROR = "Some questions are incomplete. Please fix before saving.";
const PRACTICE_LINE = "Practice mode will be available in the next step.";

export function ReviewSection({
  draftReloadKey = 0,
  onBeginPractice,
}: ReviewSectionProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [bank, setBank] = useState<ApprovedBank | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const initialTotalRef = useRef(0);

  useEffect(() => {
    setBank(loadApprovedBank());
  }, []);

  useEffect(() => {
    const loaded = loadDraftQuestions();
    setQuestions(loaded);
    if (loaded.length > 0) {
      initialTotalRef.current = loaded.length;
    }
    setEditingId(null);
    setApproved(false);
    setApproveError(null);
  }, [draftReloadKey]);

  const handleEditRequest = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleSaveEdit = useCallback((_id: string, next: Question) => {
    setApproved(false);
    setQuestions((prev) => {
      const nextList = prev.map((q) => (q.id === next.id ? next : q));
      persistDraftQuestions(nextList);
      return nextList;
    });
    setEditingId(null);
    setApproveError(null);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setApproved(false);
    setQuestions((prev) => {
      const nextList = prev.filter((q) => q.id !== id);
      persistDraftQuestions(nextList);
      return nextList;
    });
    setEditingId((e) => (e === id ? null : e));
    setApproveError(null);
  }, []);

  const handleApprove = useCallback(() => {
    setApproveError(null);
    if (questions.length === 0) {
      return;
    }
    if (!allMcqsComplete(questions)) {
      setApproveError(APPROVE_ERROR);
      return;
    }
    const ok = saveApprovedBank(questions);
    if (!ok) {
      setApproveError(APPROVE_ERROR);
      return;
    }
    persistDraftQuestions(questions);
    setApproved(true);
    setBank(loadApprovedBank());
  }, [questions]);

  const removed = Math.max(0, initialTotalRef.current - questions.length);
  const approveDisabled = questions.length === 0;
  const canPractice = Boolean(bank?.questions?.length);

  return (
    <section
      className="mt-10 border-t border-neutral-200 pt-10"
      aria-labelledby="review-heading"
    >
      <h2
        id="review-heading"
        className="text-lg font-semibold tracking-tight text-neutral-900"
      >
        Review &amp; save
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Edit or remove questions, then approve to save your question bank
        locally.
      </p>

      <p className="mt-4 text-sm font-medium text-neutral-800">
        {questions.length} questions ready — {removed} removed
      </p>

      {approveError ? (
        <p
          className="mt-3 text-sm font-medium text-red-800"
          role="alert"
          aria-live="polite"
        >
          {approveError}
        </p>
      ) : null}

      {questions.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          No questions yet. Parse questions in the section above to review them
          here.
        </p>
      ) : (
        <ReviewList
          questions={questions}
          editingId={editingId}
          onEditRequest={handleEditRequest}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={handleSaveEdit}
          onDelete={handleDelete}
        />
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={handleApprove}
          disabled={approveDisabled}
          className="cursor-pointer rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Approve &amp; save
        </button>
        <button
          type="button"
          disabled={!canPractice}
          title={
            canPractice ? undefined : "Approve and save questions first."
          }
          onClick={() => onBeginPractice?.()}
          className={
            canPractice
              ? "cursor-pointer rounded-lg border border-teal-600 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 shadow-sm transition-colors duration-200 hover:bg-teal-100"
              : "cursor-not-allowed rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-400"
          }
        >
          Start practice
        </button>
      </div>

      {approved ? (
        <div
          className="mt-6 rounded-lg border border-teal-200 bg-teal-50/80 p-4 text-sm text-teal-950"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">✅ Questions saved successfully</p>
          <p className="mt-2">{PRACTICE_LINE}</p>
          {bank ? (
            <p className="mt-1 text-xs text-teal-900/80">
              Saved at {bank.savedAt}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
