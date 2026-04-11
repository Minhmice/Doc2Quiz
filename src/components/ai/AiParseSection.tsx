"use client";

import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { dedupeQuestionsByStem } from "@/lib/ai/dedupeQuestions";
import { FatalParseError } from "@/lib/ai/errors";
import { getOcrResult, putOcrResult } from "@/lib/ai/ocrDb";
import {
  applyQuestionPageMapping,
  type VisionParseMode,
} from "@/lib/ai/mapQuestionsToPages";
import {
  parseChunkSingleMcqOnce,
  resolveChatApiUrl,
  resolveModelId,
} from "@/lib/ai/parseChunk";
import { buildLayoutChunksFromRun } from "@/lib/ai/layoutChunksFromOcr";
import {
  runLayoutChunkParse,
  type ChunkParseResult,
} from "@/lib/ai/runLayoutChunkParse";
import { runOcrSequential } from "@/lib/ai/runOcrSequential";
import {
  runVisionSequential,
  type RunVisionSequentialResult,
} from "@/lib/ai/runVisionSequential";
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
  putMediaBlob,
  putParseProgressRecord,
  touchStudySetMeta,
} from "@/lib/db/studySetDb";
import {
  fileSummary,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import {
  renderPdfPagesToImages,
  type PageImageResult,
  VISION_MAX_PAGES_DEFAULT,
} from "@/lib/pdf/renderPagesToImages";
import { isMcqComplete } from "@/lib/review/validateMcq";
import type { OcrRunResult } from "@/types/ocr";
import type { Question } from "@/types/question";
import type { ParseProgressPhase } from "@/types/studySet";
import { QuestionPreviewList } from "@/components/ai/QuestionPreviewList";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const LS_ATTACH_PAGE_IMAGE = "doc2quiz:parse:attachPageImage";
const LS_ENABLE_OCR = "doc2quiz:parse:enableOcr";
const LS_PARSE_STRATEGY = "doc2quiz:parse:strategy";

export type ParseStrategy = "fast" | "accurate" | "hybrid";

async function attachPageImagesForQuestions(
  studySetId: string,
  pages: PageImageResult[],
  questions: Question[],
): Promise<number> {
  const pageByIndex = new Map(pages.map((p) => [p.pageIndex, p]));
  const cache = new Map<number, string>();
  let fails = 0;
  for (const q of questions) {
    if (q.questionImageId) {
      continue;
    }
    const idx = q.sourcePageIndex;
    if (!idx) {
      continue;
    }
    const page = pageByIndex.get(idx);
    if (!page) {
      fails++;
      continue;
    }
    let mediaId = cache.get(idx);
    if (!mediaId) {
      try {
        const res = await fetch(page.dataUrl);
        if (!res.ok) {
          fails++;
          continue;
        }
        const blob = await res.blob();
        mediaId = await putMediaBlob(studySetId, blob);
        cache.set(idx, mediaId);
      } catch {
        fails++;
        continue;
      }
    }
    q.questionImageId = mediaId;
    q.sourceImageMediaId = mediaId;
    q.imagePageIndex = idx;
  }
  return fails;
}

function readAttachPageImagePreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const v = localStorage.getItem(LS_ATTACH_PAGE_IMAGE);
    if (v === null) {
      return true;
    }
    return v === "1";
  } catch {
    return true;
  }
}

function readEnableOcrPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const v = localStorage.getItem(LS_ENABLE_OCR);
    if (v === null) {
      return true;
    }
    return v === "1";
  } catch {
    return true;
  }
}

function readParseStrategyPreference(): ParseStrategy {
  if (typeof window === "undefined") {
    return "accurate";
  }
  try {
    const v = localStorage.getItem(LS_PARSE_STRATEGY);
    if (v === "fast" || v === "hybrid") {
      return v;
    }
    return "accurate";
  } catch {
    return "accurate";
  }
}

