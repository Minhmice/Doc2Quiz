"use client";

/**
 * Parse orchestration (vision / OCR / layout chunk) for study sets.
 *
 * **Flashcards (parseOutputMode === "flashcard"):** vision **batch** only, **theory-only**
 * concept cards — no OCR prefetch, no layout/chunk/hybrid, no `Question[]` / MCQ sequential vision.
 * **Quiz** owns MCQ prompts, parsers, chunk paths, and review routes.
 */

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
  appendUncertainMappingSummaryClause,
} from "@/lib/ai/mappingQuality";
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
  runVisionBatchSequential,
  type RunVisionBatchSequentialResult,
} from "@/lib/ai/runVisionBatchSequential";
import { dedupeVisionItems } from "@/lib/ai/visionDedupe";
import { planVisionBatches } from "@/lib/ai/visionBatching";
import { quizVisionItemToQuestion } from "@/lib/ai/visionMappers";
import { attachPageImagesForQuestions } from "@/lib/ai/attachPageImagesForQuestions";
import type { ParseStrategy } from "@/lib/ai/parseLocalStorage";
import {
  persistAttachPageImageToStorage,
  persistEnableOcrToStorage,
  persistParseStrategyToStorage,
  readAttachPageImagePreference,
  readEnableOcrPreference,
  readParseStrategyPreference,
} from "@/lib/ai/parseLocalStorage";
import { estimateParseRun } from "@/lib/ai/estimateParseRun";
import {
  decideParseRoute,
  TEXT_LAYER_STRONG,
  TEXT_LAYER_UNCERTAIN_DEFAULT_VISION,
} from "@/lib/ai/parseRoutePolicy";
import { parseCapabilityUserMessage } from "@/lib/ai/parseCapabilityMessages";
import {
  getSurfaceAvailability,
  surfaceBlockReason,
} from "@/lib/ai/parseCapabilities";
import {
  getForwardOpenAiCompatKind,
  readForwardSettings,
} from "@/lib/ai/forwardSettings";
import { getProvider } from "@/lib/ai/storage";
import { AiParseActions } from "@/components/ai/AiParseActions";
import { AiParseEstimatePanel } from "@/components/ai/AiParseEstimatePanel";
import {
  AiParseParseStrategyPanel,
  type AiParseDocumentHint,
} from "@/components/ai/AiParseParseStrategyPanel";
import { AiParsePreferenceToggles } from "@/components/ai/AiParsePreferenceToggles";
import { AiParseSectionHeader } from "@/components/ai/AiParseSectionHeader";
import { useParseProgress } from "@/components/ai/ParseProgressContext";
import {
  ensureStudySetDb,
  getApprovedBank,
  getDocument,
  getParseProgressRecord,
  getStudySetMeta,
  putApprovedBankForStudySet,
  putApprovedFlashcardBankForStudySet,
  putDraftFlashcardVisionItems,
  putParseProgressRecord,
  touchStudySetMeta,
} from "@/lib/db/studySetDb";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
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
import { sampleTextLayerSignal } from "@/lib/pdf/sampleTextLayerSignal";
import { extractPdfTextForPageRange } from "@/lib/pdf/extractPdfText";
import { PREVIEW_FIRST_PAGE_BUDGET } from "@/lib/pdf/extractText";
import { classifyPdfPages } from "@/lib/pdf/classifyPdfPages";
import { chunkText } from "@/lib/ai/chunkText";
import { runSequentialParse } from "@/lib/ai/runSequentialParse";
import { isMcqComplete } from "@/lib/review/validateMcq";
import type { OcrRunResult } from "@/types/ocr";
import type { ApprovedBank, Question } from "@/types/question";
import type {
  ApprovedFlashcardBank,
  FlashcardVisionItem,
  ParseOutputMode,
  QuizVisionItem,
} from "@/types/visionParse";
import type { FlashcardGenerationConfig } from "@/types/flashcardGeneration";
import { normalizeFlashcardGenerationConfig } from "@/types/flashcardGeneration";
import type { ParseProgressPhase } from "@/types/studySet";
import { QuestionPreviewList } from "@/components/ai/QuestionPreviewList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export type { ParseStrategy } from "@/lib/ai/parseLocalStorage";

