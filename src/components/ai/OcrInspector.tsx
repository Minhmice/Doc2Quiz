"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react";
import type { ParseRunResult } from "@/components/ai/AiParseSection";
import { getOcrResult } from "@/lib/ai/ocrDb";
import { verifyOcrPageRegions } from "@/lib/ai/ocrRegionVerify";
import { renderSinglePdfPageToDataUrl } from "@/lib/pdf/renderPagesToImages";
import type { OcrPageResult, OcrRunResult } from "@/types/ocr";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OcrInspectorProps = {
  studySetId: string;
  pdfFile?: File | null;
  /** Increment when IndexedDB OCR row may have changed (e.g. after parse). */
  reloadKey?: number;
  /** Session-only chunk parse debug from last parse (not IDB). */
  chunkParseDebug?: ParseRunResult["chunkParseDebug"] | null;
  lastParseRunWallMs?: number | null;
  usedVisionFallback?: boolean;
};

function statusVariant(
  s: NonNullable<OcrPageResult["status"]> | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "failed") {
    return "destructive";
  }
  if (s === "partial") {
    return "secondary";
  }
  return "default";
}

export function OcrInspector({
  studySetId,
  pdfFile = null,
  reloadKey = 0,
  chunkParseDebug = null,
  lastParseRunWallMs = null,
  usedVisionFallback = false,
}: OcrInspectorProps) {
  const pageSelectId = useId();
  const overlaySwitchId = useId();
  const [run, setRun] = useState<OcrRunResult | null | undefined>(undefined);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [pageDataUrl, setPageDataUrl] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);

  const reload = useCallback(async () => {
    if (!studySetId.trim()) {
      setRun(null);
      setSelectedPage(null);
      return;
    }
    const row = await getOcrResult(studySetId);
    setRun(row ?? null);
    setSelectedPage((prev) => {
      if (!row?.pages?.length) {
        return null;
      }
      if (prev !== null && row.pages.some((p) => p.pageIndex === prev)) {
        return prev;
      }
      return row.pages[0]!.pageIndex;
    });
  }, [studySetId]);

  useEffect(() => {
    void reload();
  }, [reload, reloadKey]);

  useEffect(() => {
    if (!pdfFile || selectedPage === null) {
      setPageDataUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const url = await renderSinglePdfPageToDataUrl(pdfFile, selectedPage);
      if (!cancelled) {
        setPageDataUrl(url);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfFile, selectedPage]);

  const pageRow = useMemo(() => {
    if (!run?.pages.length || selectedPage === null) {
      return undefined;
    }
    return run.pages.find((p) => p.pageIndex === selectedPage);
  }, [run, selectedPage]);

  const regionVer = useMemo(() => {
    if (!pageRow) {
      return null;
    }
    return pageRow.regionVerification ?? verifyOcrPageRegions(pageRow);
  }, [pageRow]);

  if (run === undefined) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">OCR inspector</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!run) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">OCR inspector</CardTitle>
          <CardDescription>
            No OCR run stored for this set yet. Enable OCR before vision parse, then
            parse again to capture page text and boxes.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const stats = run.stats;
  const versionLabel = `v${run.version}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">OCR inspector</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{versionLabel}</Badge>
            <Badge variant="secondary">{run.provider}</Badge>
            {stats ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                ok {stats.successPages} · partial {stats.partialPages} · failed{" "}
                {stats.failedPages} · blocks {stats.totalBlocks}
              </span>
            ) : null}
          </div>
        </div>
        <CardDescription className="font-mono text-[11px]">
          saved {run.savedAt}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs space-y-2">
          <Label htmlFor={pageSelectId}>Page</Label>
          <Select
            value={
              selectedPage !== null ? String(selectedPage) : undefined
            }
            onValueChange={(v) => {
              const n = Number(v);
              setSelectedPage(Number.isFinite(n) ? n : null);
            }}
          >
            <SelectTrigger id={pageSelectId} size="sm" className="w-full">
              <SelectValue placeholder="Choose page" />
            </SelectTrigger>
            <SelectContent>
              {run.pages.map((p) => (
                <SelectItem key={p.pageIndex} value={String(p.pageIndex)}>
                  Page {p.pageIndex}
                  {p.status ? ` · ${p.status}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {pageRow ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(pageRow.status)}>
              {pageRow.status ?? "legacy"}
            </Badge>
            {pageRow.invalidBlockCount ? (
              <span className="text-xs text-muted-foreground">
                invalid geometry stripped: {pageRow.invalidBlockCount}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Page image
            </p>
            {pageDataUrl ? (
              <div className="relative inline-block max-w-full overflow-hidden rounded-md border border-border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pageDataUrl}
                  alt=""
                  className="max-h-[min(24rem,70vh)] w-auto max-w-full object-contain"
                />
                {showBoxes && pageRow
                  ? pageRow.blocks.map((b, i) => {
                      const box = b.bbox;
                      if (!box || box.space !== "relative") {
                        return null;
                      }
                      return (
                        <div
                          key={`bbox-${i}`}
                          className="pointer-events-none absolute border border-sky-400/90 bg-sky-400/15"
                          style={{
                            left: `${box.x * 100}%`,
                            top: `${box.y * 100}%`,
                            width: `${box.width * 100}%`,
                            height: `${box.height * 100}%`,
                          }}
                        />
                      );
                    })
                  : null}
                {showBoxes && pageRow
                  ? pageRow.blocks.some((b) => b.polygon && b.polygon.length >= 3)
                    ? (() => {
                        const polys = pageRow.blocks
                          .map((b) => b.polygon)
                          .filter(
                            (p): p is NonNullable<typeof p> =>
                              !!p && p.length >= 3,
                          );
                        return (
                          <svg
                            className="pointer-events-none absolute inset-0 size-full"
                            viewBox="0 0 1 1"
                            preserveAspectRatio="none"
                            aria-hidden
                          >
                            {polys.map((pts, pi) => (
                              <polygon
                                key={`poly-${pi}`}
                                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                                fill="rgba(250, 204, 21, 0.12)"
                                stroke="rgba(250, 204, 21, 0.85)"
                                strokeWidth={0.004}
                              />
                            ))}
                          </svg>
                        );
                      })()
                    : null
                  : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {pdfFile
                  ? "Could not render this page preview."
                  : "Upload a PDF on this set to preview the page image here."}
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                id={overlaySwitchId}
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={showBoxes}
                onChange={(e) => setShowBoxes(e.target.checked)}
              />
              <Label htmlFor={overlaySwitchId} className="text-sm font-normal">
                Show OCR boxes (relative bbox / polygon)
              </Label>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Full text
              </p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 font-mono text-[11px] leading-snug text-foreground">
                {pageRow?.text?.length ? pageRow.text : "—"}
              </pre>
            </div>
            {pageRow?.warnings?.length ? (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  Warnings
                </p>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {pageRow.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Blocks
              </p>
              <ul className="max-h-56 space-y-2 overflow-auto pr-1 text-sm">
                {(pageRow?.blocks ?? []).map((b, i) => {
                  const rv = regionVer?.blocks[i];
                  return (
                    <li
                      key={i}
                      className="rounded-md border border-border/80 bg-muted/20 p-2 font-mono text-[11px] leading-snug"
                    >
                      <span className="text-foreground/90">{b.text}</span>
                      {rv ? (
                        <span
                          className={
                            rv.cropReady
                              ? " ml-2 text-emerald-600 dark:text-emerald-400"
                              : " ml-2 text-muted-foreground"
                          }
                        >
                          {rv.cropReady ? "crop-ready" : "not crop-ready"}
                        </span>
                      ) : null}
                      {b.confidence !== undefined ? (
                        <span className="ml-2 text-muted-foreground">
                          conf {b.confidence.toFixed(2)}
                        </span>
                      ) : null}
                      {b.bbox ? (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          bbox ({b.bbox.space}) x {b.bbox.x.toFixed(4)} y{" "}
                          {b.bbox.y.toFixed(4)} w {b.bbox.width.toFixed(4)} h{" "}
                          {b.bbox.height.toFixed(4)}
                        </div>
                      ) : null}
                      {b.polygon?.length ? (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          polygon [{b.polygon.length} pts]{" "}
                          {JSON.stringify(b.polygon)}
                        </div>
                      ) : null}
                      {rv?.issues.length ? (
                        <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                          {rv.issues.join(" · ")}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
            {regionVer ? (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Region verification (crop-prep)
                </p>
                <div className="rounded-md border border-border bg-muted/30 p-2 font-mono text-[10px] leading-snug text-foreground/90">
                  <p>
                    pageUsableForCrop:{" "}
                    <strong>{regionVer.pageUsableForCrop ? "yes" : "no"}</strong>
                    {" · "}
                    cropReady blocks: {regionVer.cropReadyBlockCount} /{" "}
                    {pageRow?.blocks.length ?? 0}
                  </p>
                  {regionVer.pageIssues.length > 0 ? (
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      {regionVer.pageIssues.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {pageRow?.coordRef ? (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coordinate reference
                </p>
                <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px] leading-snug">
                  {JSON.stringify(pageRow.coordRef, null, 2)}
                </pre>
              </div>
            ) : null}
            {pageRow?.providerMeta &&
            Object.keys(pageRow.providerMeta).length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Provider metadata
                </p>
                <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px] leading-snug">
                  {JSON.stringify(pageRow.providerMeta, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>

        {chunkParseDebug != null ||
        (lastParseRunWallMs != null && Number.isFinite(lastParseRunWallMs)) ? (
          <details className="rounded-md border border-border/80 bg-muted/20 p-2">
            <summary className="cursor-pointer text-sm font-semibold text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
              Chunk parse debug
            </summary>
            <div className="mt-3 space-y-3">
              {lastParseRunWallMs != null && Number.isFinite(lastParseRunWallMs) ? (
                <div className="space-y-1">
                  <p className="text-xs font-mono tabular-nums text-muted-foreground">
                    Parse time: {(lastParseRunWallMs / 1000).toFixed(1)}s
                  </p>
                  {usedVisionFallback ? (
                    <p className="text-sm text-muted-foreground">
                      Includes full-page vision fallback.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {chunkParseDebug == null ? null : chunkParseDebug.reason ===
                "vision_only_parse" ? (
                <p className="text-sm text-muted-foreground">
                  No chunk AI calls in this run (Accurate / vision-only).
                </p>
              ) : chunkParseDebug.reason === "no_layout_chunks" &&
                chunkParseDebug.byChunk.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No layout chunks built from this OCR run.
                </p>
              ) : chunkParseDebug.byChunk.length === 0 ? (
                <p className="text-sm text-muted-foreground">No chunk rows.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-1 pr-2 font-semibold">Chunk id</th>
                        <th className="py-1 pr-2 font-semibold">Outcome</th>
                        <th className="py-1 pr-2 font-semibold">Expanded retry</th>
                        <th className="py-1 pr-2 font-semibold">AI time</th>
                        <th className="py-1 font-semibold">Attempts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chunkParseDebug.byChunk.map((row) => {
                        const raw = chunkParseDebug.rawByChunkId?.[row.layoutChunkId];
                        return (
                          <Fragment key={row.layoutChunkId}>
                            <tr className="border-b border-border/60 align-top">
                              <td className="py-1 pr-2 font-mono text-xs">
                                {row.layoutChunkId}
                              </td>
                              <td className="py-1 pr-2 text-xs">
                                {row.outcome.ok ? "OK" : row.outcome.error}
                              </td>
                              <td className="py-1 pr-2 text-xs">
                                {row.usedExpandedText ? "Yes" : "No"}
                              </td>
                              <td className="py-1 pr-2 font-mono text-xs tabular-nums">
                                <span>{Math.round(row.chunkAiWallMs)} ms</span>
                                {row.attemptWallMs && row.attemptWallMs.length > 1 ? (
                                  <details className="mt-1">
                                    <summary className="cursor-pointer text-xs font-semibold">
                                      Per attempt
                                    </summary>
                                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                                      {row.attemptWallMs
                                        .map(
                                          (ms, i) =>
                                            `Attempt ${i + 1}: ${Math.round(ms)}ms`,
                                        )
                                        .join(" · ")}
                                    </p>
                                  </details>
                                ) : null}
                              </td>
                              <td className="py-1 font-mono text-xs tabular-nums">
                                {row.parseAttempts}
                              </td>
                            </tr>
                            {raw ? (
                              <tr>
                                <td colSpan={5} className="pb-2 pt-0">
                                  <details>
                                    <summary className="cursor-pointer text-xs font-semibold text-foreground">
                                      Raw output
                                    </summary>
                                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 font-mono text-xs">
                                      {raw}
                                    </pre>
                                  </details>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
