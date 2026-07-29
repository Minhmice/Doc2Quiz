"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { CanonicalPreviewData } from "@/lib/client/canonicalizeStudySet";
import {
  fetchCanonicalSectionPage,
  fetchCanonicalVersionMetadata,
} from "@/lib/client/canonicalReader";
import { CanonicalMarkdownViewer } from "@/components/canonical/CanonicalMarkdownViewer";
import type {
  CanonicalSectionPage,
  CanonicalVersionMetadata,
} from "@/lib/workspaces/canonicalReader";

export type ProgressiveCanonicalReviewSource = Readonly<{
  workspaceId: string;
  versionId: string;
}>;

export type CanonicalSourceReviewProps = Readonly<{
  /** Legacy study-set preview with full bodies (adapters). */
  preview?: CanonicalPreviewData;
  /** Workspace-native progressive reader identity. */
  progressive?: ProgressiveCanonicalReviewSource;
  /** Optional prefetched metadata to avoid a duplicate metadata round-trip. */
  progressiveMetadata?: CanonicalVersionMetadata;
  action?: ReactNode;
}>;

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

function ProgressiveCanonicalSourceReview({
  progressive,
  progressiveMetadata,
  action,
}: {
  progressive: ProgressiveCanonicalReviewSource;
  progressiveMetadata?: CanonicalVersionMetadata;
  action?: ReactNode;
}) {
  const [metadata, setMetadata] = useState<CanonicalVersionMetadata | null>(
    progressiveMetadata ?? null,
  );
  const [initialPage, setInitialPage] = useState<CanonicalSectionPage | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const meta =
          progressiveMetadata ??
          (await fetchCanonicalVersionMetadata({
            workspaceId: progressive.workspaceId,
            versionId: progressive.versionId,
            signal: controller.signal,
          }));
        const page = await fetchCanonicalSectionPage({
          workspaceId: progressive.workspaceId,
          versionId: progressive.versionId,
          afterOrdinal: 0,
          limit: 20,
          signal: controller.signal,
        });
        if (cancelled) return;
        setMetadata(meta);
        setInitialPage(page);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't load canonical review.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    progressive.workspaceId,
    progressive.versionId,
    progressiveMetadata,
  ]);

  const title =
    metadata?.sections[0]?.heading ??
    `Canonical version ${metadata?.versionNumber ?? ""}`.trim();

  return (
    <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-label text-xs font-bold uppercase tracking-widest text-primary">
            Source review
          </p>
          <h2 className="mt-1 font-heading text-xl font-extrabold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {metadata
              ? `Version ${metadata.versionNumber} · ${metadata.model ?? "model n/a"} · prompt ${metadata.promptVersion ?? "n/a"} · parser ${metadata.parserVersion ?? "n/a"} · ${new Date(metadata.createdAt).toLocaleString()}`
              : "Loading canonical version…"}
          </p>
        </div>
        {action}
      </div>

      {error ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {loading && !metadata ? (
        <p className="text-sm text-muted-foreground">Loading sections…</p>
      ) : null}

      {metadata && initialPage ? (
        <div>
          <p className="mb-3 text-sm font-bold">Canonical Markdown</p>
          <CanonicalMarkdownViewer
            progressive={{
              workspaceId: progressive.workspaceId,
              versionId: progressive.versionId,
              sectionIndex: metadata.sections,
              initialPage,
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

export function CanonicalSourceReview({
  preview,
  progressive,
  progressiveMetadata,
  action,
}: CanonicalSourceReviewProps) {
  if (progressive) {
    return (
      <ProgressiveCanonicalSourceReview
        progressive={progressive}
        progressiveMetadata={progressiveMetadata}
        action={action}
      />
    );
  }

  if (!preview) {
    return null;
  }

  const metadata = preview.document.metadata;
  const extractedQuestions = Array.isArray(metadata?.extracted_questions)
    ? metadata.extracted_questions
    : [];
  const topics = stringList(metadata?.topics);
  const raw = preview.document.rawMarkdown?.trim() ?? "";
  const canonical = preview.document.canonicalMarkdown?.trim() ?? "";

  return (
    <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-label text-xs font-bold uppercase tracking-widest text-primary">
            Source review
          </p>
          <h2 className="mt-1 font-heading text-xl font-extrabold">
            {preview.document.originalFilename ?? preview.studySet.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {metadata?.content_type
              ? `Detected content: ${metadata.content_type}`
              : "Canonical knowledge is ready for review."}
            {metadata?.language ? ` · ${metadata.language}` : ""}
          </p>
        </div>
        {action}
      </div>
      {topics.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Topics: {topics.join(", ")}
        </p>
      ) : null}
      {raw ? (
        <details className="rounded-lg border border-border/50 p-4">
          <summary className="cursor-pointer text-sm font-bold">
            Raw Markdown
          </summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-relaxed">
            {raw}
          </pre>
        </details>
      ) : null}
      {canonical || preview.sections.length > 0 ? (
        <div>
          <p className="mb-3 text-sm font-bold">Canonical Markdown</p>
          <CanonicalMarkdownViewer
            markdown={canonical}
            sections={preview.sections}
          />
        </div>
      ) : null}
      {extractedQuestions.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-border/50 p-4">
          <h3 className="text-sm font-bold">
            Existing questions and answer keys
          </h3>
          {extractedQuestions.map((question, index) => (
            <div key={`${index}-${question.question}`} className="text-sm">
              <p className="font-semibold">{question.question}</p>
              {question.answer ? (
                <p className="mt-1 text-muted-foreground">
                  Answer: {question.answer}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  No answer key provided.
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