function formatTimeStamp(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Result of a single parse run.
 *
 * Lane contract:
 * - Quiz lane: `questions` populated, `flashcardItems` empty/undefined.
 * - Flashcard lane: `flashcardItems` populated, `questions` intentionally empty.
 *
 * `parseOutputMode` is the authoritative lane tag for downstream routing.
 */
export type ParseRunResult = {
  ok: boolean;
  aborted: boolean;
  fatalError: string | null;
  questions: Question[];
  /** Phase 21 — populated when `parseOutputMode === "flashcard"` and batch vision ran. */
  flashcardItems?: FlashcardVisionItem[];
  parseOutputMode?: ParseOutputMode;
  /** D-28: monotonic wall ms for full run when terminal (set by runUnifiedParseInternal). */
  lastParseRunWallMs?: number;
  /** True when chunk path merged full-page vision fallback */
  usedVisionFallback?: boolean;
  /** Session-only chunk debug for OcrInspector (not IDB) */
  chunkParseDebug?: {
    byChunk: ChunkParseResult[];
    rawByChunkId?: Record<string, string>;
    reason?:
      | "completed"
      | "vision_only_parse"
      | "vision_batch_parse"
      | "no_layout_chunks";
  };
};

export type AiParseSectionHandle = {
  runParse: () => Promise<ParseRunResult>;
  cancel: () => void;
};

/** `product` hides OCR/strategy toggles from the default view (learner create flow). */
export type AiParseSurface = "product" | "developer";

function mergeVisionBatchSequentialResults(
  first: RunVisionBatchSequentialResult | null,
  second: RunVisionBatchSequentialResult | null,
  mode: ParseOutputMode,
): RunVisionBatchSequentialResult {
  if (first && !second) {
    return first;
  }
  if (!first && second) {
    return second;
  }
  if (!first || !second) {
    throw new Error("mergeVisionBatchSequentialResults: both results null");
  }
  const items = dedupeVisionItems([...first.items, ...second.items], mode);
  return {
    items,
    benchmark: second.benchmark,
    benchmarkReportText:
      first.benchmarkReportText + "\n---\n" + second.benchmarkReportText,
    failedBatches: first.failedBatches + second.failedBatches,
  };
}

export type AiParseSectionProps = {
  studySetId: string;
  activePdfFile: File | null;
  pageCount: number | null;
  /** Persist document to IDB immediately before starting parse */
  onBeforeParse?: () => Promise<void>;
  /** Called after questions are persisted to the approved bank (and meta touched). */
  onBankPersisted?: () => void;
  variant?: "full" | "embedded";
  /** Layout vs parse chrome: use `product` on `/sets/[id]/source` (ingest hub) for quiz/flashcards sets. */
  surface?: AiParseSurface;
  /** Vision MVP: explicit quiz vs flashcard parse (from `StudySetMeta.contentKind`). */
  parseOutputMode?: ParseOutputMode;
  /** Flashcard lane — vision batch prompts + generation controls. */
  flashcardGenerationConfig?: FlashcardGenerationConfig;
  /** Embedded: auto-start parse when the approved bank has no questions yet. */
  autoStartWhenBankEmpty?: boolean;
  autoStartResetKey?: string | number;
  onEmbeddedParseFinished?: (result: ParseRunResult) => void;
  /**
   * When embedded parse progress is shown by a parent (e.g. `ParseProgressWorkbenchPanel`),
   * suppress the duplicate running progress block inside this section.
   */
  suppressEmbeddedRunningProgress?: boolean;
  /** Phase 27 — prioritize first N pages for preview (clamped to 3–5 on product). */
  previewFirstPageBudget?: number;
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
    onBankPersisted,
    variant = "full",
    surface = "developer",
    parseOutputMode = "quiz",
    flashcardGenerationConfig,
    autoStartWhenBankEmpty = false,
    autoStartResetKey = "default",
    onEmbeddedParseFinished,
    suppressEmbeddedRunningProgress = false,
    previewFirstPageBudget = PREVIEW_FIRST_PAGE_BUDGET,
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
  const [documentHint, setDocumentHint] = useState<AiParseDocumentHint>("none");
  const [estimateDocChars, setEstimateDocChars] = useState(0);
  const [estimatePageCount, setEstimatePageCount] = useState<number | null>(
    null,
  );

  const abortRef = useRef<AbortController | null>(null);
  const flashVisionAccumRef = useRef<FlashcardVisionItem[]>([]);
  /** Latest raw assistant text per layout chunk id (session-only; cleared each chunk run). */
  const chunkRawByIdRef = useRef<Record<string, string>>({});
  const lastIdbWriteRef = useRef(0);
  const prevRunningRef = useRef(false);
  const consumedAutoKeyRef = useRef<string | number | null>(null);

  const isEmbedded = variant === "embedded";
  const isProductSurface = surface === "product";
  const isFlashcardParse = parseOutputMode === "flashcard";
  const resolvedFlashcardConfig = useMemo(
    () => normalizeFlashcardGenerationConfig(flashcardGenerationConfig),
    [flashcardGenerationConfig],
  );

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
    let cancelled = false;
    const sid = studySetId.trim();
    if (!sid) {
      setDocumentHint("none");
      setEstimateDocChars(0);
      setEstimatePageCount(null);
      return;
    }
    void (async () => {
      try {
        let extractedTextCharCount = 0;
        let pageCountForPolicy: number | null = pageCount;
        const doc = await getDocument(sid);
        if (cancelled) {
          return;
        }
        extractedTextCharCount = doc?.extractedText?.length ?? 0;
        if (pageCountForPolicy == null) {
          const meta = await getStudySetMeta(sid);
          if (cancelled) {
            return;
          }
          pageCountForPolicy = meta?.pageCount ?? null;
        }
        if (!cancelled) {
          setEstimateDocChars(extractedTextCharCount);
          setEstimatePageCount(pageCountForPolicy);
        }
        const decision = decideParseRoute({
          pageCount: pageCountForPolicy,
          extractedTextCharCount,
          parseStrategy,
          enableOcr,
        });
        if (cancelled) {
          return;
        }
        setDocumentHint(
          decision.reasonCodes.includes(TEXT_LAYER_STRONG)
            ? "strong_text_layer"
            : "none",
        );
      } catch {
        if (!cancelled) {
          setDocumentHint("none");
          setEstimateDocChars(0);
          setEstimatePageCount(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studySetId, pageCount, parseStrategy, enableOcr]);

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

  const reloadApprovedQuestions = useCallback(async () => {
    await ensureStudySetDb();
    const bank = await getApprovedBank(studySetId);
    setQuestions(bank?.questions ?? []);
  }, [studySetId]);

  useEffect(() => {
    void reloadApprovedQuestions();
  }, [reloadApprovedQuestions]);

  const provider = getProvider();
  const forwardSettings = readForwardSettings();
  const keyInput = forwardSettings.apiKey;
  const urlInput = forwardSettings.baseUrl;
  const modelInput = forwardSettings.modelId;

  // Strict single-lane contract:
  // - quiz: vision batch only (when using vision)
  // - flashcard: vision batch only
  const isQuizParse = parseOutputMode === "quiz";
  const batchOnlyVisionParse = isFlashcardParse || isQuizParse;
  const effectiveAttachPageImage = batchOnlyVisionParse ? false : attachPageImage;

  const hasKey = keyInput.trim().length > 0;
  const hasCustomEndpoint =
    provider !== "custom" || urlInput.trim().length > 0;
  const hasCustomModel =
    provider !== "custom" || modelInput.trim().length > 0;

  const surfaceList = getSurfaceAvailability({
    settings: forwardSettings,
    attachPageImages: effectiveAttachPageImage,
  });
  const visionSurface =
    isFlashcardParse || !effectiveAttachPageImage
      ? "vision_multimodal"
      : "vision_attach";
  const visionBlockReasonKey = surfaceBlockReason(surfaceList, visionSurface);
  const visionForwardReady = visionBlockReasonKey === undefined;

  const isRunning = progress.status === "running" || visionRendering;

  const visionDisabled =
    !activePdfFile ||
    !visionForwardReady ||
    !hasKey ||
    isRunning ||
    (urlInput.trim().length > 0 && !modelInput.trim());

  const canRunVisionParse = !visionDisabled;

  const unifiedParseDisabled = isRunning || !canRunVisionParse;

  const hintMessage = useMemo(() => {
    if (isRunning) {
      return null;
    }
    if (!hasKey) {
      return null;
    }
    if (visionBlockReasonKey) {
      return parseCapabilityUserMessage(visionBlockReasonKey);
    }
    if (!activePdfFile) {
      return isEmbedded
        ? "No PDF on file — replace or re-import the document."
        : "Add a PDF file to parse.";
    }
    if (urlInput.trim()) {
      if (!modelInput.trim()) {
        return "Enter a model id in Settings when using a custom API base URL.";
      }
    }
    return null;
  }, [
    hasKey,
    isRunning,
    visionBlockReasonKey,
    urlInput,
    modelInput,
    activePdfFile,
    isEmbedded,
  ]);

  const parseEstimate = useMemo(
    () =>
      estimateParseRun({
        pageCount: estimatePageCount ?? pageCount,
        extractedTextCharCount: estimateDocChars,
        parseStrategy,
        enableOcr,
        attachPageImage: effectiveAttachPageImage,
        visionBatchSequentialOnly: batchOnlyVisionParse,
      }),
    [
      estimatePageCount,
      pageCount,
      estimateDocChars,
      parseStrategy,
      enableOcr,
      effectiveAttachPageImage,
      batchOnlyVisionParse,
    ],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const setAttachPageImagePreference = useCallback((next: boolean) => {
    setAttachPageImage(next);
    persistAttachPageImageToStorage(next);
  }, []);

  const setEnableOcrPreference = useCallback((next: boolean) => {
    setEnableOcr(next);
    persistEnableOcrToStorage(next);
  }, []);

  const setParseStrategyPreference = useCallback((next: ParseStrategy) => {
    setParseStrategy(next);
    persistParseStrategyToStorage(next);
  }, []);

  const persistQuestions = useCallback(
    async (qs: Question[]) => {
      const bank: ApprovedBank = {
        version: 1,
        savedAt: new Date().toISOString(),
        questions: qs,
      };
      await putApprovedBankForStudySet(studySetId, bank);
      await touchStudySetMeta(studySetId, { status: "ready" });
      onBankPersisted?.();
    },
    [studySetId, onBankPersisted],
  );

  const persistFlashcardVisionItemsForImmediateUse = useCallback(
    async (
      items: FlashcardVisionItem[],
      generationConfig?: FlashcardGenerationConfig,
    ) => {
      const normalizedItems = items
        .map((item) => ({
          ...item,
          id: item.id?.trim().length ? item.id : createRandomUuid(),
        }))
        .filter(
          (it) => it.front.trim().length > 0 && it.back.trim().length > 0,
        );
      const savedAt = new Date().toISOString();
      const bank: ApprovedFlashcardBank = {
        version: 1,
        savedAt,
        items: normalizedItems,
      };
      await putApprovedFlashcardBankForStudySet(studySetId, bank);
      await putDraftFlashcardVisionItems(
        studySetId,
        normalizedItems,
        generationConfig,
      );
      await touchStudySetMeta(studySetId, { status: "ready" });
      onBankPersisted?.();
    },
    [studySetId, onBankPersisted],
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
      options?: {
        forceSkipOcr?: boolean;
        previewPageBudget?: number;
        /** Optional 1-based page indices to rasterize (Phase 29 routing). */
        pageIndices?: number[];
        onPreviewPagesAvailable?: (pages: PageImageResult[]) => void;
      },
    ): Promise<ParseRunResult | RenderOcrPrepared> => {
      const pages = await renderPdfPagesToImages(file, {
        signal: controller.signal,
        maxPages: VISION_MAX_PAGES_DEFAULT,
        pageIndices: options?.pageIndices,
        previewPageBudget: options?.previewPageBudget,
        onPreviewPagesAvailable: options?.onPreviewPagesAvailable,
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
      /** Learner create (`surface=product`): no OCR API prefetch — vision reads rasterized pages only. Developer + `/dev/ocr` keep `enableOcr` + toggles. */
      const forceSkipOcr = options?.forceSkipOcr === true;
      const enableOcrEffective =
        !forceSkipOcr &&
        enableOcr &&
        !isProductSurface &&
        studySetId.trim().length > 0 &&
        visionForwardReady;

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
      isProductSurface,
      studySetId,
      visionForwardReady,
      provider,
      urlInput,
      modelInput,
    ],
  );

  const extractTextForPageIndices = useCallback(
    async (file: File, indices: number[], signal: AbortSignal): Promise<string> => {
      if (indices.length === 0) {
        return "";
      }
      const sorted = [...indices].sort((a, b) => a - b);
      const runs: Array<{ start: number; end: number }> = [];
      let start = sorted[0];
      let end = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        const n = sorted[i];
        if (n === end + 1) {
          end = n;
        } else {
          runs.push({ start, end });
          start = n;
          end = n;
        }
      }
      runs.push({ start, end });

      let combined = "";
      for (const r of runs) {
        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        const part = await extractPdfTextForPageRange(file, r.start, r.end, signal);
        if (part.trim().length === 0) {
          continue;
        }
        combined += (combined ? "\n\n" : "") + part;
      }
      return combined;
    },
    [],
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
        } catch (e) {
          const err = normalizeUnknownError(e);
          pipelineLog("VISION", "ocr-snapshot", "warn", "getOcrResult failed", {
            studySetId: studySetId.trim() || "(empty)",
            error: err,
          });
          toast.warning(
            "Could not load the saved OCR snapshot; page mapping may be less precise.",
          );
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
        } catch (e) {
          const err = normalizeUnknownError(e);
          pipelineLog("MAPPING", "apply", "error", "applyQuestionPageMapping failed", {
            studySetId: studySetId.trim() || "(empty)",
            error: err,
            parsePath: "vision",
          });
          toast.error(
            "Page mapping failed; questions were still saved. Open Review to verify source pages.",
          );
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
      const baseSummary = parts.join(". ") + ".";

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
        setSummary(baseSummary);
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
        const { summary, uncertainCount } = appendUncertainMappingSummaryClause(
          baseSummary,
          result.questions,
        );
        if (uncertainCount > 0) {
          toast.warning(
            `${uncertainCount} question${uncertainCount === 1 ? "" : "s"} have uncertain or missing page mapping — open Review to verify.`,
          );
        }
        setSummary(summary);
      } else if (!fatal) {
        setSummary(baseSummary);
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

  const finalizeVisionBatchParseResult = useCallback(
    async (
      batchResult: RunVisionBatchSequentialResult,
      controller: AbortController,
      ocrForMapping: OcrRunResult | null,
      file: File,
      options?: { skipPersist?: boolean },
    ): Promise<ParseRunResult> => {
      let ocrSnapshot: OcrRunResult | null = ocrForMapping;
      if (studySetId.trim().length > 0) {
        try {
          ocrSnapshot =
            ocrSnapshot ?? (await getOcrResult(studySetId)) ?? null;
        } catch (e) {
          const err = normalizeUnknownError(e);
          pipelineLog("VISION", "ocr-snapshot", "warn", "getOcrResult failed (batch)", {
            studySetId: studySetId.trim() || "(empty)",
            error: err,
          });
          toast.warning(
            "Could not load the saved OCR snapshot; page mapping may be less precise.",
          );
        }
      }

      const aborted = controller.signal.aborted;

      if (parseOutputMode === "flashcard") {
        const flashItems = batchResult.items.filter(
          (it): it is FlashcardVisionItem => it.kind === "flashcard",
        );
        setQuestions([]);
        if (!aborted) {
          setParseOverlay((p) => ({
            ...p,
            log: [
              ...p.log,
              `${formatTimeStamp()} — Saving ${flashItems.length} flashcard${flashItems.length === 1 ? "" : "s"} to database...`,
            ],
          }));
          await persistFlashcardVisionItemsForImmediateUse(
            flashItems,
            resolvedFlashcardConfig,
          );
        }

        const n = flashItems.length;
        const parts = [
          `Vision (batch): parsed ${n} flashcard${n === 1 ? "" : "s"}`,
        ];
        if (batchResult.failedBatches > 0) {
          parts.push(
            `${batchResult.failedBatches} batch${batchResult.failedBatches === 1 ? "" : "es"} failed`,
          );
        }
        if (aborted) {
          parts.push("Parsing stopped.");
        }
        const baseSummary = parts.join(". ") + ".";

        if (!aborted && batchResult.failedBatches > 0 && n > 0) {
          toast.warning(
            "Some vision batches failed; open Review to verify card coverage.",
          );
        }

        if (!aborted) {
          setSummary(baseSummary);
        } else {
          setSummary(baseSummary);
        }

        return {
          ok: !aborted && n > 0,
          aborted,
          fatalError: null,
          questions: [],
          flashcardItems: flashItems,
          parseOutputMode: "flashcard",
          chunkParseDebug: {
            byChunk: [],
            reason: "vision_batch_parse" as const,
          },
          usedVisionFallback: false,
        };
      }

      const quizItems = batchResult.items.filter(
        (it): it is QuizVisionItem => it.kind === "quiz",
      );
      const questions = quizItems.map((it) => quizVisionItemToQuestion(it));

      if (studySetId.trim().length > 0) {
        try {
          applyQuestionPageMapping(questions, ocrSnapshot ?? null, {
            parseMode: "pair",
          });
        } catch (e) {
          const err = normalizeUnknownError(e);
          pipelineLog("MAPPING", "apply", "error", "applyQuestionPageMapping failed (batch)", {
            studySetId: studySetId.trim() || "(empty)",
            error: err,
            parsePath: "vision_batch",
          });
          toast.error(
            "Page mapping failed; questions were still saved. Open Review to verify source pages.",
          );
        }
      }

      setQuestions(questions);

      const n = questions.length;
      const parts = [
        `Vision (batch): parsed ${n} question${n === 1 ? "" : "s"}`,
      ];
      if (batchResult.failedBatches > 0) {
        parts.push(
          `${batchResult.failedBatches} batch${batchResult.failedBatches === 1 ? "" : "es"} failed`,
        );
      }
      if (aborted) {
        parts.push("Parsing stopped.");
      }
      const baseSummary = parts.join(". ") + ".";

      if (!aborted && batchResult.failedBatches > 0 && n > 0) {
        toast.warning(
          "Some vision batches failed; open Review to verify question coverage.",
        );
      }

      const skipPersist = options?.skipPersist === true;
      if (!aborted && !skipPersist) {
        setParseOverlay((p) => ({
          ...p,
          log: [
            ...p.log,
            `${formatTimeStamp()} — Saving ${questions.length} question${questions.length === 1 ? "" : "s"} to database...`,
          ],
        }));
        await persistQuestions(questions);
        const { summary, uncertainCount } = appendUncertainMappingSummaryClause(
          baseSummary,
          questions,
        );
        if (uncertainCount > 0) {
          toast.warning(
            `${uncertainCount} question${uncertainCount === 1 ? "" : "s"} have uncertain or missing page mapping — open Review to verify.`,
          );
        }
        setSummary(summary);
      } else {
        setSummary(baseSummary);
      }

      pipelineLog("VISION", "run", "info", "runVisionBatchSequential finished", {
        studySetId: studySetId.trim() || "(empty)",
        questionCount: questions.length,
        failedBatches: batchResult.failedBatches,
        ...fileSummary(file),
      });

      return {
        ok: !aborted && n > 0,
        aborted,
        fatalError: null,
        questions,
        parseOutputMode: "quiz",
        chunkParseDebug: {
          byChunk: [],
          reason: "vision_batch_parse" as const,
        },
        usedVisionFallback: false,
      };
    },
    [
      studySetId,
      parseOutputMode,
      persistQuestions,
      persistFlashcardVisionItemsForImmediateUse,
      resolvedFlashcardConfig,
    ],
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
      if (parseOutputMode === "flashcard") {
        throw new FatalParseError(
          "Flashcard study sets use vision batch only — layout chunk parse is disabled.",
        );
      }
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
        } catch (e) {
          const err = normalizeUnknownError(e);
          pipelineLog("VISION", "ocr-snapshot", "warn", "getOcrResult failed (layout)", {
            studySetId: studySetId.trim() || "(empty)",
            error: err,
          });
          toast.warning(
            "Could not load the saved OCR snapshot; page mapping may be less precise.",
          );
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
      const baseSummary = parts.join(" · ") + ".";

      if (!controller.signal.aborted) {
        await persistQuestions(merged);
        const { summary, uncertainCount } = appendUncertainMappingSummaryClause(
          baseSummary,
          merged,
        );
        if (uncertainCount > 0) {
          toast.warning(
            `${uncertainCount} question${uncertainCount === 1 ? "" : "s"} have uncertain or missing page mapping — open Review to verify.`,
          );
        }
        setSummary(summary);
      } else {
        setSummary(baseSummary);
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
      parseOutputMode,
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

  const handleVisionParse = useCallback(async (options?: {
    overlayPrefixLine?: string;
  }): Promise<ParseRunResult> => {
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

    const forwardProvider = getForwardOpenAiCompatKind();

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
      log: [
        ...(options?.overlayPrefixLine
          ? [`${timeStamp()} — ${options.overlayPrefixLine}`]
          : []),
        `${timeStamp()} — Preparing document for vision…`,
      ],
      renderPage: 0,
      renderTot: 0,
      thumbs: [],
    });

    const mustUseVisionBatch = batchOnlyVisionParse;

    try {
      flashVisionAccumRef.current = [];
      let previewVisionPromise: Promise<RunVisionBatchSequentialResult> | null =
        null;
      const previewBudgetClamped =
        mustUseVisionBatch && isProductSurface
          ? Math.min(5, Math.max(3, previewFirstPageBudget))
          : 0;

      // Phase 29 — quiz-only per-page routing before rasterization.
      // Flashcards remain vision-batch-only (no page routing yet).
      const routePlanRaw =
        parseOutputMode === "quiz"
          ? await classifyPdfPages(activePdfFile, {
              signal: controller.signal,
              previewFirstPageBudget:
                previewBudgetClamped > 0
                  ? previewBudgetClamped
                  : previewFirstPageBudget,
              visionMaxPages: VISION_MAX_PAGES_DEFAULT,
            })
          : null;
      const routePlan =
        routePlanRaw && routePlanRaw.pageCount > 0 ? routePlanRaw : null;
      if (routePlan && !controller.signal.aborted) {
        pipelineLog("PDF", "page-route", "info", "quiz page route plan", {
          studySetId: studySetId.trim() || "(empty)",
          pageCount: routePlan.pageCount,
          plannedPages: routePlan.pages.length,
          textPages: routePlan.textPageIndices.length,
          bitmapPages: routePlan.bitmapPageIndicesAll.length,
          bitmapForVision: routePlan.bitmapPageIndicesForVision.length,
          droppedBitmapPages: routePlan.droppedBitmapPagesCount,
        });
      }

      async function runBatchesOnPages(
        pageSlice: PageImageResult[],
        segment: "preview" | "rest",
      ): Promise<RunVisionBatchSequentialResult> {
        const plannedBatches = planVisionBatches(pageSlice, "min_requests");
        const batchTotal = Math.max(1, plannedBatches.length);
        const strategyHint =
          plannedBatches.length === 1 && pageSlice.length > 1
            ? isFlashcardParse
              ? `1 API request (all ${pageSlice.length} pages, overlap 0; theory flashcards, strict page citations)`
              : `1 API request (all ${pageSlice.length} pages, overlap 0; may fall back to 10+2 if it fails)`
            : `${plannedBatches.length} API request(s) (≤${VISION_MAX_PAGES_DEFAULT} pages/batch, overlap 0)`;
        setProgress({ current: 0, total: batchTotal, status: "running" });
        setParseOverlay((p) => ({
          ...p,
          log: [
            ...p.log,
            `${timeStamp()} — Vision batch parse · ${pageSlice.length} page image${pageSlice.length === 1 ? "" : "s"} · ${strategyHint}`,
          ].slice(-16),
        }));

        pipelineLog("VISION", "run", "info", "runVisionBatchSequential starting", {
          studySetId: studySetId.trim() || "(empty)",
          parseOutputMode,
          batchCount: plannedBatches.length,
          pageImages: pageSlice.length,
          segment,
        });

        if (parseOutputMode === "quiz" && segment === "preview") {
          setQuestions([]);
        }

        let extractedSoFar = 0;
        let batchTotalLive = batchTotal;
        return await runVisionBatchSequential({
          pages: pageSlice,
          mode: parseOutputMode,
          signal: controller.signal,
          forwardProvider,
          apiKey,
          apiUrl: urlInput,
          model: modelInput,
          flashcardGeneration: isFlashcardParse
            ? resolvedFlashcardConfig
            : undefined,
          onBatchPlanResolved: ({ batches, reason }) => {
            batchTotalLive = Math.max(1, batches.length);
            setProgress((prev) => ({
              ...prev,
              current: 0,
              total: batchTotalLive,
              status: "running",
            }));
            if (reason === "legacy_fallback") {
              setParseOverlay((p) => ({
                ...p,
                log: [
                  ...p.log,
                  `${timeStamp()} — Retrying vision with legacy windows (${batches.length} request${batches.length === 1 ? "" : "s"}, 10+overlap2)`,
                ].slice(-16),
              }));
            }
          },
          onItemsExtracted: (items, meta) => {
            extractedSoFar += items.length;
            setProgress({
              current: meta.batchIndex + 1,
              total: batchTotalLive,
              status: "running",
            });
            if (parseOutputMode === "quiz") {
              const qs = items
                .filter((it): it is QuizVisionItem => it.kind === "quiz")
                .map((it) => quizVisionItemToQuestion(it));
              setQuestions((prev) => dedupeQuestionsByStem([...prev, ...qs]));
            } else if (parseOutputMode === "flashcard") {
              const fc = items.filter(
                (it): it is FlashcardVisionItem => it.kind === "flashcard",
              );
              flashVisionAccumRef.current = dedupeVisionItems(
                [...flashVisionAccumRef.current, ...fc],
                "flashcard",
              ).filter((it): it is FlashcardVisionItem => it.kind === "flashcard");
              void persistFlashcardVisionItemsForImmediateUse(
                flashVisionAccumRef.current,
                resolvedFlashcardConfig,
              );
            }
            setParseOverlay((p) => ({
              ...p,
              extractedCount: extractedSoFar,
              log: [
                ...p.log,
                `${timeStamp()} — Batch ${meta.batchIndex + 1}/${batchTotalLive} (p.${meta.startPage}–${meta.endPage}) · +${items.length} item${items.length === 1 ? "" : "s"}${meta.cacheHit ? " · cache" : ""} · ~${extractedSoFar} raw (deduped at end)`,
              ].slice(-16),
            }));
          },
        });
      }

      // Quiz lane: if page routing says we have text pages, parse them without rasterization.
      // Bitmap pages (if any) get rasterized/vision-parsed, capped by routePlan.bitmapPageIndicesForVision.
      let routedTextQuestions: Question[] = [];
      if (
        parseOutputMode === "quiz" &&
        routePlan &&
        routePlan.textPageIndices.length > 0 &&
        !controller.signal.aborted
      ) {
        setParseMode("chunk");
        setVisionRendering(false);
        setParseOverlay((p) => ({
          ...p,
          log: [
            ...p.log,
            `${timeStamp()} — Routing: parsing ${routePlan.textPageIndices.length} text page(s) without rasterization`,
          ].slice(-16),
        }));
        const text = await extractTextForPageIndices(
          activePdfFile,
          routePlan.textPageIndices,
          controller.signal,
        );
        if (!controller.signal.aborted && text.trim().length > 0) {
          const chunks = chunkText(text);
          setProgress({
            current: 0,
            total: Math.max(1, chunks.length),
            status: "running",
          });
          const result = await runSequentialParse({
            provider,
            apiKey: keyInput.trim(),
            apiUrl: urlInput,
            model: modelInput,
            chunks,
            signal: controller.signal,
            onProgress: ({ current, total }) => {
              setProgress({ current, total, status: "running" });
              setParseOverlay((p) => ({
                ...p,
                log: [
                  ...p.log,
                  `${formatTimeStamp()} — Text parse ${current}/${total}`,
                ].slice(-16),
              }));
            },
          });
          if (result.fatalError) {
            setError(result.fatalError);
            return {
              ok: false,
              aborted: controller.signal.aborted,
              fatalError: result.fatalError,
              questions: result.questions,
              parseOutputMode: "quiz",
            };
          }
          routedTextQuestions = result.questions;
        }
      }

      const bitmapIndicesForVision =
        parseOutputMode === "quiz" && routePlan
          ? routePlan.bitmapPageIndicesForVision
          : null;

      if (
        parseOutputMode === "quiz" &&
        routePlan &&
        (!bitmapIndicesForVision || bitmapIndicesForVision.length === 0)
      ) {
        const merged = dedupeQuestionsByStem(routedTextQuestions);
        setQuestions(merged);
        if (!controller.signal.aborted) {
          await persistQuestions(merged);
          setSummary(`Routed (text-only): parsed ${merged.length} question${merged.length === 1 ? "" : "s"}.`);
        } else {
          setSummary(
            `Routed (text-only): parsed ${merged.length} question${merged.length === 1 ? "" : "s"}. Parsing stopped.`,
          );
        }
        return {
          ok: !controller.signal.aborted && merged.length > 0,
          aborted: controller.signal.aborted,
          fatalError: null,
          questions: merged,
          parseOutputMode: "quiz",
          usedVisionFallback: false,
        };
      }

      const prep = await runRenderPagesAndOptionalOcr(
        activePdfFile,
        controller,
        apiKey,
        forwardProvider,
        timeStamp,
        "vision",
        {
          forceSkipOcr: isFlashcardParse || isQuizParse || isProductSurface,
          previewPageBudget:
            previewBudgetClamped > 0 ? previewBudgetClamped : undefined,
          pageIndices:
            bitmapIndicesForVision && bitmapIndicesForVision.length > 0
              ? bitmapIndicesForVision
              : undefined,
          onPreviewPagesAvailable:
            previewBudgetClamped > 0
              ? (early) => {
                  if (early.length === 0) {
                    return;
                  }
                  previewVisionPromise = runBatchesOnPages(early, "preview");
                }
              : undefined,
        },
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

      if (mustUseVisionBatch) {
        let batchResult: RunVisionBatchSequentialResult;
        if (previewBudgetClamped <= 0) {
          batchResult = await runBatchesOnPages(pages, "preview");
        } else {
          const earlyRes = previewVisionPromise
            ? await previewVisionPromise
            : null;
          const restPages =
            pages.length > previewBudgetClamped
              ? pages.slice(previewBudgetClamped)
              : [];
          const restRes =
            restPages.length > 0
              ? await runBatchesOnPages(restPages, "rest")
              : null;
          if (earlyRes && restRes) {
            batchResult = mergeVisionBatchSequentialResults(
              earlyRes,
              restRes,
              parseOutputMode,
            );
          } else if (earlyRes) {
            batchResult = earlyRes;
          } else if (restRes) {
            batchResult = restRes;
          } else {
            batchResult = await runBatchesOnPages(pages, "preview");
          }
        }

        // Progress: Dedupe and validation stage
        setParseOverlay((p) => ({
          ...p,
          log: [
            ...p.log,
            `${timeStamp()} — Deduplicating and validating...`,
          ],
        }));

        const visionOnly = await finalizeVisionBatchParseResult(
          batchResult,
          controller,
          ocrForMapping,
          activePdfFile,
          parseOutputMode === "quiz" && routePlan ? { skipPersist: true } : undefined,
        );
        if (parseOutputMode === "quiz" && routePlan) {
          const merged = dedupeQuestionsByStem([
            ...routedTextQuestions,
            ...visionOnly.questions,
          ]);
          setQuestions(merged);
          if (!controller.signal.aborted) {
            await persistQuestions(merged);
          }
          return {
            ...visionOnly,
            questions: merged,
            ok: !controller.signal.aborted && merged.length > 0,
          };
        }

        // Progress: Completion stage
        if (!controller.signal.aborted) {
          setParseOverlay((p) => ({
            ...p,
            log: [
              ...p.log,
              `${timeStamp()} — Done! Redirecting to review...`,
            ],
          }));
        }

        return visionOnly;
      }

      // Non-product surfaces may still support sequential attach parsing.
      const attachEffective =
        effectiveAttachPageImage && studySetId.trim().length > 0;
      const { result, attachEffective: attachSeq } =
        await runVisionSequentialWithUi(
          pages,
          controller,
          forwardProvider,
          apiKey,
          timeStamp,
        );
      return await finalizeVisionParseResult(
        result,
        pages,
        attachSeq && attachEffective,
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
    effectiveAttachPageImage,
    parseOutputMode,
    urlInput,
    runRenderPagesAndOptionalOcr,
    runVisionSequentialWithUi,
    finalizeVisionParseResult,
    finalizeVisionBatchParseResult,
    isFlashcardParse,
    isQuizParse,
    isProductSurface,
    resolvedFlashcardConfig,
    batchOnlyVisionParse,
    previewFirstPageBudget,
    persistQuestions,
    persistFlashcardVisionItemsForImmediateUse,
    extractTextForPageIndices,
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

      if (parseOutputMode === "flashcard") {
        pipelineLog("VISION", "flashcard-guard", "info", "layout parse blocked; using vision batch", {
          studySetId: studySetId.trim() || "(empty)",
        });
        return handleVisionParse();
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
      const forwardProvider = getForwardOpenAiCompatKind();

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
      enableOcr,
      studySetId,
      handleVisionParse,
      runRenderPagesAndOptionalOcr,
      runVisionSequentialWithUi,
      finalizeVisionParseResult,
      runLayoutChunkPipelineFromPrepared,
      parseOutputMode,
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

    if (parseOutputMode === "flashcard") {
      pipelineLog("VISION", "flashcard-guard", "info", "hybrid parse blocked; using vision batch", {
        studySetId: studySetId.trim() || "(empty)",
      });
      return handleVisionParse();
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
    const forwardProvider = getForwardOpenAiCompatKind();

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
    enableOcr,
    studySetId,
    handleVisionParse,
    runRenderPagesAndOptionalOcr,
    runVisionSequentialWithUi,
    finalizeVisionParseResult,
    runLayoutChunkPipelineFromPrepared,
    parseOutputMode,
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
          visionBlockReasonKey
            ? parseCapabilityUserMessage(visionBlockReasonKey)
            : "Configure AI in Settings — PDF parsing uses vision (page images).",
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

      if (urlInput.trim() && !modelInput.trim()) {
        setError("Enter a model id in Settings when using a custom API base URL.");
        return {
          ok: false,
          aborted: false,
          fatalError: null,
          questions: [],
        };
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

      const pushOverlayLog = (line: string) => {
        setParseOverlay((p) => ({
          ...p,
          log: [...p.log, `${formatTimeStamp()} — ${line}`].slice(-16),
        }));
      };

      let extractedTextCharCount = 0;
      let pageCountForPolicy: number | null = pageCount;
      if (studySetId.trim().length > 0) {
        try {
          const doc = await getDocument(studySetId.trim());
          extractedTextCharCount = doc?.extractedText?.length ?? 0;
          if (pageCountForPolicy == null) {
            const meta = await getStudySetMeta(studySetId.trim());
            pageCountForPolicy = meta?.pageCount ?? null;
          }
        } catch (raw) {
          pipelineLog("VISION", "policy-input", "warn", "document_read_failed", {
            studySetId: studySetId.trim(),
            ...normalizeUnknownError(raw),
          });
        }
      }

      const preRouteController = new AbortController();
      abortRef.current = preRouteController;

      let sampledSignal:
        | {
            sampledPages: number;
            charsPerPage: number;
            nonEmptyPageRatio: number;
          }
        | undefined = undefined;

      if (isQuizParse) {
        pushOverlayLog("Sampling text layer (first pages)...");
        const s = await sampleTextLayerSignal(activePdfFile, {
          signal: preRouteController.signal,
          samplePages: 5,
        });
        sampledSignal = {
          sampledPages: s.sampledPages,
          charsPerPage: s.charsPerPage,
          nonEmptyPageRatio: s.nonEmptyPageRatio,
        };
      }

      const routeDecision = decideParseRoute({
        pageCount: pageCountForPolicy,
        extractedTextCharCount,
        textLayerSignal: sampledSignal,
        parseStrategy,
        enableOcr,
      });
      pipelineLog("VISION", "pre-route", "info", "parse route policy", {
        studySetId: studySetId.trim(),
        parseRoutePolicy: {
          executionFamily: routeDecision.executionFamily,
          reasonCodes: [...routeDecision.reasonCodes],
        },
        extractedTextCharCount,
        pageCount: pageCountForPolicy,
        textLayerSignal: sampledSignal,
      });

      if (isQuizParse) {
        setDocumentHint(
          routeDecision.reasonCodes.includes(TEXT_LAYER_STRONG)
            ? "strong_text_layer"
            : "none",
        );
      }

      /*
       * D-28: wall clock for the whole user-triggered parse (after successful onBeforeParse)
       * through terminal handlers — includes vision fallback, attachPageImages, persistQuestions
       * when executed inside the same invoked parse for Fast/Hybrid chunk path.
       */
      const runWallT0 = performance.now();
      let routed: ParseRunResult;
      if (parseOutputMode === "flashcard") {
        routed = await handleVisionParse();
      } else if (
        isQuizParse &&
        parseStrategy !== "accurate" &&
        routeDecision.reasonCodes.includes(TEXT_LAYER_STRONG) &&
        !routeDecision.reasonCodes.includes(TEXT_LAYER_UNCERTAIN_DEFAULT_VISION)
      ) {
        // Phase 25 — quiz text-first lane (skip rasterization when text is strong).
        const controller = new AbortController();
        abortRef.current = controller;
        setParseMode("chunk");
        setVisionRendering(false);
        setProgress({ current: 0, total: 1, status: "running" });
        setParseOverlay({
          extractedCount: 0,
          log: [],
          renderPage: 0,
          renderTot: 0,
          thumbs: [],
        });
        pushOverlayLog(
          `Using text layer — skipping page images. [${routeDecision.reasonCodes.join(
            ",",
          )}]`,
        );

        try {
          let fullText = "";
          if (studySetId.trim().length > 0) {
            const doc = await getDocument(studySetId.trim());
            fullText = doc?.extractedText ?? "";
          }

          if (controller.signal.aborted) {
            return {
              ok: false,
              aborted: true,
              fatalError: null,
              questions: [],
            };
          }

          const pc =
            pageCountForPolicy && pageCountForPolicy > 0
              ? pageCountForPolicy
              : 1;
          const pageBudget = Math.min(
            5,
            Math.max(3, previewFirstPageBudget),
            pc,
          );

          let qs: Question[] = [];

          if (!fullText.trim()) {
            const previewText = await extractPdfTextForPageRange(
              activePdfFile,
              1,
              pageBudget,
              controller.signal,
            );
            if (controller.signal.aborted) {
              return {
                ok: false,
                aborted: true,
                fatalError: null,
                questions: [],
              };
            }
            const restText =
              pageBudget < pc
                ? await extractPdfTextForPageRange(
                    activePdfFile,
                    pageBudget + 1,
                    pc,
                    controller.signal,
                  )
                : "";
            if (controller.signal.aborted) {
              return {
                ok: false,
                aborted: true,
                fatalError: null,
                questions: [],
              };
            }

            const chunksPreview = chunkText(previewText);
            const chunksRest = pageBudget < pc ? chunkText(restText) : [];
            const totalChunks = chunksPreview.length + chunksRest.length;

            setProgress({
              current: 0,
              total: Math.max(1, totalChunks),
              status: "running",
            });
            pushOverlayLog(
              `Text chunks · preview ${chunksPreview.length} · rest ${chunksRest.length} · pages 1–${pageBudget}${pageBudget < pc ? ` then ${pageBudget + 1}–${pc}` : ""}`,
            );

            const runPass = async (chunks: string[], chunkOffset: number) =>
              runSequentialParse({
                provider,
                apiKey: keyInput.trim(),
                apiUrl: urlInput,
                model: modelInput,
                chunks,
                signal: controller.signal,
                onProgress: ({ current }) => {
                  setProgress({
                    current: chunkOffset + current,
                    total: Math.max(1, totalChunks),
                    status: "running",
                  });
                  setParseOverlay((p) => ({
                    ...p,
                    log: [
                      ...p.log,
                      `${formatTimeStamp()} — Text parse ${chunkOffset + current}/${totalChunks}`,
                    ].slice(-16),
                  }));
                },
              });

            const previewResult = await runPass(chunksPreview, 0);
            if (previewResult.fatalError) {
              setError(previewResult.fatalError);
              return {
                ok: false,
                aborted: controller.signal.aborted,
                fatalError: previewResult.fatalError,
                questions: previewResult.questions,
                parseOutputMode: "quiz",
              };
            }
            qs = dedupeQuestionsByStem(previewResult.questions);
            if (qs.length > 0) {
              await persistQuestions(qs);
              setQuestions(qs);
            }

            if (chunksRest.length > 0 && !controller.signal.aborted) {
              const restResult = await runPass(chunksRest, chunksPreview.length);
              if (restResult.fatalError) {
                setError(restResult.fatalError);
                return {
                  ok: false,
                  aborted: controller.signal.aborted,
                  fatalError: restResult.fatalError,
                  questions: qs,
                  parseOutputMode: "quiz",
                };
              }
              qs = dedupeQuestionsByStem([...qs, ...restResult.questions]);
              setQuestions(qs);
              if (!controller.signal.aborted) {
                await persistQuestions(qs);
              }
            }
          } else {
            const chunks = chunkText(fullText);
            setProgress({
              current: 0,
              total: Math.max(1, chunks.length),
              status: "running",
            });
            pushOverlayLog(
              `Text chunks ready · chunks=${chunks.length} · running sequential parse...`,
            );

            const result = await runSequentialParse({
              provider,
              apiKey: keyInput.trim(),
              apiUrl: urlInput,
              model: modelInput,
              chunks,
              signal: controller.signal,
              onProgress: ({ current, total }) => {
                setProgress({ current, total, status: "running" });
                setParseOverlay((p) => ({
                  ...p,
                  log: [
                    ...p.log,
                    `${formatTimeStamp()} — Text parse ${current}/${total}`,
                  ].slice(-16),
                }));
              },
            });

            if (result.fatalError) {
              setError(result.fatalError);
              return {
                ok: false,
                aborted: controller.signal.aborted,
                fatalError: result.fatalError,
                questions: result.questions,
                parseOutputMode: "quiz",
              };
            }

            qs = result.questions;
            setQuestions(qs);
          }

          if (controller.signal.aborted) {
            setSummary(`Text-first: parsed ${qs.length} questions. Parsing stopped.`);
            return {
              ok: false,
              aborted: true,
              fatalError: null,
              questions: qs,
              parseOutputMode: "quiz",
              usedVisionFallback: false,
            };
          }

          // Phase 25 — deterministic quality gate (no external calls).
          const questionCount = qs.length;
          const validMcqCount = qs.reduce(
            (n, q) => n + (isMcqComplete(q) ? 1 : 0),
            0,
          );
          const validRatio =
            questionCount > 0 ? validMcqCount / questionCount : 0;
          const gateFailed =
            questionCount < 5 || (questionCount > 0 && validRatio < 0.6);

          pipelineLog("VISION", "quality-gate", "info", "quiz text-first quality gate", {
            studySetId: studySetId.trim() || "(empty)",
            questionCount,
            validMcqCount,
            validRatio,
          });

          if (gateFailed) {
            toast("Text parse looked weak — retrying with vision.");
            const overlayLine = `Text parse looked weak — retrying with vision. [quality_gate_failed q=${questionCount} validRatio=${validRatio.toFixed(
              2,
            )}] [${routeDecision.reasonCodes.join(",")}]`;
            pipelineLog("VISION", "quality-gate", "warn", "text-first gate failed; vision fallback", {
              studySetId: studySetId.trim() || "(empty)",
              questionCount,
              validMcqCount,
              validRatio,
              reasonCodes: [...routeDecision.reasonCodes],
            });
            const visionResult = await handleVisionParse({
              overlayPrefixLine: overlayLine,
            });
            return { ...visionResult, usedVisionFallback: true };
          }

          pushOverlayLog(
            `Saving ${qs.length} question${qs.length === 1 ? "" : "s"}...`,
          );
          await persistQuestions(qs);
          setSummary(`Text-first: parsed ${qs.length} questions.`);

          return {
            ok: !controller.signal.aborted && qs.length > 0,
            aborted: controller.signal.aborted,
            fatalError: null,
            questions: qs,
            parseOutputMode: "quiz",
            usedVisionFallback: false,
          };
        } catch (e) {
          pipelineLog("VISION", "parse-error", "error", "quiz text-first lane threw", {
            studySetId: studySetId.trim() || "(empty)",
            ...fileSummary(activePdfFile),
            ...normalizeUnknownError(e),
            raw: e,
            isAbort: e instanceof DOMException && e.name === "AbortError",
          });
          if (e instanceof DOMException && e.name === "AbortError") {
            setSummary("Text parsing stopped.");
          } else {
            setError(
              e instanceof Error ? e.message : "Text parsing failed. Try vision.",
            );
          }
          return {
            ok: false,
            aborted: e instanceof DOMException && e.name === "AbortError",
            fatalError: null,
            questions: [],
            parseOutputMode: "quiz",
          };
        } finally {
          abortRef.current = null;
          setParseMode(null);
          setProgress((p) => ({ ...p, status: "idle" }));
          setParseOverlay({
            extractedCount: 0,
            log: [],
            renderPage: 0,
            renderTot: 0,
            thumbs: [],
          });
        }
      } else if (parseStrategy === "accurate") {
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
      keyInput,
      visionForwardReady,
      visionBlockReasonKey,
      activePdfFile,
      provider,
      urlInput,
      modelInput,
      hasCustomEndpoint,
      hasCustomModel,
      parseStrategy,
      enableOcr,
      pageCount,
      studySetId,
      persistQuestions,
      handleVisionParse,
      handleHybridParse,
      handleLayoutAwareParse,
      parseOutputMode,
      isQuizParse,
      previewFirstPageBudget,
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
    if (!isEmbedded || !autoStartWhenBankEmpty) {
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
    autoStartWhenBankEmpty,
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
    !isFlashcardParse &&
    attachPageImage &&
    studySetId.trim().length > 0;

  const showInlineProgress = !isEmbedded && isRunning;

  return (
    <section
      className="space-y-6"
      aria-labelledby={isEmbedded ? undefined : "ai-parse-heading"}
    >
      {!isEmbedded ? (
        <>
          <AiParseSectionHeader hasKey={hasKey} />
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
          {isProductSurface ? (
            isFlashcardParse ? null : (
            <details className="rounded-lg border border-border bg-muted/20 p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Advanced
              </summary>
              <div className="mt-3 space-y-3">
                <AiParseParseStrategyPanel
                  parseStrategy={parseStrategy}
                  parseStrategyGroupId={parseStrategyGroupId}
                  onSelectStrategy={setParseStrategyPreference}
                  documentHint={documentHint}
                />
                <AiParseEstimatePanel estimate={parseEstimate} />
              </div>
            </details>
            )
          ) : (
            <>
              {!isFlashcardParse ? (
                <>
                  <AiParsePreferenceToggles
                    attachCheckboxId={attachCheckboxId}
                    ocrCheckboxId={ocrCheckboxId}
                    attachPageImage={attachPageImage}
                    enableOcr={enableOcr}
                    showAttach={!batchOnlyVisionParse}
                    onAttachChange={(e) =>
                      setAttachPageImagePreference(e.target.checked)
                    }
                    onOcrChange={(e) => setEnableOcrPreference(e.target.checked)}
                  />
                  <AiParseParseStrategyPanel
                    parseStrategy={parseStrategy}
                    parseStrategyGroupId={parseStrategyGroupId}
                    onSelectStrategy={setParseStrategyPreference}
                    documentHint={documentHint}
                  />
                </>
              ) : null}
              {!isProductSurface && isFlashcardParse ? (
                <AiParseEstimatePanel estimate={parseEstimate} />
              ) : null}
            </>
          )}
        </>
      ) : hasKey && activePdfFile ? (
        isEmbedded && isProductSurface ? null : (
        <div className="space-y-3">
          {isProductSurface ? (
            isFlashcardParse ? null : (
            <details className="rounded-lg border border-border bg-muted/20 p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Advanced
              </summary>
              <div className="mt-3 space-y-3">
                <AiParseParseStrategyPanel
                  parseStrategy={parseStrategy}
                  parseStrategyGroupId={parseStrategyGroupId}
                  onSelectStrategy={setParseStrategyPreference}
                  documentHint={documentHint}
                />
                <AiParseEstimatePanel estimate={parseEstimate} />
              </div>
            </details>
            )
          ) : (
            <>
              {!isFlashcardParse ? (
                <>
                  <AiParsePreferenceToggles
                    attachCheckboxId={attachCheckboxId}
                    ocrCheckboxId={ocrCheckboxId}
                    attachPageImage={attachPageImage}
                    enableOcr={enableOcr}
                    showAttach={!batchOnlyVisionParse}
                    onAttachChange={(e) =>
                      setAttachPageImagePreference(e.target.checked)
                    }
                    onOcrChange={(e) => setEnableOcrPreference(e.target.checked)}
                  />
                  <AiParseParseStrategyPanel
                    parseStrategy={parseStrategy}
                    parseStrategyGroupId={parseStrategyGroupId}
                    onSelectStrategy={setParseStrategyPreference}
                    documentHint={documentHint}
                  />
                </>
              ) : null}
              <AiParseEstimatePanel estimate={parseEstimate} />
            </>
          )}
        </div>
        )
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
            {/* Quiz and flashcard product lanes never reach ocr/chunk modes (forceSkipOcr). */}
            {visionRendering
              ? "Rendering PDF pages as images…"
              : parseMode === "chunk"
                ? `Parsing text… ${progress.current} / ${progress.total}`
                : parseMode === "ocr"
                  ? `OCR text extraction… ${progress.current} / ${progress.total} pages`
                  : isProductSurface || parseOutputMode === "quiz"
                    ? `Parsing with vision… ${progress.current} / ${progress.total} steps`
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

      {isEmbedded && isRunning && !suppressEmbeddedRunningProgress ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm font-medium text-primary">
            {/* Quiz and flashcard product lanes never reach ocr/chunk modes (forceSkipOcr). */}
            {visionRendering
              ? "Rendering PDF pages as images…"
              : parseMode === "chunk"
                ? `Parsing text… ${progress.current} / ${progress.total}`
                : parseMode === "ocr"
                  ? `OCR text extraction… ${progress.current} / ${progress.total} pages`
                  : isProductSurface || parseOutputMode === "quiz"
                    ? `Parsing with vision… ${progress.current} / ${progress.total} steps`
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
              {!isProductSurface && terminalParseRun.usedVisionFallback ? (
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
              {!isProductSurface && terminalParseRun.usedVisionFallback ? (
                <p className="text-sm text-muted-foreground">
                  Includes full-page vision fallback.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {!isEmbedded ? (
        <QuestionPreviewList
          questions={questions}
          onSetCorrectIndex={handlePreviewSetCorrectIndex}
        />
      ) : null}

      {!isEmbedded && hasKey && activePdfFile ? (
        <AiParseEstimatePanel estimate={parseEstimate} />
      ) : null}

      {!isEmbedded ? (
        <AiParseActions
          isRunning={isRunning}
          unifiedParseDisabled={unifiedParseDisabled}
          onParse={handleUnifiedParse}
          onCancel={handleCancel}
        />
      ) : null}
    </section>
  );
});

export function countIncompleteMcqs(questions: Question[]): number {
  return questions.reduce((n, q) => n + (isMcqComplete(q) ? 0 : 1), 0);
}
