"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { fileSummary, pipelineLog } from "@/lib/logging/pipelineLogger";
import {
  validatePdfFile,
  type PdfValidationError,
} from "@/lib/pdf/validatePdfFile";
import { isPdfUploadLocalOnlyCapability } from "@/lib/uploads/pdfUploadClient";
import {
  runPdfUploadSession,
  type PdfUploadRunnerState,
} from "@/lib/uploads/runPdfUploadSession";
import { PdfUploadProgressRow } from "@/components/upload/PdfUploadProgressRow";

function isStubObjectStorageFinalizeMessage(message: string | undefined): boolean {
  return (
    typeof message === "string" &&
    /not available yet for this deployment/i.test(message)
  );
}

const BORDER_BREATHE_SOFT =
  "color-mix(in srgb, var(--d2q-border-strong) 40%, transparent)";
const BORDER_BREATHE_FULL = "var(--d2q-border-strong)";
const IDLE_BORDER_SEC = 2.5;
const SNAP_MS = 0.14;
const LEAVE_MS = 0.11;
const SNAP_EASE = [0.22, 1, 0.36, 1] as const;
const LEAVE_EASE = [0.45, 0, 0.55, 1] as const;
const INGEST_MS = 0.28;
const INGEST_EASE = [0.22, 1, 0.36, 1] as const;

/** Picker UI only; create flow does not persist in-progress import state (D-11: refresh returns here). */

