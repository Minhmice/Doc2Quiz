"use client";

import { useRef } from "react";
import { EyeIcon, FileTextIcon, RefreshCwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type PdfInfoCardProps = {
  fileName: string;
  pageCount: number;
  uploadedAt: string;
  onReplace: (file: File) => void;
  onPreview?: () => void;
  replaceBusy?: boolean;
};

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) {
    return "—";
  }
  const ms = Date.now() - t;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) {
    return "just now";
  }
  if (mins < 60) {
    return `${mins} min${mins > 1 ? "s" : ""} ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  }
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export function PdfInfoCard({
  fileName,
  pageCount,
  uploadedAt,
  onReplace,
  onPreview,
  replaceBusy = false,
}: PdfInfoCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timeAgo = formatTimeAgo(uploadedAt);

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileTextIcon className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="line-clamp-2 text-base leading-snug">
              {fileName || "PDF"}
            </CardTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-normal tabular-nums">
                {pageCount} {pageCount === 1 ? "page" : "pages"}
              </Badge>
              <span>Uploaded {timeAgo}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={replaceBusy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) {
              onReplace(f);
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={replaceBusy}
          onClick={() => inputRef.current?.click()}
        >
          <RefreshCwIcon className="mr-1.5 size-4" aria-hidden />
          Replace
        </Button>
        {onPreview ? (
          <Button type="button" size="sm" variant="ghost" onClick={onPreview}>
            <EyeIcon className="mr-1.5 size-4" aria-hidden />
            Preview
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
