"use client";

import { useCallback, useRef, useState } from "react";
import { fileSummary, pipelineLog } from "@/lib/logging/pipelineLogger";
import {
  validatePdfFile,
  type PdfValidationError,
} from "@/lib/pdf/validatePdfFile";

type UploadBoxProps = {
  disabled?: boolean;
  error?: string | null;
  hasExtractedContent?: boolean;
  onFileSelected: (file: File) => void;
  onValidationError: (error: PdfValidationError) => void;
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
}: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pickedMeta, setPickedMeta] = useState<{
    name: string;
    size: number;
  } | null>(null);

  const processFile = useCallback(
    (file: File, pickSource: "input" | "drop") => {
      pipelineLog("PDF", "file-selected", "info", "file received (before validate)", {
        pickSource,
        ...fileSummary(file),
      });
      const result = validatePdfFile(file);
      if (!result.ok) {
        setPickedMeta(null);
        onValidationError(result.error);
        return;
      }
      setPickedMeta({ name: file.name, size: file.size });
      onFileSelected(file);
    },
    [onFileSelected, onValidationError],
  );

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

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          "rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          isDragging
            ? "border-[var(--d2q-accent)] bg-[var(--d2q-accent-muted)]"
            : "border-[var(--d2q-border-strong)] bg-[var(--d2q-surface)] hover:border-[var(--d2q-accent)]",
        ].join(" ")}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={disabled}
          onChange={onInputChange}
        />
        <p className="text-sm text-[var(--d2q-muted)]">
          Drag and drop a PDF here, or{" "}
          <span className="font-medium text-[var(--d2q-accent-hover)]">
            {hasExtractedContent ? "Choose another PDF" : "Choose PDF"}
          </span>
        </p>
      </div>
      {pickedMeta ? (
        <p className="mt-3 text-sm text-[var(--d2q-text)]">
          <span className="font-medium">{pickedMeta.name}</span>
          <span className="text-[var(--d2q-muted)]"> · {formatBytes(pickedMeta.size)}</span>
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
