"use client";

import { useEffect, useState } from "react";

export type NewImportPdfViewerProps = Readonly<{
  file: File;
  className?: string;
}>;

/**
 * Embedded PDF preview for the new-import flow. Revokes the object URL on unmount.
 */
export function NewImportPdfViewer({ file, className }: NewImportPdfViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!objectUrl) {
    return (
      <div
        className={
          className ??
          "flex min-h-[min(50vh,28rem)] w-full items-center justify-center rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground"
        }
      >
        Preparing PDF preview…
      </div>
    );
  }

  return (
    <iframe
      title="PDF preview"
      src={`${objectUrl}#toolbar=0`}
      className={
        className ??
        "min-h-[min(50vh,28rem)] w-full flex-1 rounded-lg border border-border bg-background"
      }
    />
  );
}
