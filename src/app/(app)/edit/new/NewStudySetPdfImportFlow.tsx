"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AiParseSection,
  type AiParseSectionHandle,
  type ParseRunResult,
} from "@/components/ai/AiParseSection";
import { useParseProgress } from "@/components/ai/ParseProgressContext";
import { ParseProgressStrip } from "@/components/layout/ParseProgressStrip";
import { ImportQuizLivePanel } from "@/components/edit/new/import/ImportQuizLivePanel";
import { NewImportPdfViewer } from "@/components/edit/new/import/NewImportPdfViewer";
import { UnifiedImportStatusCard } from "@/components/edit/new/import/UnifiedImportStatusCard";
import type { NewStudySetPdfImportPhase } from "@/components/edit/new/import/newStudySetPdfImportPhase";
import {
  FlashcardsImportDeckSkeleton,
  flashcardsImportSkeletonCount,
} from "@/components/edit/new/flashcards/FlashcardsImportDeckSkeleton";
import { useStudySetNewImportStepOptional } from "@/components/edit/new/import/StudySetNewImportStepContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/buttons/button";
import { UploadBox } from "@/components/upload/UploadBox";
import {
  createStudySetEarlyMeta,
  deleteStudySet,
  enrichStudySetDocumentFromLocalPdf,
  ensureStudySetDb,
} from "@/lib/db/studySetDb";
import {
  fileSummary,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { cn } from "@/lib/utils";
import { getPdfPageCount } from "@/lib/pdf/getPdfPageCount";
import { PREVIEW_FIRST_PAGE_BUDGET } from "@/lib/pdf/extractText";
import { isMcqComplete } from "@/lib/review/validateMcq";
import type { PdfValidationError } from "@/lib/pdf/validatePdfFile";
import type { StudyContentKind } from "@/types/studySet";
import {
  DEFAULT_FLASHCARD_GENERATION_CONFIG,
  type FlashcardGenerationConfig,
} from "@/types/flashcardGeneration";
import { parseOutputModeFromContentKind } from "@/types/visionParse";
import { FlashcardsGenerationControls } from "@/components/edit/new/flashcards/FlashcardsGenerationControls";
import {
  runBackgroundStudySetPdfUpload,
  type RunBackgroundStudySetPdfUploadResult,
} from "@/lib/uploads/runBackgroundStudySetPdfUpload";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

function provisionalTitleFromPdfFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "New study set";
  }
  const noExt = trimmed.replace(/\.pdf$/i, "").trim();
  const base = noExt.length > 0 ? noExt : trimmed;
  return base.slice(0, 80);
}

function userMessageForImportFailure(phase: NewStudySetPdfImportPhase): string {
  if (phase === "idb") {
    return "Could not access on-device storage. Check that this site can use storage, then try again.";
  }
  if (phase === "persist") {
    return "Could not save your study set. The PDF was read, but saving failed—try again or free up browser storage.";
  }
  return "Could not open this PDF. Check the file is valid and try again.";
}

export type NewStudySetPdfImportFlowProps = {
  contentKind: StudyContentKind;
  pageHeading: string;
  pageSubcopy: string;
  /**
   * After a successful inline AI parse (default `runAiParseOnNewPage`).
   * Required when `runAiParseOnNewPage` is not `false`.
   */
  getPostParseHref?: (studySetId: string) => string;
  /**
   * When false, skip inline parse and navigate with `getPostCreateHref` after save (e.g. dev OCR lab).
   * @default true
   */
  runAiParseOnNewPage?: boolean;
  /** Used when `runAiParseOnNewPage` is false. */
  getPostCreateHref?: (studySetId: string) => string;
  titlePrefix?: string;
};

type ParseContextState = {
  studySetId: string;
  file: File;
  pageCount: number;
};

function isStubObjectStorageFinalizeMessage(message: string | undefined): boolean {
  return (
    typeof message === "string" &&
    /not available yet for this deployment/i.test(message)
  );
}

/**
 * D-07 / D-13: when direct-upload is in use, require a terminal successful transfer
 * before study/play navigation; local-only (`skipped`) stays unrestricted.
 * Stub finalize copy (pre-real-object-storage deployments) is treated as settled for navigation (27-02).
 */
