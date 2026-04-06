"use client";

import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { FatalParseError } from "@/lib/ai/errors";
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
import { isMcqComplete } from "@/lib/review/validateMcq";
import type { Question } from "@/types/question";
import type { ParseProgressPhase } from "@/types/studySet";
import { QuestionPreviewList } from "@/components/ai/QuestionPreviewList";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export type ParseRunResult = {
  ok: boolean;
  aborted: boolean;
  fatalError: string | null;
  questions: Question[];
};

export type AiParseSectionHandle = {
  runParse: () => Promise<ParseRunResult>;
  cancel: () => void;
};

export type AiParseSectionProps = {
  studySetId: string;
  activePdfFile: File | null;
  pageCount: number | null;
  /** Persist document to IDB immediately before starting parse */
  onBeforeParse?: () => Promise<void>;
  onDraftPersisted?: () => void;
  variant?: "full" | "embedded";
  autoStartWhenDraftEmpty?: boolean;
  autoStartResetKey?: string | number;
  onEmbeddedParseFinished?: (result: ParseRunResult) => void;
};

export const AiParseSection = forwardRef<
  AiParseSectionHandle,
  AiParseSectionProps
>(function AiParseSectionInner(
  {
    studySetId,
    activePdfFile,
    pageCount = null,
    onBeforeParse,
    onDraftPersisted,
    variant = "full",
    autoStartWhenDraftEmpty = false,
    autoStartResetKey = "default",
    onEmbeddedParseFinished,
  },
  ref,
) {
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
  const [parseMode, setParseMode] = useState<"vision" | null>(null);
  const [parseOverlay, setParseOverlay] = useState<{
    extractedCount: number;
    log: string[];
    renderPage: number;
    renderTot: number;
    thumbs: { pageIndex: number; dataUrl: string }[];
  }>({
    extractedCount: 0,
    log: [],
    renderPage: 0,
    renderTot: 0,
    thumbs: [],
  });

  const abortRef = useRef<AbortController | null>(null);
  const lastIdbWriteRef = useRef(0);
  const prevRunningRef = useRef(false);
  const consumedAutoKeyRef = useRef<string | number | null>(null);

  const isEmbedded = variant === "embedded";

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
    const running = progress.status === "running" || visionRendering;
    let phase: ParseProgressPhase = "idle";
    if (running) {
      if (visionRendering) {
        phase = "rendering_pdf";
      } else if (parseMode === "vision") {
        phase = "vision_pages";
      } else {
        phase = "vision_pages";
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
        documentPageCount: pageCount ?? undefined,
        extractedQuestionCount: parseOverlay.extractedCount,
        parseLog: parseOverlay.log,
        renderPageIndex: parseOverlay.renderPage,
        renderPageTotal: parseOverlay.renderTot,
        pageThumbnails: parseOverlay.thumbs,
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
  }, [
    studySetId,
    progress,
    visionRendering,
    parseMode,
    reportParse,
    clearParse,
    pageCount,
    parseOverlay,
  ]);

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

  const hasKey = keyInput.trim().length > 0;
  const hasCustomEndpoint =
    provider !== "custom" || urlInput.trim().length > 0;
  const hasCustomModel =
    provider !== "custom" || modelInput.trim().length > 0;

  const visionForwardReady =
    provider === "openai" || provider === "custom";

  const isRunning = progress.status === "running" || visionRendering;

  const visionDisabled =
    !activePdfFile ||
    !visionForwardReady ||
    !hasKey ||
    isRunning ||
    (provider === "custom" && (!urlInput.trim() || !modelInput.trim()));

  const canRunVisionParse = !visionDisabled;

  const unifiedParseDisabled = isRunning || !canRunVisionParse;

  const hintMessage = useMemo(() => {
    if (isRunning) {
      return null;
    }
    if (!hasKey) {
      return null;
    }
    if (provider === "anthropic") {
      return "PDF parsing sends each page as an image. Switch to OpenAI or Custom in Settings with a vision-capable model.";
    }
    if (!activePdfFile) {
      return isEmbedded
        ? "No PDF on file — replace or re-import the document."
        : "Add a PDF file to parse.";
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
    hasKey,
    isRunning,
    provider,
    urlInput,
    modelInput,
    activePdfFile,
    isEmbedded,
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

  const handleVisionParse = useCallback(async (): Promise<ParseRunResult> => {
    if (!activePdfFile || visionDisabled) {
      return {
        ok: false,
        aborted: false,
        fatalError: null,
        questions: [],
      };
    }

    setError(null);
    setSummary(null);

    const apiKey = keyInput.trim();
    if (!apiKey) {
      return {
        ok: false,
        aborted: false,
        fatalError: null,
        questions: [],
      };
    }

    const timeStamp = () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

    const forwardProvider = provider === "custom" ? "custom" : "openai";

    const controller = new AbortController();
    abortRef.current = controller;
    setParseMode("vision");
    setVisionRendering(true);
    setProgress({ current: 0, total: 1, status: "running" });
    setParseOverlay({
      extractedCount: 0,
      log: [`${timeStamp()} — Preparing document for vision…`],
      renderPage: 0,
      renderTot: 0,
      thumbs: [],
    });

    try {
      const pages = await renderPdfPagesToImages(activePdfFile, {
        signal: controller.signal,
        maxPages: VISION_MAX_PAGES_DEFAULT,
        onPageRendered: (pg, { totalPages }) => {
          setParseOverlay((p) => ({
            ...p,
            renderPage: pg.pageIndex,
            renderTot: totalPages,
            thumbs: [...p.thumbs, { pageIndex: pg.pageIndex, dataUrl: pg.dataUrl }].slice(
              -6,
            ),
            log: [
              ...p.log,
              `${timeStamp()} — Page ${pg.pageIndex}/${totalPages} rasterized`,
            ].slice(-16),
          }));
        },
      });

      if (controller.signal.aborted) {
        return {
          ok: false,
          aborted: true,
          fatalError: null,
          questions: [],
        };
      }

      if (pages.length === 0) {
        setError("Could not render any PDF pages for vision.");
        return {
          ok: false,
          aborted: false,
          fatalError: null,
          questions: [],
        };
      }

      setVisionRendering(false);
      const visionStepTotal =
        pages.length <= 1 ? pages.length : pages.length - 1;
      setProgress({ current: 0, total: visionStepTotal, status: "running" });
      setParseOverlay((p) => ({
        ...p,
        log: [
          ...p.log,
          `${timeStamp()} — Analyzing structure · ${pages.length} page image${pages.length === 1 ? "" : "s"}`,
        ].slice(-16),
      }));

      const result = await runVisionSequential({
        forwardProvider,
        apiKey,
        apiUrl: urlInput,
        model: modelInput,
        pages,
        signal: controller.signal,
        onProgress: ({ current, total, questionsSoFar }) => {
          setProgress({ current, total, status: "running" });
          setParseOverlay((p) => ({
            ...p,
            extractedCount: questionsSoFar,
            log: [
              ...p.log,
              `${timeStamp()} — Pass ${current}/${total} · ${questionsSoFar} question${questionsSoFar === 1 ? "" : "s"} extracted`,
            ].slice(-16),
          }));
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

      const fatal = result.fatalError ?? null;
      if (fatal) {
        setError(fatal);
      }

      if (!controller.signal.aborted && !fatal) {
        await persistQuestions(result.questions);
      }

      const aborted = controller.signal.aborted;
      return {
        ok: !aborted && !fatal,
        aborted,
        fatalError: fatal,
        questions: result.questions,
      };
    } catch (e) {
      if (e instanceof FatalParseError) {
        setError(e.message);
      } else if (e instanceof DOMException && e.name === "AbortError") {
        setSummary("Vision parsing stopped.");
      } else {
        setError(
          e instanceof Error
            ? e.message
            : "Vision parsing failed. Check model supports images.",
        );
      }
      return {
        ok: false,
        aborted: e instanceof DOMException && e.name === "AbortError",
        fatalError: null,
        questions: [],
      };
    } finally {
      setVisionRendering(false);
      abortRef.current = null;
      setParseMode(null);
      setProgress((p) => ({
        ...p,
        status: "idle",
      }));
      setParseOverlay({
        extractedCount: 0,
        log: [],
        renderPage: 0,
        renderTot: 0,
        thumbs: [],
      });
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

  const runUnifiedParseInternal =
    useCallback(async (): Promise<ParseRunResult> => {
      setError(null);
      setSummary(null);
      try {
        await onBeforeParse?.();
      } catch {
        setError("Could not save before parsing.");
        return {
          ok: false,
          aborted: false,
          fatalError: null,
          questions: [],
        };
      }

      if (!hasKey) {
        setError("Add an API key in Settings to parse.");
        return {
          ok: false,
          aborted: false,
          fatalError: null,
          questions: [],
        };
      }

      if (!visionForwardReady) {
        setError(
          "Switch to OpenAI or Custom in Settings — PDF parsing uses vision (page images).",
        );
        return {
          ok: false,
          aborted: false,
          fatalError: null,
          questions: [],
        };
      }

      if (!activePdfFile) {
        setError("No PDF file available. Re-import or replace the document.");
        return {
          ok: false,
          aborted: false,
          fatalError: null,
          questions: [],
        };
      }

      if (provider === "custom") {
        if (!urlInput.trim()) {
          setError("Enter the full chat-completions URL in Settings.");
          return {
            ok: false,
            aborted: false,
            fatalError: null,
            questions: [],
          };
        }
        if (!modelInput.trim()) {
          setError("Enter a model id in Settings.");
          return {
            ok: false,
            aborted: false,
            fatalError: null,
            questions: [],
          };
        }
      }

      if (!hasCustomEndpoint || !hasCustomModel) {
        setError("Check Settings: endpoint and model are required.");
        return {
          ok: false,
          aborted: false,
          fatalError: null,
          questions: [],
        };
      }

      return handleVisionParse();
    }, [
      onBeforeParse,
      hasKey,
      visionForwardReady,
      activePdfFile,
      provider,
      urlInput,
      modelInput,
      hasCustomEndpoint,
      hasCustomModel,
      handleVisionParse,
    ]);

  useImperativeHandle(
    ref,
    () => ({
      runParse: () => runUnifiedParseInternal(),
      cancel: handleCancel,
    }),
    [runUnifiedParseInternal, handleCancel],
  );

  useEffect(() => {
    if (!isEmbedded || !autoStartWhenDraftEmpty) {
      return;
    }
    const key = autoStartResetKey ?? "default";
    if (isRunning) {
      return;
    }
    if (questions.length > 0) {
      consumedAutoKeyRef.current = key;
      return;
    }
    if (unifiedParseDisabled) {
      return;
    }
    if (consumedAutoKeyRef.current === key) {
      return;
    }
    consumedAutoKeyRef.current = key;
    void (async () => {
      const r = await runUnifiedParseInternal();
      onEmbeddedParseFinished?.(r);
    })();
  }, [
    isEmbedded,
    autoStartWhenDraftEmpty,
    autoStartResetKey,
    questions.length,
    isRunning,
    unifiedParseDisabled,
    runUnifiedParseInternal,
    onEmbeddedParseFinished,
  ]);

  const handleUnifiedParse = useCallback(async () => {
    const r = await runUnifiedParseInternal();
    if (isEmbedded) {
      onEmbeddedParseFinished?.(r);
    }
  }, [runUnifiedParseInternal, isEmbedded, onEmbeddedParseFinished]);

  const visionPageCap =
    pageCount !== null
      ? Math.min(pageCount, VISION_MAX_PAGES_DEFAULT)
      : VISION_MAX_PAGES_DEFAULT;

  const showInlineProgress = !isEmbedded && isRunning;
  const showPreview = !isEmbedded;

  return (
    <section
      className="space-y-6"
      aria-labelledby={isEmbedded ? undefined : "ai-parse-heading"}
    >
      {!isEmbedded ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="ai-parse-heading"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Parse with AI
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {hasKey ? (
                <Badge
                  variant="secondary"
                  className="border border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
                >
                  API key set
                </Badge>
              ) : (
                <Link
                  href="/settings"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Configure API in Settings
                </Link>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Each PDF page is rendered and sent to a vision-capable model (OpenAI
            or Custom). Up to{" "}
            <strong className="font-medium text-foreground">
              {visionPageCap}
            </strong>{" "}
            page{visionPageCap === 1 ? "" : "s"}. Configure provider and model
            in{" "}
            <Link
              href="/settings"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Settings
            </Link>
            .
          </p>
        </>
      ) : null}

      {!hasKey ? (
        <p className="text-sm text-muted-foreground">
          Add an API key in{" "}
          <Link
            href="/settings"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Settings
          </Link>{" "}
          to parse questions.
        </p>
      ) : null}
      {hintMessage ? (
        <p className="text-sm text-muted-foreground">{hintMessage}</p>
      ) : null}

      {showInlineProgress ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm font-medium text-primary">
            {visionRendering
              ? "Rendering PDF pages as images…"
              : `Parsing with vision… ${progress.current} / ${progress.total} steps`}
          </p>
          {!visionRendering && progress.total > 0 ? (
            <Progress
              value={Math.min(
                100,
                Math.round((100 * progress.current) / progress.total),
              )}
            />
          ) : null}
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!isEmbedded && summary ? (
        <p className="text-sm text-foreground" aria-live="polite">
          {summary}
        </p>
      ) : null}

      {showPreview ? (
        <QuestionPreviewList
          questions={questions}
          onSetCorrectIndex={handlePreviewSetCorrectIndex}
        />
      ) : null}

      {!isEmbedded ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <Button
            type="button"
            onClick={() => void handleUnifiedParse()}
            disabled={unifiedParseDisabled}
          >
            Parse
          </Button>
          {isRunning ? (
            <Button type="button" variant="destructive" onClick={handleCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
});

export function countIncompleteMcqs(questions: Question[]): number {
  return questions.reduce((n, q) => n + (isMcqComplete(q) ? 0 : 1), 0);
}
