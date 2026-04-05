"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chunkText } from "@/lib/ai/chunkText";
import { FatalParseError } from "@/lib/ai/errors";
import { runSequentialParse } from "@/lib/ai/runSequentialParse";
import { runVisionSequential } from "@/lib/ai/runVisionSequential";
import {
  getKeyForProvider,
  getModelForProvider,
  getProvider,
  getUrlForProvider,
} from "@/lib/ai/storage";
import { useParseProgress } from "@/components/ai/ParseProgressContext";
import {
  ensureStudySetDb,
  getDraftQuestions,
  getParseProgressRecord,
  putDraftQuestions,
  putParseProgressRecord,
  touchStudySetMeta,
} from "@/lib/db/studySetDb";
import {
  renderPdfPagesToImages,
  VISION_MAX_PAGES_DEFAULT,
} from "@/lib/pdf/renderPagesToImages";
import type { Question } from "@/types/question";
import type { ParseProgressPhase } from "@/types/studySet";
import { QuestionPreviewList } from "@/components/ai/QuestionPreviewList";

export type AiParseSectionProps = {
  studySetId: string;
  extractedText: string;
  activePdfFile: File | null;
  pageCount: number | null;
  textExtractionEmpty: boolean;
  /** Persist textarea/source to IDB immediately before starting parse (merged Source page). */
  onBeforeParse?: () => Promise<void>;
  onDraftPersisted?: () => void;
};