function isUploadCompleteForStudyNavigation(
  result: RunBackgroundStudySetPdfUploadResult,
): boolean {
  if (result.kind === "skipped" || result.kind === "completed") {
    return true;
  }
  if (result.kind === "error") {
    return isStubObjectStorageFinalizeMessage(result.message);
  }
  return false;
}

function parseRunHasUsableOutput(
  r: ParseRunResult,
  contentKind: StudyContentKind,
): boolean {
  const mode = parseOutputModeFromContentKind(contentKind);
  if (mode === "flashcard") {
    return (r.flashcardItems?.filter(
      (item) => item.front.trim().length > 0 && item.back.trim().length > 0,
    ).length ?? 0) > 0;
  }
  return r.questions.filter(isMcqComplete).length > 0;
}

export function NewStudySetPdfImportFlow({
  contentKind,
  pageHeading,
  pageSubcopy,
  getPostParseHref,
  runAiParseOnNewPage = true,
  getPostCreateHref,
  titlePrefix,
}: NewStudySetPdfImportFlowProps) {
  const router = useRouter();
  const { live, clearParse, reportUpload, clearUpload } = useParseProgress();
  const importStepCtx = useStudySetNewImportStepOptional();
  const setImportHeaderStep = importStepCtx?.setStep;
  const reduceMotion = useReducedMotion();

  const parseRef = useRef<AiParseSectionHandle>(null);
  const parseContextRef = useRef<ParseContextState | null>(null);
  const parseKickGen = useRef(0);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadEffectPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const uploadEffectResultRef = useRef<RunBackgroundStudySetPdfUploadResult | null>(
    null,
  );

  const [ingestBusy, setIngestBusy] = useState(false);
  const [importPhase, setImportPhase] = useState<NewStudySetPdfImportPhase>("idb");
  const [loadingFileName, setLoadingFileName] = useState<string | null>(null);
  const [ingestPreviewFile, setIngestPreviewFile] = useState<File | null>(null);
  const [ingestPageCount, setIngestPageCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseContext, setParseContext] = useState<ParseContextState | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [flashcardGenerationConfig, setFlashcardGenerationConfig] =
    useState<FlashcardGenerationConfig>(DEFAULT_FLASHCARD_GENERATION_CONFIG);

  useEffect(() => {
    parseContextRef.current = parseContext;
  }, [parseContext]);

  const inFlow = ingestBusy || parseContext !== null;
  useEffect(() => {
    setImportHeaderStep?.(inFlow ? "ingest" : "upload");
  }, [inFlow, setImportHeaderStep]);

  const parsing =
    Boolean(parseContext) &&
    Boolean(live?.running && live.studySetId === parseContext?.studySetId);

  const resetAfterInlineParse = useCallback(async () => {
    parseKickGen.current += 1;
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    parseRef.current?.cancel();
    const id = parseContextRef.current?.studySetId;
    if (id) {
      try {
        await deleteStudySet(id);
      } catch (raw) {
        pipelineLog("STUDY_SET", "new-import", "error", "deleteStudySet after cancel", {
          studySetId: id,
          ...normalizeUnknownError(raw),
          raw,
        });
      }
      clearParse(id);
      clearUpload(id);
    } else {
      clearParse();
      clearUpload();
    }
    setParseContext(null);
    parseContextRef.current = null;
    setParseError(null);
    setImportPhase("idb");
    setLoadingFileName(null);
    setIngestPreviewFile(null);
    setIngestPageCount(null);
    setFlashcardGenerationConfig(DEFAULT_FLASHCARD_GENERATION_CONFIG);
  }, [clearParse, clearUpload]);

  const handleParseFinished = useCallback(
    (r: ParseRunResult) => {
      const ctx = parseContextRef.current;
      if (!ctx) {
        return;
      }
      const { studySetId: id } = ctx;

      if (r.aborted) {
        return;
      }

      if (!runAiParseOnNewPage || !getPostParseHref) {
        return;
      }

      if (r.ok && parseRunHasUsableOutput(r, contentKind)) {
        clearParse(id);
        void (async () => {
          await uploadEffectPromiseRef.current;
          if (parseContextRef.current?.studySetId !== id) {
            return;
          }
          const ur = uploadEffectResultRef.current;
          const uploadComplete =
            ur !== null && isUploadCompleteForStudyNavigation(ur);
          if (!uploadComplete) {
            if (ur?.kind !== "aborted") {
              toast.error("Transfer did not finish. Starting over.");
              await resetAfterInlineParse();
            }
            return;
          }
          router.push(getPostParseHref(id));
        })();
        return;
      }

      const fatal = r.fatalError?.trim();
      const msg =
        fatal ||
        (r.ok
          ? "No usable items were extracted. Check your provider in Settings, then try again."
          : "Parse did not finish successfully. You can retry or start over.");
      setParseError(msg);
    },
    [
      clearParse,
      contentKind,
      getPostParseHref,
      resetAfterInlineParse,
      router,
      runAiParseOnNewPage,
    ],
  );

  const handleValidationError = useCallback((err: PdfValidationError) => {
    setError(
      err === "type"
        ? "Please choose a PDF file."
        : "This file is too large. Maximum size is 10 MB.",
    );
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setParseError(null);
      setLoadingFileName(file.name);
      setIngestPreviewFile(file);
      setIngestPageCount(null);
      setImportPhase("idb");
      setIngestBusy(true);
      let phase: NewStudySetPdfImportPhase = "idb";
      let retainLoaderFilename = false;
      pipelineLog("STUDY_SET", "new-import", "info", "new study set: file handling start", {
        ...fileSummary(file),
        contentKind,
      });
      try {
        if (runAiParseOnNewPage && !getPostParseHref) {
          throw new Error(
            "NewStudySetPdfImportFlow: getPostParseHref is required when runAiParseOnNewPage is true",
          );
        }
        if (!runAiParseOnNewPage && !getPostCreateHref) {
          throw new Error(
            "NewStudySetPdfImportFlow: getPostCreateHref is required when runAiParseOnNewPage is false",
          );
        }

        pipelineLog("IDB", "ensure", "info", "ensureStudySetDb (new import)", {});
        await ensureStudySetDb();

        phase = "pdf";
        setImportPhase("pdf");
        pipelineLog("PDF", "page-count", "info", "new import: getPdfPageCount start", {
          ...fileSummary(file),
        });
        const pageCount = await getPdfPageCount(file);
        pipelineLog("PDF", "page-count", "info", "new import: getPdfPageCount success", {
          ...fileSummary(file),
          pageCount,
        });
        setIngestPageCount(pageCount);

        phase = "persist";
        setImportPhase("persist");
        const provisionalTitle = provisionalTitleFromPdfFileName(file.name);
        pipelineLog("STUDY_SET", "new-import", "info", "new import: createStudySetEarlyMeta start", {
          ...fileSummary(file),
          pageCount,
          title: provisionalTitle,
          contentKind,
        });
        const id = await createStudySetEarlyMeta({
          title: provisionalTitle,
          sourceFileName: file.name,
          pageCount,
          contentKind,
          extractedText: "",
        });
        pipelineLog("STUDY_SET", "new-import", "info", "new import: study set meta persisted (early)", {
          studySetId: id,
          ...fileSummary(file),
          runAiParseOnNewPage,
        });

        if (runAiParseOnNewPage && getPostParseHref) {
          void enrichStudySetDocumentFromLocalPdf({
            studySetId: id,
            file,
            pageCount,
            titlePrefix,
          });
          const nextCtx: ParseContextState = { studySetId: id, file, pageCount };
          parseContextRef.current = nextCtx;
          setParseContext(nextCtx);
          setIngestPreviewFile(null);
          setImportPhase("ai");
          retainLoaderFilename = true;
        } else if (getPostCreateHref) {
          await enrichStudySetDocumentFromLocalPdf({
            studySetId: id,
            file,
            pageCount,
            titlePrefix,
          });
          router.push(getPostCreateHref(id));
        }
      } catch (raw) {
        const norm = normalizeUnknownError(raw);
        const cause =
          raw instanceof Error && raw.cause ? normalizeUnknownError(raw.cause) : undefined;
        pipelineLog("STUDY_SET", "new-import", "error", "new study set pipeline failed", {
          phase,
          userFacingBucket:
            phase === "persist"
              ? "study_set_save"
              : phase === "idb"
                ? "indexeddb"
                : "pdf_open",
          ...fileSummary(file),
          ...norm,
          cause,
          raw,
        });
        if (
          raw instanceof Error &&
          raw.message.includes("NewStudySetPdfImportFlow:")
        ) {
          setError(raw.message);
        } else {
          setError(userMessageForImportFailure(phase));
        }
      } finally {
        setIngestBusy(false);
        if (!retainLoaderFilename) {
          setLoadingFileName(null);
          setIngestPreviewFile(null);
          setIngestPageCount(null);
        }
      }
    },
    [
      contentKind,
      getPostCreateHref,
      getPostParseHref,
      router,
      runAiParseOnNewPage,
      titlePrefix,
    ],
  );

  const handleRetryParse = useCallback(() => {
    setParseError(null);
    void (async () => {
      const r = await parseRef.current?.runParse();
      if (r) {
        handleParseFinished(r);
      }
    })();
  }, [handleParseFinished]);

  useEffect(() => {
    if (!parseContext?.studySetId || !runAiParseOnNewPage) {
      uploadEffectPromiseRef.current = Promise.resolve();
      uploadEffectResultRef.current = null;
      return;
    }
    const studySetId = parseContext.studySetId;
    const file = parseContext.file;
    const kickAtStart = parseKickGen.current;
    const ac = new AbortController();
    uploadAbortRef.current = ac;

    const p = (async () => {
      uploadEffectResultRef.current = null;
      const result = await runBackgroundStudySetPdfUpload({
        file,
        signal: ac.signal,
        onProgress: (p) => {
          if (parseKickGen.current !== kickAtStart) {
            return;
          }
          if (p.capability.mode !== "direct-upload") {
            return;
          }
          reportUpload({
            studySetId,
            uploadedBytes: p.uploadedBytes,
            totalBytes: p.totalBytes,
            running: true,
            capabilityMode: "direct-upload",
          });
        },
      });

      if (parseKickGen.current !== kickAtStart) {
        return;
      }
      uploadEffectResultRef.current = result;
      uploadAbortRef.current = null;
      clearUpload(studySetId);

      if (result.kind === "completed") {
        toast.success("Upload complete", { duration: 3200 });
      } else if (result.kind === "error") {
        pipelineLog("STUDY_SET", "new-import", "warn", "background pdf upload failed", {
          studySetId,
          message: result.message,
        });
        if (!isStubObjectStorageFinalizeMessage(result.message)) {
          toast.error("Transfer did not finish. Starting over.");
          void resetAfterInlineParse();
        }
      }
    })();

    uploadEffectPromiseRef.current = p;

    return () => {
      ac.abort();
    };
  }, [
    parseContext?.studySetId,
    parseContext?.file,
    runAiParseOnNewPage,
    reportUpload,
    clearUpload,
    resetAfterInlineParse,
  ]);

  const showUploadChrome = !ingestBusy && !parseContext;
  const showImportLayout = ingestBusy || parseContext !== null;
  const previewFile = parseContext?.file ?? ingestPreviewFile;
  const pageCountForSkeleton =
    parseContext?.pageCount ?? ingestPageCount ?? null;
  /** Live import strip whenever we are ingesting or in inline parse flow (includes live parsing). */
  const importLiveChromeActive =
    !parseError &&
    (ingestBusy || parsing);
  return (
    <>
      <div className="w-full shrink-0 self-stretch">
        <ParseProgressStrip
          onCancelAll={
            inFlow ? () => void resetAfterInlineParse() : undefined
          }
        />
      </div>
      <div className="mx-auto flex w-full max-w-6xl shrink-0 flex-col items-center px-4 py-4 sm:px-6 sm:py-6 lg:max-w-7xl lg:px-8">
      {showUploadChrome ? (
        <header className="w-full max-w-3xl shrink-0 text-center lg:max-w-4xl">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {pageHeading}
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
            {pageSubcopy}
          </p>
        </header>
      ) : null}

      <div
        className={
          inFlow
            ? "mt-0 flex w-full shrink-0 flex-col items-stretch sm:mt-0"
            : "mt-5 flex w-full max-w-4xl shrink-0 flex-col items-center sm:mt-6 lg:max-w-5xl xl:max-w-6xl"
        }
      >
        {showUploadChrome ? (
          <div className="flex w-full max-w-3xl flex-col items-center">
            <UploadBox
              disabled={false}
              error={error}
              hasExtractedContent={false}
              tall
              onFileSelected={handleFile}
              onValidationError={handleValidationError}
            />
          </div>
        ) : null}

        {showImportLayout && previewFile ? (
          <motion.div
            key="import-unified-panel"
            className="flex w-full flex-col gap-6"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    delay: 0.06,
                    duration: 0.28,
                    ease: [0.22, 1, 0.36, 1],
                  }
            }
          >
            <div className="grid w-full gap-6 sm:grid-cols-2 sm:items-start">
              <div className="flex min-w-0 flex-col gap-4">
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg ring-1 ring-foreground/10">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
                    onClick={() => setDocumentPreviewOpen((v) => !v)}
                    aria-expanded={documentPreviewOpen}
                  >
                    <span className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Document
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        documentPreviewOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                  {documentPreviewOpen ? (
                    <div className="min-h-[min(50vh,28rem)] border-t border-border/60 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
                      <NewImportPdfViewer file={previewFile} />
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 space-y-4">
                  {contentKind === "flashcards" && importLiveChromeActive ? (
                    <FlashcardsImportDeckSkeleton
                      count={flashcardsImportSkeletonCount(
                        pageCountForSkeleton,
                      )}
                    />
                  ) : null}
                  {contentKind === "quiz" && importLiveChromeActive ? (
                    <ImportQuizLivePanel
                      studySetId={parseContext?.studySetId ?? null}
                      pageCount={pageCountForSkeleton}
                      enabled={Boolean(parsing)}
                      contentKind={contentKind}
                      reduceMotion={reduceMotion}
                    />
                  ) : null}
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                <UnifiedImportStatusCard
                  contentKind={contentKind}
                  fileName={
                    (loadingFileName ?? parseContext?.file.name) ?? null
                  }
                  importPhase={importPhase}
                  ingestBusy={ingestBusy}
                  parseContext={parseContext}
                  runAiParseOnNewPage={runAiParseOnNewPage}
                  onCancelParse={
                    parsing ? () => parseRef.current?.cancel() : undefined
                  }
                />

                {parseContext && runAiParseOnNewPage ? (
                  <>
                    {contentKind === "flashcards" ? (
                      <FlashcardsGenerationControls
                        value={flashcardGenerationConfig}
                        onChange={setFlashcardGenerationConfig}
                        disabled={parsing}
                      />
                    ) : null}
                    <AiParseSection
                      ref={parseRef}
                      studySetId={parseContext.studySetId}
                      activePdfFile={parseContext.file}
                      pageCount={parseContext.pageCount}
                      variant="embedded"
                      surface="product"
                      parseOutputMode={parseOutputModeFromContentKind(
                        contentKind,
                      )}
                      flashcardGenerationConfig={
                        contentKind === "flashcards"
                          ? flashcardGenerationConfig
                          : undefined
                      }
                      autoStartWhenBankEmpty
                      autoStartResetKey={parseContext.studySetId}
                      onEmbeddedParseFinished={handleParseFinished}
                      previewFirstPageBudget={PREVIEW_FIRST_PAGE_BUDGET}
                      suppressEmbeddedRunningProgress={parsing}
                    />
                    {parseError ? (
                      <Alert variant="destructive" aria-live="assertive">
                        <AlertTitle>Parse issue</AlertTitle>
                        <AlertDescription className="space-y-3">
                          <p>{parseError}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={handleRetryParse}
                            >
                              Retry
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void resetAfterInlineParse()}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
    </>
  );
}
