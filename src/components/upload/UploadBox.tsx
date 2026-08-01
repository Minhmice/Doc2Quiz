"use client";

import { useCallback, useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { useLocale } from "@/components/locale/LocaleProvider";
import { cn } from "@/lib/utils";

export type UploadBoxProps = Readonly<{
  onFileSelected: (file: File) => void;
  accept: string;
  disabled?: boolean;
  tall?: boolean;
}>;

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} bytes`;
}

export function UploadBox({
  onFileSelected,
  accept,
  disabled = false,
  tall = true,
}: UploadBoxProps) {
  const { messages } = useLocale();
  const copy = messages.workflows.uploadBox;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pickedMeta, setPickedMeta] = useState<{
    name: string;
    size: string;
  } | null>(null);
  const reduceMotion = useReducedMotion();

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) {
        return;
      }
      setPickedMeta({ name: file.name, size: formatFileSize(file.size) });
      onFileSelected(file);
    },
    [disabled, onFileSelected],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      handleFile(event.dataTransfer.files?.[0]);
    },
    [handleFile],
  );

  return (
    <div className="space-y-3">
      <motion.div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) {
            setDragActive(true);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        animate={
          reduceMotion
            ? undefined
            : dragActive
              ? { scale: 0.99 }
              : { scale: 1 }
        }
        className={cn(
          "d2q-import-upload flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/35 bg-accent/10 px-6 py-8 text-center transition-colors duration-200 hover:border-primary/60 hover:bg-accent/20",
          tall && "min-h-[clamp(16rem,38vh,28rem)]",
          dragActive && "border-primary/50 bg-accent/10",
          disabled && "cursor-not-allowed opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      >
        <CloudUpload
          className="d2q-import-upload-icon mb-4 size-10 text-muted-foreground"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">
          {copy.drop}{" "}
          <span className="font-medium text-foreground underline-offset-2 hover:underline">
            {pickedMeta ? copy.chooseAnother : copy.choose}
          </span>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </motion.div>
      <p className="text-sm text-muted-foreground">
        {copy.formats}
      </p>
      {pickedMeta ? (
        <p className="text-sm text-foreground">
          {pickedMeta.name} · {pickedMeta.size}
        </p>
      ) : null}
    </div>
  );
}
