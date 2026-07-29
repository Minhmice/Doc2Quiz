"use client";

import type { ReactNode } from "react";
import type { CanonicalPreviewData } from "@/lib/client/canonicalizeStudySet";
import { CanonicalMarkdownViewer } from "@/components/canonical/CanonicalMarkdownViewer";

export type CanonicalSourceReviewProps = Readonly<{
  preview: CanonicalPreviewData;
  action?: ReactNode;
}>;

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export function CanonicalSourceReview({ preview, action }: CanonicalSourceReviewProps) {
  const metadata = preview.document.metadata;
  const extractedQuestions = Array.isArray(metadata?.extracted_questions) ? metadata.extracted_questions : [];
  const topics = stringList(metadata?.topics);
  const raw = preview.document.rawMarkdown?.trim() ?? "";
  const canonical = preview.document.canonicalMarkdown?.trim() ?? "";

  return (
    <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-label text-xs font-bold uppercase tracking-widest text-primary">Source review</p>
          <h2 className="mt-1 font-heading text-xl font-extrabold">{preview.document.originalFilename ?? preview.studySet.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {metadata?.content_type ? `Detected content: ${metadata.content_type}` : "Canonical knowledge is ready for review."}
            {metadata?.language ? ` · ${metadata.language}` : ""}
          </p>
        </div>
        {action}
      </div>
      {topics.length > 0 ? <p className="text-sm text-muted-foreground">Topics: {topics.join(", ")}</p> : null}
      {raw ? <details className="rounded-lg border border-border/50 p-4"><summary className="cursor-pointer text-sm font-bold">Raw Markdown</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-relaxed">{raw}</pre></details> : null}
      {canonical ? <div><p className="mb-3 text-sm font-bold">Canonical Markdown</p><CanonicalMarkdownViewer markdown={canonical} sections={preview.sections} /></div> : null}
      {extractedQuestions.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-border/50 p-4">
          <h3 className="text-sm font-bold">Existing questions and answer keys</h3>
          {extractedQuestions.map((question, index) => (
            <div key={`${index}-${question.question}`} className="text-sm">
              <p className="font-semibold">{question.question}</p>
              {question.answer ? <p className="mt-1 text-muted-foreground">Answer: {question.answer}</p> : <p className="mt-1 text-muted-foreground">No answer key provided.</p>}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
