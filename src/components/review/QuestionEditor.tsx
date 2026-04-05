"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteMedia, putMediaBlob } from "@/lib/db/studySetDb";
import type { Question } from "@/types/question";
import { StoredImage } from "@/components/media/StoredImage";

const MAX_IMAGE_BYTES = 1_500_000;

export type QuestionEditorProps = {
  studySetId: string;
  question: Question;
  onSave: (q: Question) => void | Promise<void>;
  onCancel: () => void;
};

export function QuestionEditor({
  studySetId,
  question,
  onSave,
  onCancel,
}: QuestionEditorProps) {
  const [stem, setStem] = useState(question.question);
  const [opt0, setOpt0] = useState(question.options[0]);
  const [opt1, setOpt1] = useState(question.options[1]);
  const [opt2, setOpt2] = useState(question.options[2]);
  const [opt3, setOpt3] = useState(question.options[3]);
  const [correctIndex, setCorrectIndex] = useState<0 | 1 | 2 | 3>(
    question.correctIndex,
  );
  const [questionImageId, setQuestionImageId] = useState<
    string | undefined
  >(question.questionImageId);
  const [optionImageIds, setOptionImageIds] = useState<
    [string | undefined, string | undefined, string | undefined, string | undefined]
  >(question.optionImageIds ?? [undefined, undefined, undefined, undefined]);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    setStem(question.question);
    setOpt0(question.options[0]);
    setOpt1(question.options[1]);
    setOpt2(question.options[2]);
    setOpt3(question.options[3]);
    setCorrectIndex(question.correctIndex);
    setQuestionImageId(question.questionImageId);
    setOptionImageIds(
      question.optionImageIds ?? [
        undefined,
        undefined,
        undefined,
        undefined,
      ],
    );
    setImageError(null);
  }, [question]);

  const inputClass =
    "mt-1 w-full rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-bg)] px-3 py-2 text-sm text-[var(--d2q-text)] shadow-sm focus:border-[var(--d2q-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--d2q-accent)]/30";

  const pickImage = useCallback(
    async (file: File | undefined) => {
      setImageError(null);
      if (!file) {
        return;
      }
      if (!file.type.startsWith("image/")) {
        setImageError("Choose an image file (PNG, JPEG, WebP, …).");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError(
          `Image too large (max ${Math.round(MAX_IMAGE_BYTES / 1024)} KB).`,
        );
        return;
      }
      return putMediaBlob(studySetId, file);
    },
    [studySetId],
  );

  const handleQuestionImage = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const id = await pickImage(file);
      if (!id) {
        return;
      }
      if (questionImageId) {
        await deleteMedia(questionImageId);
      }
      setQuestionImageId(id);
    },
    [pickImage, questionImageId],
  );

  const clearQuestionImage = useCallback(async () => {
    if (questionImageId) {
      await deleteMedia(questionImageId);
    }
    setQuestionImageId(undefined);
  }, [questionImageId]);

  const handleOptionImage = useCallback(
    async (index: 0 | 1 | 2 | 3, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const id = await pickImage(file);
      if (!id) {
        return;
      }
      const prev = optionImageIds[index];
      if (prev) {
        await deleteMedia(prev);
      }
      setOptionImageIds((o) => {
        const next = [...o] as typeof o;
        next[index] = id;
        return next;
      });
    },
    [pickImage, optionImageIds],
  );

  const clearOptionImage = useCallback(
    async (index: 0 | 1 | 2 | 3) => {
      const prev = optionImageIds[index];
      if (prev) {
        await deleteMedia(prev);
      }
      setOptionImageIds((o) => {
        const next = [...o] as typeof o;
        next[index] = undefined;
        return next;
      });
    },
    [optionImageIds],
  );

  const handleSave = () => {
    const base: Question = {
      id: question.id,
      question: stem,
      options: [opt0, opt1, opt2, opt3] as Question["options"],
      correctIndex,
    };
    if (questionImageId) {
      base.questionImageId = questionImageId;
    }
    if (optionImageIds.some(Boolean)) {
      base.optionImageIds = optionImageIds;
    }
    void onSave(base);
  };

  const groupName = `correct-${question.id}`;

  return (
    <div className="mt-4 space-y-4 border-t border-[var(--d2q-border)] pt-4">
      {imageError ? (
        <p className="text-sm font-medium text-red-400" role="alert">
          {imageError}
        </p>
      ) : null}
      <div>
        <label
          htmlFor={`q-stem-${question.id}`}
          className="text-sm font-medium text-[var(--d2q-text)]"
        >
          Question
        </label>
        <textarea
          id={`q-stem-${question.id}`}
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          rows={3}
          className={inputClass}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="cursor-pointer text-xs font-medium text-[var(--d2q-accent-hover)] underline">
            Add question image
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void handleQuestionImage(e)}
            />
          </label>
          {questionImageId ? (
            <>
              <StoredImage
                mediaId={questionImageId}
                alt=""
                className="mt-1"
              />
              <button
                type="button"
                onClick={() => void clearQuestionImage()}
                className="text-xs font-medium text-red-400 hover:underline"
              >
                Remove image
              </button>
            </>
          ) : null}
        </div>
      </div>
      {(["A", "B", "C", "D"] as const).map((label, i) => {
        const setters = [setOpt0, setOpt1, setOpt2, setOpt3] as const;
        const values = [opt0, opt1, opt2, opt3];
        const idx = i as 0 | 1 | 2 | 3;
        const oid = optionImageIds[idx];
        return (
          <div key={label}>
            <label
              htmlFor={`q-opt-${question.id}-${i}`}
              className="text-sm font-medium text-[var(--d2q-text)]"
            >
              {label}
            </label>
            <input
              id={`q-opt-${question.id}-${i}`}
              type="text"
              value={values[i]}
              onChange={(e) => setters[i](e.target.value)}
              className={inputClass}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer text-xs font-medium text-[var(--d2q-accent-hover)] underline">
                Image for {label}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => void handleOptionImage(idx, e)}
                />
              </label>
              {oid ? (
                <>
                  <StoredImage mediaId={oid} alt="" />
                  <button
                    type="button"
                    onClick={() => void clearOptionImage(idx)}
                    className="text-xs font-medium text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
      <fieldset>
        <legend className="text-sm font-medium text-[var(--d2q-text)]">
          Correct answer
        </legend>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {([0, 1, 2, 3] as const).map((i) => (
            <label
              key={i}
              className="flex cursor-pointer items-center gap-2 text-sm text-[var(--d2q-muted)]"
            >
              <input
                type="radio"
                name={groupName}
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                className="h-4 w-4 border-[var(--d2q-border-strong)] text-[var(--d2q-accent)] focus:ring-[var(--d2q-accent)]"
              />
              {String.fromCharCode(65 + i)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="cursor-pointer rounded-lg bg-[var(--d2q-accent)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition-colors duration-200 hover:bg-[var(--d2q-accent-hover)]"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--d2q-muted)] transition-colors duration-200 hover:bg-[var(--d2q-surface)] hover:text-[var(--d2q-text)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
