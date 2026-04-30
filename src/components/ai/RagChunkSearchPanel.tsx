"use client";

/**
 * Phase 33 — build a local embedding index from extracted text, search chunks,
 * and set optional context prepended into text MCQ parse.
 * Phase 34 — indexing progress / cancel / errors (shared job with auto-index).
 */

import { useCallback, useState } from "react";
import { searchSimilarChunks } from "@/lib/ai/buildEmbeddingIndex";
import type { EmbeddingIndexUiStatus } from "@/lib/ai/embeddingIndexScheduler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function truncateForUi(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, max)}…`;
}

export type RagChunkSearchPanelProps = {
  studySetId: string;
  ragContextPrefix: string;
  onRagPrefixChange: (next: string) => void;
  disabled?: boolean;
  indexingStatus: EmbeddingIndexUiStatus;
  onCancelIndexing: () => void;
  onManualBuildIndex: () => void;
};

export function RagChunkSearchPanel({
  studySetId,
  ragContextPrefix,
  onRagPrefixChange,
  disabled = false,
  indexingStatus,
  onCancelIndexing,
  onManualBuildIndex,
}: RagChunkSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [hits, setHits] = useState<
    { id: string; text: string; score: number; sourceLabel?: string }[]
  >([]);

  const canAct = !disabled && studySetId.trim().length > 0;
  const indexRunning = indexingStatus.status === "running";

  const handleBuildIndex = useCallback(() => {
    if (!canAct || indexRunning) {
      return;
    }
    onManualBuildIndex();
  }, [canAct, indexRunning, onManualBuildIndex]);

  const handleSearch = useCallback(async () => {
    if (!canAct || !query.trim()) {
      setHits([]);
      return;
    }
    setSearchBusy(true);
    setSearchMsg(null);
    try {
      const list = await searchSimilarChunks({
        studySetId: studySetId.trim(),
        query: query.trim(),
        topK: 8,
      });
      setHits(list);
      if (list.length === 0) {
        setSearchMsg(
          "No matches — build the index first, or try different wording.",
        );
      }
    } catch (e) {
      setSearchMsg(e instanceof Error ? e.message : String(e));
      setHits([]);
    } finally {
      setSearchBusy(false);
    }
  }, [canAct, studySetId, query]);

  const addHitToPrefix = useCallback(
    (text: string) => {
      const piece = text.trim();
      if (!piece) {
        return;
      }
      const base = ragContextPrefix.trim();
      onRagPrefixChange(
        base.length === 0 ? piece : `${base}\n\n${piece}`,
      );
    },
    [ragContextPrefix, onRagPrefixChange],
  );

  const buildStatusLine = (() => {
    if (indexingStatus.status === "running") {
      const { current, total } = indexingStatus;
      if (current !== undefined && total !== undefined && total > 0) {
        return `Indexing: ${current} / ${total}`;
      }
      return "Indexing…";
    }
    if (indexingStatus.status === "done") {
      const n = indexingStatus.current ?? indexingStatus.total;
      if (n !== undefined) {
        return `Indexed ${n} chunk(s).`;
      }
      return "Index ready.";
    }
    return null;
  })();

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Semantic context (optional)</CardTitle>
        <CardDescription>
          Build a local embedding index from this document&apos;s extracted text,
          search for relevant passages, then add them below. This text is prepended
          to each parse chunk (same model settings as Settings).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canAct || indexRunning}
            onClick={() => void handleBuildIndex()}
          >
            {indexRunning ? "Building…" : "Build embedding index"}
          </Button>
          {indexRunning ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onCancelIndexing()}
            >
              Cancel
            </Button>
          ) : null}
          {buildStatusLine ? (
            <p
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              {buildStatusLine}
            </p>
          ) : null}
        </div>
        {indexingStatus.status === "error" && indexingStatus.lastError ? (
          <p className="text-xs text-destructive" role="alert">
            Last error: {indexingStatus.lastError}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="rag-search-query">Search passages</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="rag-search-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. definitions, formulas, key terms…"
              disabled={!canAct}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={!canAct || searchBusy || !query.trim()}
              onClick={() => void handleSearch()}
            >
              {searchBusy ? "Searching…" : "Search"}
            </Button>
          </div>
          {searchMsg ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {searchMsg}
            </p>
          ) : null}
        </div>

        {hits.length > 0 ? (
          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2 text-sm">
            {hits.map((h) => (
              <li
                key={h.id}
                className="rounded border border-border/60 bg-muted/30 p-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap text-foreground">
                    {truncateForUi(h.text, 480)}
                  </p>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      {h.score.toFixed(3)}
                      {h.sourceLabel ? ` · ${h.sourceLabel}` : ""}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => addHitToPrefix(h.text)}
                    >
                      Add to context
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="rag-context-prefix">Context for next parse</Label>
          <Textarea
            id="rag-context-prefix"
            value={ragContextPrefix}
            onChange={(e) => onRagPrefixChange(e.target.value)}
            rows={5}
            placeholder="Passages you add from search appear here. Edit freely."
            disabled={!canAct}
            className="font-mono text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}