type UploadBoxProps = {
  disabled?: boolean;
  error?: string | null;
  hasExtractedContent?: boolean;
  onFileSelected: (file: File) => void;
  onValidationError: (error: PdfValidationError) => void;
  /**
   * When true, after validation runs `runPdfUploadSession` in parallel (non-blocking)
   * and shows `PdfUploadProgressRow` below the drop zone. Use only while this component
   * stays mounted for the whole upload (e.g. standalone upload surfaces). Flows that
   * navigate away or unmount this box should run upload from a parent instead
   * (see `NewStudySetPdfImportFlow`).
   * @default false
   */
  enableBackgroundPdfUpload?: boolean;
  /**
   * Large drop zone: most of the viewport height with generous outer margins
   * (quiz/flashcards import flows).
   */
  tall?: boolean;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadBox({
  disabled = false,
  error = null,
  hasExtractedContent = false,
  onFileSelected,
  onValidationError,
  enableBackgroundPdfUpload = false,
  tall = false,
}: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const [isDragging, setIsDragging] = useState(false);
  const [pickedMeta, setPickedMeta] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const [pdfUploadUi, setPdfUploadUi] = useState<{
    runnerState: PdfUploadRunnerState;
    percent: number;
    uploadedBytes: number;
    totalBytes: number;
    errorMessage?: string;
  } | null>(null);
  const uploadCancelRef = useRef<(() => void) | null>(null);
  const reuploadFileRef = useRef<File | null>(null);
  const uploadGenRef = useRef(0);

  useEffect(
    () => () => {
      uploadCancelRef.current?.();
      uploadCancelRef.current = null;
    },
    [],
  );

  const startBackgroundPdfUpload = useCallback((file: File) => {
    uploadCancelRef.current?.();
    uploadCancelRef.current = null;
    reuploadFileRef.current = file;
    const gen = (uploadGenRef.current += 1);

    setPdfUploadUi({
      runnerState: "init",
      percent: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
    });

    const { promise, cancel } = runPdfUploadSession({
      file,
      suggestedSuffix: "document",
      onStatus: ({ state }) => {
        if (uploadGenRef.current !== gen) return;
        if (state === "local_only") {
          setPdfUploadUi(null);
          return;
        }
        setPdfUploadUi((prev) => ({
          runnerState: state,
          percent: prev?.percent ?? 0,
          uploadedBytes: prev?.uploadedBytes ?? 0,
          totalBytes: prev?.totalBytes ?? file.size,
        }));
      },
      onProgress: (p) => {
        if (uploadGenRef.current !== gen) return;
        if (p.capability.mode !== "direct-upload") return;
        const pct =
          p.totalBytes > 0
            ? Math.min(100, Math.round((100 * p.uploadedBytes) / p.totalBytes))
            : 0;
        setPdfUploadUi((prev) => ({
          runnerState: prev?.runnerState ?? "uploading",
          percent: pct,
          uploadedBytes: p.uploadedBytes,
          totalBytes: p.totalBytes,
        }));
      },
    });
    uploadCancelRef.current = cancel;

    void promise.then((out) => {
      if (uploadGenRef.current !== gen) return;
      uploadCancelRef.current = null;
      if (out.ok) {
        setPdfUploadUi(null);
        pipelineLog("PDF", "upload-box", "info", "background pdf upload done", {});
        return;
      }
      const cap = out.uploadCapability;
      if (
        !cap.configured ||
        !cap.providerReady ||
        isPdfUploadLocalOnlyCapability(cap)
      ) {
        setPdfUploadUi(null);
        return;
      }
      const msg = out.message?.trim() ?? "";
      if (/cancel/i.test(msg)) {
        setPdfUploadUi(null);
        return;
      }
      if (isStubObjectStorageFinalizeMessage(out.message)) {
        setPdfUploadUi({
          runnerState: "failed",
          percent: 0,
          uploadedBytes: 0,
          totalBytes: file.size,
          errorMessage:
            out.message ??
            "Object storage finalize is not available yet for this deployment.",
        });
        return;
      }
      setPdfUploadUi({
        runnerState: "failed",
        percent: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
        errorMessage: msg.length > 0 ? msg : "Upload failed.",
      });
    });
  }, []);

  const processFile = useCallback(
    (file: File, pickSource: "input" | "drop") => {
      pipelineLog("PDF", "file-selected", "info", "file received (before validate)", {
        pickSource,
        ...fileSummary(file),
      });
      const result = validatePdfFile(file);
      if (!result.ok) {
        setPickedMeta(null);
        setPdfUploadUi(null);
        onValidationError(result.error);
        return;
      }
      setPickedMeta({ name: file.name, size: file.size });
      onFileSelected(file);
      if (enableBackgroundPdfUpload) {
        startBackgroundPdfUpload(file);
      }
    },
    [enableBackgroundPdfUpload, onFileSelected, onValidationError, startBackgroundPdfUpload],
  );

  const handlePdfUploadCancel = useCallback(() => {
    uploadCancelRef.current?.();
  }, []);

  const handlePdfUploadReupload = useCallback(() => {
    const f = reuploadFileRef.current;
    if (f) {
      startBackgroundPdfUpload(f);
    }
  }, [startBackgroundPdfUpload]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file, "input");
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file, "drop");
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const dragActive = isDragging && !disabled;
  const idleMotion = !reduceMotion && !disabled && !dragActive;

  const layoutClass = [
    "flex flex-col items-center justify-center gap-4 rounded-xl border-[3px] text-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    tall
      ? "mx-auto my-2 min-h-[11rem] max-h-[min(calc(100svh-14rem),32rem)] w-full overflow-hidden px-5 py-8 sm:my-3 sm:min-h-[12rem] sm:max-h-[min(calc(100svh-12.5rem),34rem)] sm:px-8 sm:py-10"
      : "min-h-44 px-8 py-14 sm:min-h-48 sm:px-10 sm:py-16",
    disabled ? "cursor-not-allowed" : "cursor-pointer",
  ].join(" ");

  const snapTransition = reduceMotion
    ? { duration: 0 }
    : { duration: SNAP_MS, ease: SNAP_EASE };
  const leaveTransition = reduceMotion
    ? { duration: 0 }
    : { duration: LEAVE_MS, ease: LEAVE_EASE };
  const ingestTransition = reduceMotion
    ? { duration: 0 }
    : { duration: INGEST_MS, ease: INGEST_EASE };

  const dragBg =
    "color-mix(in srgb, var(--d2q-accent) 38%, var(--d2q-surface))";
  const idleBg = "var(--d2q-surface)";

  return (
    <div className={tall ? "flex min-h-0 w-full shrink-0 flex-col" : "w-full"}>
      <motion.div
        role="button"
        tabIndex={0}
        style={{ transformOrigin: "50% 50%" }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={layoutClass}
        onClick={() => !disabled && inputRef.current?.click()}
        animate={
          disabled
            ? {
                scale: reduceMotion ? 1 : 0.98,
                opacity: reduceMotion ? 0.88 : 0.62,
                borderStyle: "dashed",
                borderColor: BORDER_BREATHE_FULL,
                backgroundColor: idleBg,
              }
            : dragActive
              ? {
                  scale: reduceMotion ? 1 : 1.01,
                  opacity: 1,
                  borderStyle: "solid",
                  borderColor: "hsl(var(--primary))",
                  backgroundColor: dragBg,
                }
              : {
                  scale: 1,
                  opacity: 1,
                  borderStyle: "dashed",
                  borderColor: idleMotion
                    ? [BORDER_BREATHE_SOFT, BORDER_BREATHE_FULL, BORDER_BREATHE_SOFT]
                    : BORDER_BREATHE_FULL,
                  backgroundColor: idleBg,
                }
        }
        transition={
          disabled
            ? ingestTransition
            : dragActive
              ? snapTransition
              : {
                  scale: leaveTransition,
                  opacity: leaveTransition,
                  borderStyle: leaveTransition,
                  backgroundColor: leaveTransition,
                  borderColor: idleMotion
                    ? {
                        duration: IDLE_BORDER_SEC,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                    : leaveTransition,
                }
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={disabled}
          onChange={onInputChange}
        />
        <div className="pointer-events-none flex flex-col items-center gap-4">
          <motion.div
            aria-hidden
            animate={idleMotion ? { y: [0, -2, 0] } : { y: 0 }}
            transition={
              idleMotion
                ? {
                    duration: IDLE_BORDER_SEC,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: IDLE_BORDER_SEC / 2,
                  }
                : reduceMotion
                  ? { duration: 0 }
                  : { duration: LEAVE_MS, ease: LEAVE_EASE }
            }
          >
            <CloudUpload
              className={
                tall
                  ? "size-12 text-[var(--d2q-muted)] sm:size-14"
                  : "size-9 text-[var(--d2q-muted)] sm:size-10"
              }
              strokeWidth={1.5}
            />
          </motion.div>
          <p
            className={
              tall
                ? "max-w-md text-pretty text-lg text-[var(--d2q-muted)] sm:text-xl"
                : "text-base text-[var(--d2q-muted)] sm:text-lg"
            }
          >
            Drag and drop a PDF here, or{" "}
            <span className="font-medium text-[var(--d2q-accent-hover)]">
              {hasExtractedContent ? "Choose another PDF" : "Choose PDF"}
            </span>
          </p>
        </div>
      </motion.div>
      {pickedMeta ? (
        <motion.p
          className="mt-3 text-sm text-[var(--d2q-text)]"
          animate={{
            opacity: disabled ? (reduceMotion ? 0.85 : 0.65) : 1,
          }}
          transition={disabled ? ingestTransition : leaveTransition}
        >
          <span className="font-medium">{pickedMeta.name}</span>
          <span className="text-[var(--d2q-muted)]"> · {formatBytes(pickedMeta.size)}</span>
        </motion.p>
      ) : null}
      {enableBackgroundPdfUpload && pdfUploadUi ? (
        <PdfUploadProgressRow
          className="mt-3 w-full text-left"
          runnerState={pdfUploadUi.runnerState}
          percent={pdfUploadUi.percent}
          uploadedBytes={pdfUploadUi.uploadedBytes}
          totalBytes={pdfUploadUi.totalBytes}
          errorMessage={pdfUploadUi.errorMessage}
          onCancel={handlePdfUploadCancel}
          onReupload={
            pdfUploadUi.errorMessage &&
            isStubObjectStorageFinalizeMessage(pdfUploadUi.errorMessage)
              ? handlePdfUploadReupload
              : undefined
          }
        />
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
