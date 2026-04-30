"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useStudySetNewImportStepOptional } from "@/components/edit/new/import/StudySetNewImportStepContext";
import { NewImportPdfViewer } from "@/components/edit/new/import/NewImportPdfViewer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/buttons/button";
import { UploadBox } from "@/components/upload/UploadBox";
import {
  createStudySetEarlyMeta,
  deleteStudySet,
  enrichStudySetDocumentFromLocalPdf,
  ensureStudySetDb,
  getSourcePdfMediaIdForStudySet,
} from "@/lib/db/studySetDb";
import {
  fileSummary,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { cn } from "@/lib/utils";
import { getPdfPageCount } from "@/lib/pdf/getPdfPageCount";
import type { PdfValidationError } from "@/lib/pdf/validatePdfFile";
import type { StudyContentKind } from "@/types/studySet";
import { runBackgroundStudySetPdfUpload } from "@/lib/uploads/runBackgroundStudySetPdfUpload";
import { AI_PROCESSING_UNAVAILABLE_MESSAGE } from "@/lib/ai/processingMessages";
import { ChevronDown } from "lucide-react";

function provisionalTitleFromPdfFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "New study set";
  }
  const noExt = trimmed.replace(/\.pdf$/i, "").trim();
  const base = noExt.length > 0 ? noExt : trimmed;
  return base.slice(0, 80);
}

export type NewStudySetPdfImportFlowProps = {
  contentKind: StudyContentKind;
  pageHeading: string;
  pageSubcopy: string;
  getPostParseHref?: (studySetId: string) => string;
  runAiParseOnNewPage?: boolean;
  getPostCreateHref?: (studySetId: string) => string;
  titlePrefix?: string;
};

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
  const importStepCtx = useStudySetNewImportStepOptional();
  const setImportStep = importStepCtx?.setStep;
  const reduceMotion = useReducedMotion();

  const uploadAbortRef = useRef<AbortController | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [activeStudySetId, setActiveStudySetId] = useState<string | null>(null);

  useEffect(() => {
    if (!busy && !activeStudySetId) {
      setImportStep?.("upload");
    }
  }, [busy, activeStudySetId, setImportStep]);

  const reset = useCallback(async () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    const id = activeStudySetId;
    setActiveStudySetId(null);
    setPreviewFile(null);
    setError(null);
    setImportStep?.("upload");
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
    }
  }, [activeStudySetId, setImportStep]);

  const deleteStudySetIfCreated = useCallback(
    async (id: string | undefined): Promise<void> => {
      if (!id) {
        return;
      }
      try {
        await deleteStudySet(id);
      } catch (raw) {
        pipelineLog("STUDY_SET", "new-import", "error", "deleteStudySet after failure", {
          studySetId: id,
          ...normalizeUnknownError(raw),
          raw,
        });
      }
    },
    [],
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
      setBusy(true);
      setPreviewFile(file);
      setImportStep?.("upload");

      pipelineLog("STUDY_SET", "new-import", "info", "canonical-import: start", {
        ...fileSummary(file),
        contentKind,
      });

      let createdStudySetId: string | undefined;

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

        await ensureStudySetDb();
        const pageCount = await getPdfPageCount(file);
        const provisionalTitle = provisionalTitleFromPdfFileName(file.name);
        const studySetId = await createStudySetEarlyMeta({
          title: provisionalTitle,
          sourceFileName: file.name,
          pageCount,
          contentKind,
          extractedText: "",
        });
        createdStudySetId = studySetId;
        setActiveStudySetId(studySetId);
        setImportStep?.("read");

        await enrichStudySetDocumentFromLocalPdf({
          studySetId,
          file,
          pageCount,
          titlePrefix,
        });

        if (!runAiParseOnNewPage && getPostCreateHref) {
          router.push(getPostCreateHref(studySetId));
          return;
        }

        const fileRef = await getSourcePdfMediaIdForStudySet(studySetId);
        if (!fileRef) {
          throw new Error("save_document");
        }

        setImportStep?.("generate");

        const res = await fetch(`/api/study-sets/${studySetId}/generate-from-file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentKind,
            fileRef,
            options: {},
          }),
        });

        const payload = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          warnings?: string[];
        };

        if (!res.ok) {
          throw new Error(payload.error ?? AI_PROCESSING_UNAVAILABLE_MESSAGE);
        }

        if (!payload.ok) {
          throw new Error(AI_PROCESSING_UNAVAILABLE_MESSAGE);
        }

        if (getPostParseHref) {
          router.push(getPostParseHref(studySetId));
        }
      } catch (raw) {
        const norm = normalizeUnknownError(raw);
        pipelineLog("STUDY_SET", "new-import", "error", "canonical-import failed", {
          ...fileSummary(file),
          ...norm,
          raw,
        });
        if (raw instanceof Error && raw.message === "save_document") {
          setError(
            "Could not save your study set. The PDF was read, but saving failed—try again or free up browser storage.",
          );
        } else if (raw instanceof Error && raw.message.includes("NewStudySetPdfImportFlow:")) {
          setError(raw.message);
        } else {
          setError(AI_PROCESSING_UNAVAILABLE_MESSAGE);
        }
        await deleteStudySetIfCreated(createdStudySetId);
        setActiveStudySetId(null);
        setPreviewFile(null);
        setImportStep?.("upload");
      } finally {
        setBusy(false);
      }
    },
    [
      contentKind,
      getPostCreateHref,
      getPostParseHref,
      router,
      runAiParseOnNewPage,
      titlePrefix,
      setImportStep,
      deleteStudySetIfCreated,
    ],
  );

  useEffect(() => {
    if (!activeStudySetId || !previewFile) {
      return;
    }
    const file = previewFile;
    const ac = new AbortController();
    uploadAbortRef.current = ac;

    void runBackgroundStudySetPdfUpload({
      file,
      signal: ac.signal,
      onProgress: () => {},
      onRunnerStatus: () => {},
    });

    return () => {
      ac.abort();
    };
  }, [activeStudySetId, previewFile]);

  const showWorkbench = busy || Boolean(activeStudySetId && previewFile);

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl shrink-0 flex-col items-center px-4 py-4 sm:px-6 sm:py-6 lg:max-w-7xl lg:px-8">
        {!showWorkbench ? (
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
            showWorkbench
              ? "mt-0 flex w-full shrink-0 flex-col items-stretch sm:mt-0"
              : "mt-5 flex w-full max-w-4xl shrink-0 flex-col items-center sm:mt-6 lg:max-w-5xl xl:max-w-6xl"
          }
        >
          {!showWorkbench ? (
            <div className="flex w-full max-w-3xl flex-col items-center">
              <UploadBox
                disabled={busy}
                error={error}
                hasExtractedContent={false}
                tall
                onFileSelected={handleFile}
                onValidationError={handleValidationError}
              />
            </div>
          ) : null}

          {showWorkbench && previewFile ? (
            <motion.div
              key="import-panel"
              className="flex w-full flex-col gap-6"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { delay: 0.06, duration: 0.28, ease: [0.22, 1, 0.36, 1] }
              }
            >
              <div className="mx-auto w-full max-w-lg">
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

                <p className="mt-5 text-center text-sm text-muted-foreground" role="status">
                  {busy ? "Working on your study set…" : null}
                </p>

                <div className="mt-6 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void reset()}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      {error && !showWorkbench ? (
        <div className="mx-auto mt-4 w-full max-w-md px-4">
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
    </>
  );
}