export type ParseRunResult = {
  ok: boolean;
  aborted: boolean;
  fatalError: string | null;
  questions: Question[];
  /** D-28: monotonic wall ms for full run when terminal (set by runUnifiedParseInternal). */
  lastParseRunWallMs?: number;
  /** True when chunk path merged full-page vision fallback */
  usedVisionFallback?: boolean;
  /** Session-only chunk debug for OcrInspector (not IDB) */
  chunkParseDebug?: {
    byChunk: ChunkParseResult[];
    rawByChunkId?: Record<string, string>;
    reason?: "completed" | "vision_only_parse" | "no_layout_chunks";
  };
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
  /** Default true until client reads localStorage (avoids SSR hydration mismatch). */
  const [attachPageImage, setAttachPageImage] = useState(true);
  const attachCheckboxId = useId();
  /** Default true until client reads localStorage (SSR-safe). */
  const [enableOcr, setEnableOcr] = useState(true);
  const ocrCheckboxId = useId();
  const parseStrategyGroupId = useId();

  useEffect(() => {
    setAttachPageImage(readAttachPageImagePreference());
  }, []);
  useEffect(() => {
    setEnableOcr(readEnableOcrPreference());
  }, []);
  const [parseStrategy, setParseStrategy] = useState<ParseStrategy>(
    readParseStrategyPreference,
  );
  const [parseMode, setParseMode] = useState<"vision" | "ocr" | "chunk" | null>(
    null,
  );
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
  /** Hybrid path: OCR gate chose full vision (UI-SPEC optional one-liner). */
  const [hybridOcrGateNote, setHybridOcrGateNote] = useState<string | null>(null);
  /** Last completed unified parse timing for summary lines (D-28). */
  const [terminalParseRun, setTerminalParseRun] = useState<{
    wallMs: number;
    usedVisionFallback: boolean;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  /** Latest raw assistant text per layout chunk id (session-only; cleared each chunk run). */
  const chunkRawByIdRef = useRef<Record<string, string>>({});
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
      } else if (parseMode === "ocr") {
        phase = "ocr_extract";
      } else if (parseMode === "chunk") {
        phase = "text_chunks";
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

  const setAttachPageImagePreference = useCallback((next: boolean) => {
    setAttachPageImage(next);
    try {
      localStorage.setItem(LS_ATTACH_PAGE_IMAGE, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const setEnableOcrPreference = useCallback((next: boolean) => {
    setEnableOcr(next);
    try {
      localStorage.setItem(LS_ENABLE_OCR, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const setParseStrategyPreference = useCallback((next: ParseStrategy) => {
    setParseStrategy(next);
    try {
      localStorage.setItem(LS_PARSE_STRATEGY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const persistQuestions = useCallback(
    async (qs: Question[]) => {
      await putDraftQuestions(studySetId, qs);
      await touchStudySetMeta(studySetId, {});
      onDraftPersisted?.();
    },
    [studySetId, onDraftPersisted],
  );

  type RenderOcrPrepared = {
    kind: "prepared";
    pages: PageImageResult[];
    ocrForMapping: OcrRunResult | null;
  };

  const runRenderPagesAndOptionalOcr = useCallback(
    async (
      file: File,
      controller: AbortController,
      apiKey: string,
      forwardProvider: "openai" | "custom",
      timeStamp: () => string,
      afterOcrParseMode: "vision" | "none",
    ): Promise<ParseRunResult | RenderOcrPrepared> => {
      const pages = await renderPdfPagesToImages(file, {
        signal: controller.signal,
        maxPages: VISION_MAX_PAGES_DEFAULT,
        onPageRendered: (pg, { totalPages }) => {
          setParseOverlay((p) => ({
            ...p,
            renderPage: pg.pageIndex,
            renderTot: totalPages,
            thumbs: [
              ...p.thumbs,
              { pageIndex: pg.pageIndex, dataUrl: pg.dataUrl },
            ].slice(-6),
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
        pipelineLog(
          "PDF",
          "render-batch",
          "error",
          "vision: zero pages after renderPdfPagesToImages",
          {
            studySetId: studySetId.trim() || "(empty)",
            ...fileSummary(file),
          },
        );
        setError("Could not render any PDF pages for vision.");
        return {
          ok: false,
          aborted: false,
          fatalError: null,
          questions: [],
        };
      }

      setVisionRendering(false);

      let ocrForMapping: OcrRunResult | null = null;
      const enableOcrEffective =
        enableOcr && studySetId.trim().length > 0 && visionForwardReady;

      // D-16: Fast/Hybrid chunk path expects OCR prefetch (`runOcrSequential` → `putOcrResult`) when OCR is enabled.
      if (enableOcrEffective) {
        setParseMode("ocr");
        setProgress({ current: 0, total: pages.length, status: "running" });
        setParseOverlay((p) => ({
          ...p,
          log: [
            ...p.log,
            `${timeStamp()} — OCR: extracting text per page (same API as vision)…`,
          ].slice(-16),
        }));
        pipelineLog("OCR", "run", "info", "runOcrSequential starting", {
          studySetId: studySetId.trim(),
          pageCount: pages.length,
          forwardProvider,
          model: modelInput,
        });
        try {
          const endpoint = resolveChatApiUrl(provider, urlInput);
          const model = resolveModelId(provider, modelInput);
          const ocrResult = await runOcrSequential({
            pages,
            signal: controller.signal,
            provider: forwardProvider === "openai" ? "openai" : "custom",
            endpoint,
            apiKey,
            model,
            onProgress: ({ current, total, textSoFar }) => {
              setProgress({ current, total, status: "running" });
              setParseOverlay((p) => ({
                ...p,
                log: [
                  ...p.log,
                  `${timeStamp()} — OCR ${current}/${total} · ${textSoFar} chars total`,
                ].slice(-16),
              }));
            },
          });
          if (!controller.signal.aborted && ocrResult) {
            ocrForMapping = ocrResult;
            await putOcrResult(studySetId, ocrResult);
            pipelineLog("OCR", "run", "info", "OCR run finished; putOcrResult done", {
              studySetId,
              savedPages: ocrResult.pages.length,
              stats: ocrResult.stats,
            });
            await touchStudySetMeta(studySetId, {
              ocrStatus: "done",
              ocrProvider: ocrResult.provider,
            });
            const st = ocrResult.stats;
            if (st && st.failedPages > 0) {
              pipelineLog("OCR", "run", "warn", "some OCR pages failed (vision continues)", {
                studySetId,
                failedPages: st.failedPages,
              });
              toast.warning(
                `${st.failedPages} page(s) failed OCR; vision parse continues.`,
              );
            }
          } else if (!controller.signal.aborted && !ocrResult) {
            pipelineLog("OCR", "run", "warn", "OCR returned null (aborted mid-run?)", {
              studySetId,
            });
          }
        } catch (raw) {
          pipelineLog("OCR", "run", "error", "OCR step threw (vision continues)", {
            studySetId: studySetId.trim(),
            ...normalizeUnknownError(raw),
            raw,
          });
          if (!controller.signal.aborted) {
            toast.warning("OCR step failed; continuing with vision parse.");
          }
        } finally {
          if (!controller.signal.aborted) {
            setParseMode(afterOcrParseMode === "vision" ? "vision" : null);
          }
        }
      }

      if (controller.signal.aborted) {
        return {
          ok: false,
          aborted: true,
          fatalError: null,
          questions: [],
        };
      }

      return { kind: "prepared", pages, ocrForMapping };
    },
    [
      enableOcr,
      studySetId,
      visionForwardReady,
      provider,
      urlInput,
      modelInput,
    ],
  );

  const runVisionSequentialWithUi = useCallback(
    async (
      pages: PageImageResult[],
      controller: AbortController,
      forwardProvider: "openai" | "custom",
      apiKey: string,
      timeStamp: () => string,
    ) => {
      const attachEffective =
        attachPageImage && studySetId.trim().length > 0;
      const visionStepTotal = attachEffective
        ? pages.length
        : pages.length <= 1
          ? pages.length
          : pages.length - 1;
      setProgress({ current: 0, total: visionStepTotal, status: "running" });
      setParseOverlay((p) => ({
        ...p,
        log: [
          ...p.log,
          `${timeStamp()} — Analyzing structure · ${pages.length} page image${pages.length === 1 ? "" : "s"}${attachEffective ? " · page images will be linked to questions" : ""}`,
        ].slice(-16),
      }));

      pipelineLog("VISION", "run", "info", "runVisionSequential starting", {
        studySetId: studySetId.trim() || "(empty)",
        attachPageImages: attachEffective,
        visionSteps: visionStepTotal,
        pageImages: pages.length,
      });

      const result = await runVisionSequential({
        forwardProvider,
        apiKey,
        apiUrl: urlInput,
        model: modelInput,
        pages,
        signal: controller.signal,
        studySetId,
        attachPageImages: attachEffective,
        onProgress: ({ current, total, questionsSoFar }) => {
          setProgress({ current, total, status: "running" });
          const attachDoneNote =
            attachEffective && current === total
              ? " · page images saved to questions"
              : "";
          setParseOverlay((p) => ({
            ...p,
            extractedCount: questionsSoFar,
            log: [
              ...p.log,
              `${timeStamp()} — Pass ${current}/${total} · ${questionsSoFar} question${questionsSoFar === 1 ? "" : "s"} extracted${attachDoneNote}`,
            ].slice(-16),
          }));
        },
      });
      return { result, attachEffective };
    },
    [attachPageImage, studySetId, urlInput, modelInput],
  );

  const finalizeVisionParseResult = useCallback(
    async (
      result: RunVisionSequentialResult,
      pages: PageImageResult[],
      attachEffective: boolean,
      controller: AbortController,
      ocrForMapping: OcrRunResult | null,
      file: File,
    ): Promise<ParseRunResult> => {
      let ocrSnapshot: OcrRunResult | null = ocrForMapping;
      if (studySetId.trim().length > 0) {
        try {
          ocrSnapshot =
            ocrSnapshot ?? (await getOcrResult(studySetId)) ?? null;
        } catch {
          /* best-effort */
        }
      }

      if (studySetId.trim().length > 0) {
        try {
          const visionParseMode: VisionParseMode = attachEffective
            ? "attach_single"
            : pages.length <= 1
              ? "single"
              : "pair";
          applyQuestionPageMapping(result.questions, ocrSnapshot ?? null, {
            parseMode: visionParseMode,
          });
        } catch {
          /* mapping is best-effort; vision + draft persist still proceed */
        }
      }

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
        pipelineLog("VISION", "parse-fatal", "error", "vision parse returned fatalError", {
          studySetId: studySetId.trim() || "(empty)",
          fatalError: fatal,
          failedSteps: result.failedSteps,
          questionCount: result.questions.length,
          ...fileSummary(file),
        });
        setError(fatal);
      } else {
        pipelineLog("VISION", "run", "info", "runVisionSequential finished OK", {
          studySetId: studySetId.trim() || "(empty)",
          questionCount: result.questions.length,
          failedSteps: result.failedSteps,
          attachImageFailures: result.attachImageFailures ?? 0,
        });
      }

      if (!controller.signal.aborted && !fatal) {
        await persistQuestions(result.questions);
      }

      if (
        attachEffective &&
        (result.attachImageFailures ?? 0) > 0 &&
        !controller.signal.aborted
      ) {
        toast.warning(
          "Could not attach some page images; those questions have no reference image.",
        );
      }

      const aborted = controller.signal.aborted;
      return {
        ok: !aborted && !fatal,
        aborted,
        fatalError: fatal,
        questions: result.questions,
        chunkParseDebug: {
          byChunk: [],
          reason: "vision_only_parse" as const,
        },
        usedVisionFallback: false,
      };
    },
    [studySetId, persistQuestions],
  );

  const runLayoutChunkPipelineFromPrepared = useCallback(
    async (
      pages: PageImageResult[],
      ocrForMapping: OcrRunResult,
      controller: AbortController,
      forwardProvider: "openai" | "custom",
      apiKey: string,
      timeStamp: () => string,
    ): Promise<ParseRunResult> => {
      const chunks = buildLayoutChunksFromRun(ocrForMapping);
      chunkRawByIdRef.current = {};
      setParseMode("chunk");
      setProgress({
        current: 0,
        total: Math.max(1, chunks.length),
        status: "running",
      });

      const chunkOut = await runLayoutChunkParse({
        run: ocrForMapping,
        chunks,
        signal: controller.signal,
        studySetId: studySetId.trim() || undefined,
        parse: (userContent, signal, meta) =>
          parseChunkSingleMcqOnce({
            provider,
            apiKey,
            apiUrl: urlInput,
            model: modelInput,
            chunkText: userContent,
            signal,
            onRawAssistantText: meta
              ? (text) => {
                  chunkRawByIdRef.current[meta.layoutChunkId] = text;
                }
              : undefined,
          }),
        progress: (done, total) => {
          setProgress({ current: done, total, status: "running" });
          setParseOverlay((p) => ({
            ...p,
            log: [
              ...p.log,
              `${timeStamp()} — Chunk parse ${done}/${total}`,
            ].slice(-16),
          }));
        },
      });

      let merged = chunkOut.questions;
      let usedVisionFallback = false;
      if (chunkOut.needsVisionFallback) {
        usedVisionFallback = true;
        pipelineLog("VISION", "layout-chunk", "info", "vision fallback after chunk parse", {
          studySetId: studySetId.trim(),
        });
        setParseMode("vision");
        const { result, attachEffective } = await runVisionSequentialWithUi(
          pages,
          controller,
          forwardProvider,
          apiKey,
          timeStamp,
        );
        if (result.fatalError) {
          pipelineLog("VISION", "layout-chunk", "warn", "vision fallback returned fatal; keeping chunks only", {
            studySetId: studySetId.trim(),
            fatalError: result.fatalError,
          });
          toast.warning(
            "Vision fallback failed; keeping layout-chunk results only.",
          );
          merged = chunkOut.questions;
        } else {
          merged = dedupeQuestionsByStem([
            ...chunkOut.questions,
            ...result.questions,
          ]);
          if (attachEffective && (result.attachImageFailures ?? 0) > 0) {
            toast.warning(
              "Could not attach some page images from the vision pass.",
            );
          }
        }
      }

      const attachEffective =
        attachPageImage && studySetId.trim().length > 0;
      if (attachEffective) {
        const fails = await attachPageImagesForQuestions(
          studySetId,
          pages,
          merged,
        );
        if (fails > 0 && !controller.signal.aborted) {
          toast.warning(
            "Could not attach some page images; those questions have no reference image.",
          );
        }
      }

      let ocrSnapshot: OcrRunResult | null = ocrForMapping;
      if (studySetId.trim().length > 0) {
        try {
          ocrSnapshot =
            ocrSnapshot ?? (await getOcrResult(studySetId)) ?? null;
        } catch {
          /* ignore */
        }
      }

      const visionParseMode: VisionParseMode = attachEffective
        ? "attach_single"
        : pages.length <= 1
          ? "single"
          : "pair";
      applyQuestionPageMapping(merged, ocrSnapshot ?? null, {
        parseMode: visionParseMode,
      });

      setQuestions(merged);
      const parts = [
        `Layout-aware: ${merged.length} question${merged.length === 1 ? "" : "s"}`,
      ];
      if (chunkOut.needsVisionFallback) {
        parts.push("merged with full-page vision where chunks were insufficient");
      }
      if (controller.signal.aborted) {
        parts.push("Parsing stopped.");
      }
      setSummary(parts.join(" · ") + ".");

      if (!controller.signal.aborted) {
        await persistQuestions(merged);
      }

      const chunkParseDebug: NonNullable<ParseRunResult["chunkParseDebug"]> = {
        byChunk: chunkOut.byChunk,
        rawByChunkId: { ...chunkRawByIdRef.current },
        reason:
          chunks.length === 0 ? "no_layout_chunks" : ("completed" as const),
      };

      return {
        ok: !controller.signal.aborted,
        aborted: controller.signal.aborted,
        fatalError: null,
        questions: merged,
        usedVisionFallback,
        chunkParseDebug,
      };
    },
    [
      provider,
      attachPageImage,
      studySetId,
      urlInput,
      modelInput,
      persistQuestions,
      runVisionSequentialWithUi,
    ],
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

    pipelineLog("VISION", "parse-start", "info", "handleVisionParse started", {
      studySetId: studySetId.trim() || "(empty)",
      ...fileSummary(activePdfFile),
      forwardProvider,
      aiProvider: provider,
      model: modelInput,
    });

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
      const prep = await runRenderPagesAndOptionalOcr(
        activePdfFile,
        controller,
        apiKey,
        forwardProvider,
        timeStamp,
        "vision",
      );
      if (!("kind" in prep) || prep.kind !== "prepared") {
        return prep as ParseRunResult;
      }
      const { pages, ocrForMapping } = prep;

      if (controller.signal.aborted) {
        return {
          ok: false,
          aborted: true,
          fatalError: null,
          questions: [],
        };
      }

      const { result, attachEffective } = await runVisionSequentialWithUi(
        pages,
        controller,
        forwardProvider,
        apiKey,
        timeStamp,
      );
      return await finalizeVisionParseResult(
        result,
        pages,
        attachEffective,
        controller,
        ocrForMapping,
        activePdfFile,
      );
    } catch (e) {
      pipelineLog("VISION", "parse-error", "error", "handleVisionParse threw", {
        studySetId: studySetId.trim() || "(empty)",
        ...fileSummary(activePdfFile),
        ...normalizeUnknownError(e),
        raw: e,
        isFatalParse: e instanceof FatalParseError,
        isAbort: e instanceof DOMException && e.name === "AbortError",
      });
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
    modelInput,
    studySetId,
    runRenderPagesAndOptionalOcr,
    runVisionSequentialWithUi,
    finalizeVisionParseResult,
  ]);

  const handleLayoutAwareParse =
    useCallback(async (): Promise<ParseRunResult> => {
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

      if (!enableOcr) {
        pipelineLog("VISION", "strategy", "info", "fast path needs OCR — using vision", {
          studySetId: studySetId.trim(),
        });
        return handleVisionParse();
      }

      const timeStamp = () =>
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      const forwardProvider = provider === "custom" ? "custom" : "openai";

      pipelineLog("VISION", "layout-chunk", "info", "handleLayoutAwareParse started", {
        studySetId: studySetId.trim() || "(empty)",
        ...fileSummary(activePdfFile),
        forwardProvider,
      });

      const controller = new AbortController();
      abortRef.current = controller;
      setParseMode("vision");
      setVisionRendering(true);
      setProgress({ current: 0, total: 1, status: "running" });
      setParseOverlay({
        extractedCount: 0,
        log: [`${timeStamp()} — Preparing document…`],
        renderPage: 0,
        renderTot: 0,
        thumbs: [],
      });

      try {
        const prep = await runRenderPagesAndOptionalOcr(
          activePdfFile,
          controller,
          apiKey,
          forwardProvider,
          timeStamp,
          "none",
        );
        if (!("kind" in prep) || prep.kind !== "prepared") {
          return prep as ParseRunResult;
        }
        const { pages } = prep;
        let ocrForMapping = prep.ocrForMapping;

        if (controller.signal.aborted) {
          return {
            ok: false,
            aborted: true,
            fatalError: null,
            questions: [],
          };
        }

        if (!ocrForMapping && studySetId.trim()) {
          try {
            ocrForMapping =
              (await getOcrResult(studySetId)) ?? null;
          } catch {
            /* ignore */
          }
        }

        if (!ocrForMapping) {
          pipelineLog("VISION", "layout-chunk", "warn", "no OCR data — vision only", {
            studySetId: studySetId.trim(),
          });
          setParseMode("vision");
          const { result, attachEffective } = await runVisionSequentialWithUi(
            pages,
            controller,
            forwardProvider,
            apiKey,
            timeStamp,
          );
          return await finalizeVisionParseResult(
            result,
            pages,
            attachEffective,
            controller,
            null,
            activePdfFile,
          );
        }

        return await runLayoutChunkPipelineFromPrepared(
          pages,
          ocrForMapping,
          controller,
          forwardProvider,
          apiKey,
          timeStamp,
        );
      } catch (e) {
        pipelineLog("VISION", "layout-chunk", "error", "handleLayoutAwareParse threw", {
          studySetId: studySetId.trim() || "(empty)",
          ...fileSummary(activePdfFile),
          ...normalizeUnknownError(e),
          raw: e,
          isFatalParse: e instanceof FatalParseError,
          isAbort: e instanceof DOMException && e.name === "AbortError",
        });
        if (e instanceof FatalParseError) {
          setError(e.message);
        } else if (e instanceof DOMException && e.name === "AbortError") {
          setSummary("Parsing stopped.");
        } else {
          setError(
            e instanceof Error
              ? e.message
              : "Layout-aware parsing failed. Check your model and try again.",
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
      enableOcr,
      studySetId,
      handleVisionParse,
      runRenderPagesAndOptionalOcr,
      runVisionSequentialWithUi,
      finalizeVisionParseResult,
      runLayoutChunkPipelineFromPrepared,
    ]);

  const handleHybridParse = useCallback(async (): Promise<ParseRunResult> => {
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
    setHybridOcrGateNote(null);

    const apiKey = keyInput.trim();
    if (!apiKey) {
      return {
        ok: false,
        aborted: false,
        fatalError: null,
        questions: [],
      };
    }

    if (!enableOcr) {
      return handleVisionParse();
    }

    const timeStamp = () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    const forwardProvider = provider === "custom" ? "custom" : "openai";

    pipelineLog("VISION", "hybrid", "info", "handleHybridParse started", {
      studySetId: studySetId.trim() || "(empty)",
      ...fileSummary(activePdfFile),
    });

    const controller = new AbortController();
    abortRef.current = controller;
    setParseMode("vision");
    setVisionRendering(true);
    setProgress({ current: 0, total: 1, status: "running" });
    setParseOverlay({
      extractedCount: 0,
      log: [`${timeStamp()} — Preparing document (hybrid)…`],
      renderPage: 0,
      renderTot: 0,
      thumbs: [],
    });

    try {
      const prep = await runRenderPagesAndOptionalOcr(
        activePdfFile,
        controller,
        apiKey,
        forwardProvider,
        timeStamp,
        "none",
      );
      if (!("kind" in prep) || prep.kind !== "prepared") {
        return prep as ParseRunResult;
      }
      const { pages } = prep;
      let ocrForMapping = prep.ocrForMapping;

      if (controller.signal.aborted) {
        return {
          ok: false,
          aborted: true,
          fatalError: null,
          questions: [],
        };
      }

      const stats = ocrForMapping?.stats;
      const useFast =
        stats !== undefined &&
        stats.failedPages === 0 &&
        stats.totalPages > 0 &&
        stats.successPages / stats.totalPages >= 0.85;

      if (!useFast) {
        pipelineLog("VISION", "hybrid", "info", "hybrid chose full vision (OCR gate)", {
          studySetId: studySetId.trim(),
          stats,
        });
        setHybridOcrGateNote("OCR quality below threshold — using full-page vision.");
        setParseMode("vision");
        const { result, attachEffective } = await runVisionSequentialWithUi(
          pages,
          controller,
          forwardProvider,
          apiKey,
          timeStamp,
        );
        return await finalizeVisionParseResult(
          result,
          pages,
          attachEffective,
          controller,
          ocrForMapping,
          activePdfFile,
        );
      }

      if (!ocrForMapping && studySetId.trim()) {
        try {
          ocrForMapping = (await getOcrResult(studySetId)) ?? null;
        } catch {
          /* ignore */
        }
      }

      if (!ocrForMapping) {
        setParseMode("vision");
        const { result, attachEffective } = await runVisionSequentialWithUi(
          pages,
          controller,
          forwardProvider,
          apiKey,
          timeStamp,
        );
        return await finalizeVisionParseResult(
          result,
          pages,
          attachEffective,
          controller,
          null,
          activePdfFile,
        );
      }

      return await runLayoutChunkPipelineFromPrepared(
        pages,
        ocrForMapping,
        controller,
        forwardProvider,
        apiKey,
        timeStamp,
      );
    } catch (e) {
      pipelineLog("VISION", "hybrid", "error", "handleHybridParse threw", {
        studySetId: studySetId.trim() || "(empty)",
        ...fileSummary(activePdfFile),
        ...normalizeUnknownError(e),
        raw: e,
        isFatalParse: e instanceof FatalParseError,
        isAbort: e instanceof DOMException && e.name === "AbortError",
      });
      if (e instanceof FatalParseError) {
        setError(e.message);
      } else if (e instanceof DOMException && e.name === "AbortError") {
        setSummary("Parsing stopped.");
      } else {
        setError(
          e instanceof Error
            ? e.message
            : "Hybrid parsing failed. Check your model and try again.",
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
    enableOcr,
    studySetId,
    handleVisionParse,
    runRenderPagesAndOptionalOcr,
    runVisionSequentialWithUi,
    finalizeVisionParseResult,
    runLayoutChunkPipelineFromPrepared,
  ]);

  const runUnifiedParseInternal =
    useCallback(async (): Promise<ParseRunResult> => {
      setError(null);
      setSummary(null);
      setTerminalParseRun(null);
      try {
        await onBeforeParse?.();
      } catch (raw) {
        pipelineLog("VISION", "pre-parse", "error", "onBeforeParse failed", {
          studySetId: studySetId.trim(),
          ...normalizeUnknownError(raw),
          raw,
        });
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

      /*
       * D-28: wall clock for the whole user-triggered parse (after successful onBeforeParse)
       * through terminal handlers — includes vision fallback, attachPageImages, persistQuestions
       * when executed inside the same invoked parse for Fast/Hybrid chunk path.
       */
      const runWallT0 = performance.now();
      let routed: ParseRunResult;
      if (parseStrategy === "accurate") {
        routed = await handleVisionParse();
      } else if (parseStrategy === "hybrid") {
        routed = await handleHybridParse();
      } else {
        routed = await handleLayoutAwareParse();
      }
      return {
        ...routed,
        lastParseRunWallMs: performance.now() - runWallT0,
      };
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
      parseStrategy,
      studySetId,
      handleVisionParse,
      handleHybridParse,
      handleLayoutAwareParse,
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
      if (
        typeof r.lastParseRunWallMs === "number" &&
        Number.isFinite(r.lastParseRunWallMs)
      ) {
        setTerminalParseRun({
          wallMs: r.lastParseRunWallMs,
          usedVisionFallback: r.usedVisionFallback ?? false,
        });
      } else {
        setTerminalParseRun(null);
      }
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
    if (
      typeof r.lastParseRunWallMs === "number" &&
      Number.isFinite(r.lastParseRunWallMs)
    ) {
      setTerminalParseRun({
        wallMs: r.lastParseRunWallMs,
        usedVisionFallback: r.usedVisionFallback ?? false,
      });
    } else {
      setTerminalParseRun(null);
    }
    if (isEmbedded) {
      onEmbeddedParseFinished?.(r);
    }
  }, [runUnifiedParseInternal, isEmbedded, onEmbeddedParseFinished]);

  const visionPageCap =
    pageCount !== null
      ? Math.min(pageCount, VISION_MAX_PAGES_DEFAULT)
      : VISION_MAX_PAGES_DEFAULT;

  const attachEffectiveForUi =
    attachPageImage && studySetId.trim().length > 0;

  const attachPageImageControl = (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="flex cursor-pointer items-start gap-3">
        <input
          id={attachCheckboxId}
          type="checkbox"
          className="mt-1 size-4 shrink-0 cursor-pointer rounded border-input accent-primary"
          checked={attachPageImage}
          onChange={(e) => setAttachPageImagePreference(e.target.checked)}
        />
        <div className="min-w-0 space-y-1">
          <Label
            htmlFor={attachCheckboxId}
            className="cursor-pointer text-sm font-medium leading-none text-foreground"
          >
            Attach page image to parsed questions
          </Label>
          <p className="text-sm text-muted-foreground">
            Each parsed question will keep a reference image from its source PDF
            page.
          </p>
        </div>
      </div>
    </div>
  );

  const ocrExtractionControl = (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="flex cursor-pointer items-start gap-3">
        <input
          id={ocrCheckboxId}
          type="checkbox"
          className="mt-1 size-4 shrink-0 cursor-pointer rounded border-input accent-primary"
          checked={enableOcr}
          onChange={(e) => setEnableOcrPreference(e.target.checked)}
        />
        <div className="min-w-0 space-y-1">
          <Label
            htmlFor={ocrCheckboxId}
            className="cursor-pointer text-sm font-medium leading-none text-foreground"
          >
            Run OCR before vision parse
          </Label>
          <p className="text-sm text-muted-foreground">
            Extracts page text and layout into local storage for the OCR inspector
            and future mapping. OCR errors never block vision parsing.
          </p>
        </div>
      </div>
    </div>
  );

  const parseStrategyControl = (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <Label
        id={`${parseStrategyGroupId}-label`}
        className="text-sm font-medium text-foreground"
      >
        Parse strategy
      </Label>
      <div
        className="flex flex-col gap-2 text-sm"
        role="radiogroup"
        aria-labelledby={`${parseStrategyGroupId}-label`}
      >
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
            name={parseStrategyGroupId}
            checked={parseStrategy === "fast"}
            onChange={() => setParseStrategyPreference("fast")}
          />
          <span>
            <span className="font-medium text-foreground">Fast</span>
            <span className="block text-muted-foreground">
              OCR layout chunks → small text prompts; full-page vision only if
              chunks fail. Needs OCR enabled.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
            name={parseStrategyGroupId}
            checked={parseStrategy === "hybrid"}
            onChange={() => setParseStrategyPreference("hybrid")}
          />
          <span>
            <span className="font-medium text-foreground">Hybrid</span>
            <span className="block text-muted-foreground">
              Uses Fast when OCR looks strong (≥85% pages successful, no failed
              pages); otherwise full vision like Accurate.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
            name={parseStrategyGroupId}
            checked={parseStrategy === "accurate"}
            onChange={() => setParseStrategyPreference("accurate")}
          />
          <span>
            <span className="font-medium text-foreground">Accurate</span>
            <span className="block text-muted-foreground">
              Full-page vision parse (same as before). Highest recall on hard
              layouts.
            </span>
          </span>
        </label>
      </div>
    </div>
  );

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
          {attachPageImageControl}
          {ocrExtractionControl}
          {parseStrategyControl}
        </>
      ) : hasKey && activePdfFile ? (
        <div className="space-y-3">
          {attachPageImageControl}
          {ocrExtractionControl}
          {parseStrategyControl}
        </div>
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

      {hybridOcrGateNote ? (
        <p className="text-sm text-muted-foreground">{hybridOcrGateNote}</p>
      ) : null}

      {showInlineProgress ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm font-medium text-primary">
            {visionRendering
              ? "Rendering PDF pages as images…"
              : parseMode === "ocr"
                ? `OCR text extraction… ${progress.current} / ${progress.total} pages`
                : parseMode === "chunk"
                  ? `Layout-aware chunk parse… ${progress.current} / ${progress.total}`
                  : `Parsing with vision… ${progress.current} / ${progress.total} steps${attachEffectiveForUi ? " · linking page images" : ""}`}
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

      {isEmbedded && isRunning ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm font-medium text-primary">
            {visionRendering
              ? "Rendering PDF pages as images…"
              : parseMode === "ocr"
                ? `OCR text extraction… ${progress.current} / ${progress.total} pages`
                : parseMode === "chunk"
                  ? `Layout-aware chunk parse… ${progress.current} / ${progress.total}`
                  : `Parsing with vision… ${progress.current} / ${progress.total} steps${attachEffectiveForUi ? " · linking page images" : ""}`}
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
        <div className="space-y-1" aria-live="polite">
          <p className="text-sm text-foreground">{summary}</p>
          {terminalParseRun ? (
            <>
              <p className="text-sm text-muted-foreground">
                Parse time: {(terminalParseRun.wallMs / 1000).toFixed(1)}s
              </p>
              {terminalParseRun.usedVisionFallback ? (
                <p className="text-sm text-muted-foreground">
                  Includes full-page vision fallback.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {isEmbedded && !isRunning && summary ? (
        <div className="space-y-1" aria-live="polite">
          <p className="text-sm text-foreground">{summary}</p>
          {terminalParseRun ? (
            <>
              <p className="text-sm text-muted-foreground">
                Parse time: {(terminalParseRun.wallMs / 1000).toFixed(1)}s
              </p>
              {terminalParseRun.usedVisionFallback ? (
                <p className="text-sm text-muted-foreground">
                  Includes full-page vision fallback.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
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
              Cancel parsing (stop AI processing)
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
