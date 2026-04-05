"use client";

import { useEffect, useState } from "react";
import type { Question } from "@/types/question";

export type QuestionEditorProps = {
  question: Question;
  onSave: (q: Question) => void;
  onCancel: () => void;
};

export function QuestionEditor({
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

  useEffect(() => {
    setStem(question.question);
    setOpt0(question.options[0]);
    setOpt1(question.options[1]);
    setOpt2(question.options[2]);
    setOpt3(question.options[3]);
    setCorrectIndex(question.correctIndex);
  }, [question]);

  const inputClass =
    "mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";

  const handleSave = () => {
    onSave({
      id: question.id,
      question: stem,
      options: [opt0, opt1, opt2, opt3] as Question["options"],
      correctIndex,
    });
  };

  const groupName = `correct-${question.id}`;

  return (
    <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
      <div>
        <label
          htmlFor={`q-stem-${question.id}`}
          className="text-sm font-medium text-neutral-800"
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
      </div>
      {(["A", "B", "C", "D"] as const).map((label, i) => {
        const setters = [setOpt0, setOpt1, setOpt2, setOpt3] as const;
        const values = [opt0, opt1, opt2, opt3];
        return (
          <div key={label}>
            <label
              htmlFor={`q-opt-${question.id}-${i}`}
              className="text-sm font-medium text-neutral-800"
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
          </div>
        );
      })}
      <fieldset>
        <legend className="text-sm font-medium text-neutral-800">
          Correct answer
        </legend>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {([0, 1, 2, 3] as const).map((i) => (
            <label
              key={i}
              className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700"
            >
              <input
                type="radio"
                name={groupName}
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                className="h-4 w-4 border-neutral-300 text-teal-700 focus:ring-teal-600"
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
          className="cursor-pointer rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-teal-800"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors duration-200 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
