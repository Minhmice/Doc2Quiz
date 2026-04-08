"use client";

import { useCallback, useEffect, useState } from "react";
import { getOcrResult } from "@/lib/ai/ocrDb";
import { getDraftQuestions } from "@/lib/db/studySetDb";
import { renderSinglePdfPageToDataUrl } from "@/lib/pdf/renderPagesToImages";
import type { Question } from "@/types/question";
import { StoredImage } from "@/components/media/StoredImage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type QuestionMappingDebugProps = {
  studySetId: string;
  pdfFile?: File | null;
  reloadKey?: number;
};

export function QuestionMappingDebug({
  studySetId,
  pdfFile = null,
  reloadKey = 0,
}: QuestionMappingDebugProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [open, setOpen] = useState(false);
  const [pageUrls, setPageUrls] = useState<Record<number, string>>({});

  const reload = useCallback(async () => {
    if (!studySetId.trim()) {
      setQuestions([]);
      return;
    }
    const qs = await getDraftQuestions(studySetId);
    setQuestions(qs);
  }, [studySetId]);

  useEffect(() => {
    void reload();
  }, [reload, reloadKey]);

  useEffect(() => {
    if (!open || !pdfFile || questions.length === 0) {
      return;
    }
    const pages = new Set<number>();
    for (const q of questions) {
      const p =
        q.imagePageIndex ??
        q.sourcePageIndex ??
        q.ocrPageIndex;
      if (p !== undefined && p >= 1) {
        pages.add(p);
      }
    }
    let cancelled = false;
    void (async () => {
      const next: Record<number, string> = {};
      for (const p of pages) {
        const url = await renderSinglePdfPageToDataUrl(pdfFile, p);
        if (url && !cancelled) {
          next[p] = url;
        }
      }
      if (!cancelled) {
        setPageUrls(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pdfFile, questions, reloadKey]);

  if (questions.length === 0) {
    return null;
  }

  return (
    <Card className="border-dashed border-muted-foreground/40">
      <CardHeader className="pb-2">
        <button
          type="button"
          className="flex w-full flex-col items-start gap-1 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <CardTitle className="text-base">
            Question ↔ page mapping (debug){" "}
            <span className="text-xs font-normal text-muted-foreground">
              {open ? "▼" : "▶"}
            </span>
          </CardTitle>
          <CardDescription>
            Draft-only: provenance, OCR overlap mapping, crop-ready flags. Toggle
            to load page previews.
          </CardDescription>
        </button>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-4 border-t border-border pt-4">
          <MappingDebugRows
            questions={questions}
            pageUrls={pageUrls}
            studySetId={studySetId}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}

function MappingDebugRows({
  questions,
  pageUrls,
  studySetId,
}: {
  questions: Question[];
  pageUrls: Record<number, string>;
  studySetId: string;
}) {
  const [ocrSnippet, setOcrSnippet] = useState<
    Record<string, string | undefined>
  >({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ocr = await getOcrResult(studySetId);
      const map = new Map<number, string>();
      if (ocr?.pages) {
        for (const p of ocr.pages) {
          map.set(
            p.pageIndex,
            p.text.length > 220 ? `${p.text.slice(0, 220)}…` : p.text,
          );
        }
      }
      if (cancelled) {
        return;
      }
      const snip: Record<string, string | undefined> = {};
      for (const q of questions) {
        const idx = q.ocrPageIndex ?? q.sourcePageIndex;
        snip[q.id] = idx !== undefined ? map.get(idx) : undefined;
      }
      setOcrSnippet(snip);
    })();
    return () => {
      cancelled = true;
    };
  }, [studySetId, questions]);

  return (
    <ul className="space-y-4">
      {questions.map((q, i) => {
        const page =
          q.imagePageIndex ?? q.sourcePageIndex ?? q.ocrPageIndex ?? null;
        const thumb = page !== null ? pageUrls[page] : undefined;
        return (
          <li
            key={q.id}
            className="rounded-lg border border-border bg-muted/20 p-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-muted-foreground">
                #{i + 1}
              </span>
              {q.mappingMethod ? (
                <Badge variant="outline" className="text-[10px]">
                  {q.mappingMethod}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  no method
                </Badge>
              )}
              {q.mappingConfidence !== undefined ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  conf {q.mappingConfidence.toFixed(2)}
                </span>
              ) : null}
              <Badge
                variant={
                  q.verifiedRegionAvailable ? "default" : "secondary"
                }
                className="text-[10px]"
              >
                regions {q.verifiedRegionAvailable ? "ok" : "no"}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-foreground/90">
              {q.question}
            </p>
            <dl className="mt-2 grid gap-1 font-mono text-[10px] text-muted-foreground sm:grid-cols-2">
              <div>
                <dt className="inline text-foreground/70">sourcePageIndex:</dt>{" "}
                <dd className="inline">
                  {q.sourcePageIndex ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="inline text-foreground/70">imagePageIndex:</dt>{" "}
                <dd className="inline">
                  {q.imagePageIndex ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="inline text-foreground/70">ocrPageIndex:</dt>{" "}
                <dd className="inline">{q.ocrPageIndex ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline text-foreground/70">questionImageId:</dt>{" "}
                <dd className="inline break-all">
                  {q.questionImageId ?? "—"}
                </dd>
              </div>
            </dl>
            {q.mappingReason ? (
              <p className="mt-2 text-xs text-foreground/85">{q.mappingReason}</p>
            ) : null}
            {ocrSnippet[q.id] ? (
              <pre className="mt-2 max-h-24 overflow-auto rounded border border-border/80 bg-background/50 p-2 text-[10px] leading-snug text-muted-foreground">
                OCR excerpt: {ocrSnippet[q.id]}
              </pre>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3">
              {q.questionImageId ? (
                <div className="max-w-[10rem]">
                  <p className="mb-1 text-[10px] uppercase text-muted-foreground">
                    Attached image
                  </p>
                  <StoredImage mediaId={q.questionImageId} alt="" />
                </div>
              ) : null}
              {thumb ? (
                <div className="max-w-[10rem]">
                  <p className="mb-1 text-[10px] uppercase text-muted-foreground">
                    Page {page} raster
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumb}
                    alt=""
                    className="max-h-32 w-auto rounded border border-border object-contain"
                  />
                </div>
              ) : page !== null && !thumb ? (
                <p className="text-[10px] text-muted-foreground">
                  Open once with PDF on file to load page {page} preview.
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
