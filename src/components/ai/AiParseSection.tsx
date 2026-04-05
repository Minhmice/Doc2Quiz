"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chunkText } from "@/lib/ai/chunkText";
import { FatalParseError } from "@/lib/ai/errors";
import { runSequentialParse } from "@/lib/ai/runSequentialParse";
import {
  clearKeyForProvider,
  getKeyForProvider,
  getProvider,
  setKeyForProvider,
  setProvider,
} from "@/lib/ai/storage";
import { loadDraftQuestions } from "@/lib/review/draftQuestions";
import type { AiProvider, Question } from "@/types/question";
import { LS_DRAFT_QUESTIONS } from "@/types/question";
import { QuestionPreviewList } from "@/components/ai/QuestionPreviewList";

export type AiParseSectionProps = {
  extractedText: string;
  onDraftPersisted?: () => void;
};

export function AiParseSection({
  extractedText,
  onDraftPersisted,
}: AiParseSectionProps) {
  const [provider, setProviderState] = useState<AiProvider>("openai");
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    status: "idle" | "running" | "done";
  }>({ current: 0, total: 0, status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const p = getProvider();
    setProviderState(p);
    setKeyInput(getKeyForProvider(p));
    const draft = loadDraftQuestions();
    if (draft.length > 0) {
      setQuestions(draft);
    }
  }, []);

  const trimmedText = extractedText.trim();
  const hasKey = keyInput.trim().length > 0;
  const isRunning = progress.status === "running";

  const parseDisabled = useMemo(
    () => !trimmedText || !hasKey || isRunning,
    [trimmedText, hasKey, isRunning],
  );

  const hintMessage = useMemo(() => {
    if (isRunning) {
      return null;
    }
    if (!trimmedText) {
      return "Upload and extract a PDF first.";
    }
    if (!hasKey) {
      return "Add an API key above to parse questions.";
    }
    return null;
  }, [trimmedText, hasKey, isRunning]);

  const selectProvider = useCallback((p: AiProvider) => {
    setProvider(p);
    setProviderState(p);
    setKeyInput(getKeyForProvider(p));
  }, []);

  const handleKeyChange = useCallback(
    (value: string) => {
      setKeyInput(value);
      setKeyForProvider(provider, value);
    },
    [provider],
  );

  const handleClearKey = useCallback(() => {
    clearKeyForProvider(provider);
    setKeyInput("");
  }, [provider]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleParse = useCallback(async () => {
    setError(null);
    setSummary(null);

    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
      setError(
        trimmedText.length === 0
          ? "Upload and extract a PDF first."
          : "No text chunks to parse. Try a longer document.",
      );
      return;
    }

    const apiKey = keyInput.trim();
    if (!apiKey) {
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ current: 0, total: chunks.length, status: "running" });

    try {
      const result = await runSequentialParse({
        provider,
        apiKey,
        chunks,
        signal: controller.signal,
        onProgress: ({ current, total }) => {
          setProgress({ current, total, status: "running" });
        },
      });

      setQuestions(result.questions);

      const n = result.questions.length;
      const m = result.failedChunks;
      const parts: string[] = [`Parsed ${n} question${n === 1 ? "" : "s"}`];
      if (m > 0) {
        parts.push(`${m} chunk${m === 1 ? "" : "s"} failed`);
      }
      if (controller.signal.aborted) {
        parts.push("Parsing stopped.");
      }
      setSummary(parts.join(". ") + ".");

      if (result.fatalError) {
        setError(result.fatalError);
      }

      if (!controller.signal.aborted && !result.fatalError) {
        try {
          localStorage.setItem(
            LS_DRAFT_QUESTIONS,
            JSON.stringify({
              savedAt: new Date().toISOString(),
              questions: result.questions,
            }),
          );
          onDraftPersisted?.();
        } catch {
          /* ignore quota / private mode */
        }
      }
    } catch (e) {
      if (e instanceof FatalParseError) {
        setError(e.message);
      } else {
        setError(
          "Some parts of the document could not be processed.",
        );
      }
    } finally {
      abortRef.current = null;
      setProgress((p) => ({
        ...p,
        status: "idle",
      }));
    }
  }, [extractedText, keyInput, provider, trimmedText.length, onDraftPersisted]);

  return (
    <section
      className="mt-10 border-t border-neutral-200 pt-10"
      aria-labelledby="ai-parse-heading"
    >
      <h2
        id="ai-parse-heading"
        className="text-lg font-semibold tracking-tight text-neutral-900"
      >
        AI question parsing
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Choose a provider and add your API key. Questions are generated in your
        browser from the extracted text above.
      </p>

      <div
        className="mt-6 flex flex-wrap gap-2"
        role="group"
        aria-label="AI provider"
      >
        <button
          type="button"
          onClick={() => selectProvider("openai")}
          className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            provider === "openai"
              ? "border-teal-600 bg-teal-50 text-teal-900"
              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
          }`}
        >
          OpenAI
        </button>
        <button
          type="button"
          onClick={() => selectProvider("anthropic")}
          className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            provider === "anthropic"
              ? "border-teal-600 bg-teal-50 text-teal-900"
              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
          }`}
        >
          Claude
        </button>
      </div>

      <div className="mt-4">
        <label
          htmlFor="ai-api-key"
          className="block text-sm font-medium text-neutral-800"
        >
          API key ({provider === "openai" ? "OpenAI" : "Anthropic"})
        </label>
        <p className="mt-1 text-sm text-neutral-600">
          Your API key is stored locally in your browser. It is never sent to our
          servers.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="relative min-w-0 flex-1">
            <input
              id="ai-api-key"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={keyInput}
              onChange={(e) => handleKeyChange(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 pr-10 text-sm text-neutral-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              aria-describedby="ai-key-trust"
            />
            <span id="ai-key-trust" className="sr-only">
              Your API key is stored locally in your browser. It is never sent
              to our servers.
            </span>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-neutral-500 transition-colors duration-200 hover:bg-neutral-100 hover:text-neutral-800"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m12.743 12.743 3 3M9.88 9.88l4.24 4.24m-4.24 4.24 4.24-4.24"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={handleClearKey}
            className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors duration-200 hover:bg-neutral-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleParse}
          disabled={parseDisabled}
          className="cursor-pointer rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Parse Questions
        </button>
        {isRunning ? (
          <button
            type="button"
            onClick={handleCancel}
            className="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 transition-colors duration-200 hover:bg-red-100"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {hintMessage ? (
        <p className="mt-2 text-sm text-neutral-500">{hintMessage}</p>
      ) : null}

      {isRunning ? (
        <p
          className="mt-3 text-sm font-medium text-teal-800"
          aria-live="polite"
        >
          Parsing questions… {progress.current} / {progress.total} chunks
        </p>
      ) : null}

      {error ? (
        <p
          className="mt-3 text-sm font-medium text-red-800"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      ) : null}

      {summary ? (
        <p className="mt-3 text-sm text-neutral-700" aria-live="polite">
          {summary}
        </p>
      ) : null}

      <QuestionPreviewList questions={questions} />
    </section>
  );
}