export function AiParseSection({
  studySetId,
  extractedText,
  activePdfFile,
  pageCount = null,
  textExtractionEmpty = false,
  onBeforeParse,
  onDraftPersisted,
}: AiParseSectionProps) {
  const { reportParse, clearParse } = useParseProgress();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    status: "idle" | "running" | "done";
  }>({ current: 0, total: 0, status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [visionRendering, setVisionRendering] = useState(false);
  const [parseMode, setParseMode] = useState<"text" | "vision" | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastIdbWriteRef = useRef(0);
  const prevRunningRef = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        await ensureStudySetDb();
        const s = await getParseProgressRecord(studySetId);
        if (s?.running) {
          await putParseProgressRecord({
            ...s,
            running: false,
            phase: "idle",
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        /* ignore */
      }
    })();
  }, [studySetId]);

  useEffect(() => {
    return () => {
      clearParse();
    };
  }, [clearParse]);

  useEffect(() => {
    const running =
      progress.status === "running" || visionRendering;
    let phase: ParseProgressPhase = "idle";
    if (running) {
      if (visionRendering) {
        phase = "rendering_pdf";
      } else if (parseMode === "vision") {
        phase = "vision_pages";
      } else {
        phase = "text_chunks";
      }
    }

    const record = {
      studySetId,
      updatedAt: new Date().toISOString(),
      running,
      phase,
      current: progress.current,
      total: progress.total,
    };

    if (running) {
      reportParse({
        studySetId,
        running: true,
        phase,
        current: progress.current,
        total: progress.total,
      });
      const now = Date.now();
      const immediate = !prevRunningRef.current;
      if (immediate || now - lastIdbWriteRef.current >= 400) {
        lastIdbWriteRef.current = now;
        void putParseProgressRecord(record);
      }
    } else {
      clearParse(studySetId);
      if (prevRunningRef.current) {
        void putParseProgressRecord({
          ...record,
          running: false,
          phase: "idle",
        });
      }
    }
    prevRunningRef.current = running;
  }, [studySetId, progress, visionRendering, parseMode, reportParse, clearParse]);

  const reloadDraft = useCallback(async () => {
    const draft = await getDraftQuestions(studySetId);
    setQuestions(draft);
  }, [studySetId]);

  useEffect(() => {
    void reloadDraft();
  }, [reloadDraft]);

  const provider = getProvider();
  const keyInput = getKeyForProvider(provider);
  const urlInput = getUrlForProvider(provider);
  const modelInput = getModelForProvider(provider);

  const trimmedText = extractedText.trim();
  const hasKey = keyInput.trim().length > 0;
  const hasCustomEndpoint =
    provider !== "custom" || urlInput.trim().length > 0;
  const hasCustomModel =
    provider !== "custom" || modelInput.trim().length > 0;

  const visionForwardReady =
    provider === "openai" || provider === "custom";

  const isRunning =
    progress.status === "running" || visionRendering;

  const visionDisabled =
    !textExtractionEmpty ||
    !activePdfFile ||
    !visionForwardReady ||
    !hasKey ||
    isRunning ||
    (provider === "custom" && (!urlInput.trim() || !modelInput.trim()));

  const canRunTextParse =
    Boolean(trimmedText) && hasKey && hasCustomEndpoint && hasCustomModel;
  const canRunVisionParse = !visionDisabled;

  const unifiedParseDisabled =
    isRunning || (!canRunTextParse && !(textExtractionEmpty && canRunVisionParse));

  const hintMessage = useMemo(() => {
    if (isRunning) {
      return null;
    }
    if (!hasKey) {
      return null;
    }
    if (!trimmedText) {
      if (textExtractionEmpty && activePdfFile) {
        return "No selectable text — use Parse below with a vision-capable model (OpenAI or Custom), or add text in the editor above.";
      }
      return "Add extracted or pasted text above, or use a scanned PDF with Parse below.";
    }
    if (provider === "custom") {
      if (!urlInput.trim()) {
        return "Enter the full chat-completions URL in Settings.";
      }
      if (!modelInput.trim()) {
        return "Enter a model id in Settings.";
      }
    }
    return null;
  }, [
    trimmedText,
    hasKey,
    isRunning,
    provider,
    urlInput,
    modelInput,
    textExtractionEmpty,
    activePdfFile,
  ]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const persistQuestions = useCallback(
    async (qs: Question[]) => {
      await putDraftQuestions(studySetId, qs);
      await touchStudySetMeta(studySetId, {});
      onDraftPersisted?.();
    },
    [studySetId, onDraftPersisted],
  );

  const handlePreviewSetCorrectIndex = useCallback(
    (questionId: string, index: 0 | 1 | 2 | 3) => {
      setQuestions((prev) => {
        const nextList = prev.map((q) =>
          q.id === questionId ? { ...q, correctIndex: index } : q,
        );
        void persistQuestions(nextList);
        return nextList;
      });
    },
    [persistQuestions],
  );

  const handleParse = useCallback(async () => {
    setError(null);
    setSummary(null);

    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
      setError(
        trimmedText.length === 0
          ? "No text to parse yet."
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
    setParseMode("text");
    setProgress({ current: 0, total: chunks.length, status: "running" });

    try {
      const result = await runSequentialParse({
        provider,
        apiKey,
        apiUrl: urlInput,
        model: modelInput,
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
        await persistQuestions(result.questions);
      }
    } catch (e) {
      if (e instanceof FatalParseError) {
        setError(e.message);
      } else {
        setError("Some parts of the document could not be processed.");
      }
    } finally {
      abortRef.current = null;
      setParseMode(null);
      setProgress((p) => ({
        ...p,
        status: "idle",
      }));
    }
  }, [
    extractedText,
    keyInput,
    urlInput,
    modelInput,
    provider,
    trimmedText.length,
    persistQuestions,
  ]);

  const handleVisionParse = useCallback(async () => {
    if (!activePdfFile || visionDisabled) {
      return;
    }

    setError(null);
    setSummary(null);

    const apiKey = keyInput.trim();
    if (!apiKey) {
      return;
    }

    const forwardProvider = provider === "custom" ? "custom" : "openai";

    const controller = new AbortController();
    abortRef.current = controller;
    setParseMode("vision");
    setVisionRendering(true);
    setProgress({ current: 0, total: 1, status: "running" });

    try {
      const pages = await renderPdfPagesToImages(activePdfFile, {
        signal: controller.signal,
        maxPages: VISION_MAX_PAGES_DEFAULT,
      });

      if (controller.signal.aborted) {
        return;
      }

      if (pages.length === 0) {
        setError("Could not render any PDF pages for vision.");
        return;
      }

      setVisionRendering(false);
      const visionStepTotal =
        pages.length <= 1 ? pages.length : pages.length - 1;
      setProgress({ current: 0, total: visionStepTotal, status: "running" });

      const result = await runVisionSequential({
        forwardProvider,
        apiKey,
        apiUrl: urlInput,
        model: modelInput,
        pages,
        signal: controller.signal,
        onProgress: ({ current, total }) => {
          setProgress({ current, total, status: "running" });
        },
      });

      setQuestions(result.questions);

      const n = result.questions.length;
      const m = result.failedSteps;
      const parts: string[] = [
        `Vision: parsed ${n} question${n === 1 ? "" : "s"}`,
      ];
      if (m > 0) {
        parts.push(`${m} vision step${m === 1 ? "" : "s"} failed`);
      }
      if (controller.signal.aborted) {
        parts.push("Parsing stopped.");
      }
      setSummary(parts.join(". ") + ".");

      if (result.fatalError) {
        setError(result.fatalError);
      }

      if (!controller.signal.aborted && !result.fatalError) {
        await persistQuestions(result.questions);
      }
    } catch (e) {
      if (e instanceof FatalParseError) {
        setError(e.message);
      } else if (
        e instanceof DOMException &&
        e.name === "AbortError"
      ) {
        setSummary("Vision parsing stopped.");
      } else {
        setError(
          e instanceof Error
            ? e.message
            : "Vision parsing failed. Check model supports images.",
        );
      }
    } finally {
      setVisionRendering(false);
      abortRef.current = null;
      setParseMode(null);
      setProgress((p) => ({
        ...p,
        status: "idle",
      }));
    }
  }, [
    activePdfFile,
    visionDisabled,
    keyInput,
    provider,
    urlInput,
    modelInput,
    persistQuestions,
  ]);

  const handleUnifiedParse = useCallback(async () => {
    setError(null);
    setSummary(null);
    try {
      await onBeforeParse?.();
    } catch {
      setError("Could not save source text before parsing.");
      return;
    }
    if (canRunTextParse && !isRunning) {
      await handleParse();
      return;
    }
    if (textExtractionEmpty && canRunVisionParse && activePdfFile) {
      await handleVisionParse();
      return;
    }
    if (!hasKey) {
      setError("Add an API key in Settings to parse.");
      return;
    }
    if (trimmedText && !canRunTextParse && provider === "custom") {
      if (!urlInput.trim()) {
        setError("Enter the full chat-completions URL in Settings.");
        return;
      }
      if (!modelInput.trim()) {
        setError("Enter a model id in Settings.");
        return;
      }
    }
    setError(
      trimmedText
        ? "Cannot start text parse right now."
        : textExtractionEmpty && provider === "anthropic"
          ? "Switch to OpenAI or Custom in Settings for vision parsing."
          : "Nothing to parse — add text or use a PDF with no extractable text.",
    );
  }, [
    onBeforeParse,
    canRunTextParse,
    canRunVisionParse,
    isRunning,
    textExtractionEmpty,
    activePdfFile,
    hasKey,
    trimmedText,
    provider,
    urlInput,
    modelInput,
    handleParse,
    handleVisionParse,
  ]);

  const visionPageCap =
    pageCount !== null
      ? Math.min(pageCount, VISION_MAX_PAGES_DEFAULT)
      : VISION_MAX_PAGES_DEFAULT;

  return (
    <section
      className="space-y-6"
      aria-labelledby="ai-parse-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="ai-parse-heading"
          className="text-lg font-semibold tracking-tight text-[var(--d2q-text)]"
        >
          Parse with AI
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {hasKey ? (
            <span className="rounded-full bg-emerald-950/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
              API key set
            </span>
          ) : (
            <Link
              href="/settings"
              className="font-medium text-[var(--d2q-accent-hover)] underline-offset-2 hover:underline"
            >
              Configure API in Settings
            </Link>
          )}
        </div>
      </div>
      <p className="text-sm text-[var(--d2q-muted)]">
        Uses the text editor above (or vision on scanned PDFs). Configure
        provider, model, and keys in{" "}
        <Link
          href="/settings"
          className="font-medium text-[var(--d2q-accent-hover)] underline-offset-2 hover:underline"
        >
          Settings
        </Link>
        .
      </p>

      {textExtractionEmpty && activePdfFile ? (
        <div
          className="rounded-lg border border-orange-500/30 bg-orange-950/35 p-4 text-sm text-amber-100 shadow-sm"
          role="region"
          aria-label="Scanned PDF vision parsing"
        >
          <p className="font-semibold text-amber-200">Scanned or image-only PDF</p>
          <p className="mt-1 text-amber-100/95">
            <strong className="font-semibold">Parse</strong> below will use
            vision: up to{" "}
            <strong className="font-semibold">{visionPageCap}</strong>{" "}
            page{visionPageCap === 1 ? "" : "s"} as images (one API call per
            page). Use a vision-capable model in Settings.
          </p>
          {provider === "anthropic" ? (
            <p className="mt-2 font-medium text-amber-200">
              Switch to OpenAI or Custom in Settings to use vision parsing.
            </p>
          ) : null}
        </div>
      ) : null}

      {!hasKey ? (
        <p className="text-sm text-[var(--d2q-muted)]">
          Add an API key in{" "}
          <Link
            href="/settings"
            className="font-medium text-[var(--d2q-accent-hover)] underline-offset-2 hover:underline"
          >
            Settings
          </Link>{" "}
          to parse questions.
        </p>
      ) : null}
      {hintMessage ? (
        <p className="text-sm text-[var(--d2q-muted)]">{hintMessage}</p>
      ) : null}

      {isRunning ? (
        <p
          className="text-sm font-medium text-[var(--d2q-accent-hover)]"
          aria-live="polite"
        >
          {visionRendering
            ? "Rendering PDF pages as images…"
            : parseMode === "vision"
              ? `Parsing with vision… ${progress.current} / ${progress.total} steps`
              : `Parsing questions… ${progress.current} / ${progress.total} chunks`}
        </p>
      ) : null}

      {error ? (
        <p
          className="text-sm font-medium text-red-400"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      ) : null}

      {summary ? (
        <p className="text-sm text-[var(--d2q-text)]" aria-live="polite">
          {summary}
        </p>
      ) : null}

      <QuestionPreviewList
        questions={questions}
        onSetCorrectIndex={handlePreviewSetCorrectIndex}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--d2q-border)] pt-6">
        <button
          type="button"
          onClick={() => void handleUnifiedParse()}
          disabled={unifiedParseDisabled}
          className="cursor-pointer rounded-lg bg-[var(--d2q-accent)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition-colors duration-200 hover:bg-[var(--d2q-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Parse
        </button>
        {isRunning ? (
          <button
            type="button"
            onClick={handleCancel}
            className="cursor-pointer rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-300 transition-colors duration-200 hover:bg-red-950/60"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}
