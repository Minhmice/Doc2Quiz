"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CanonicalSourceReview } from "@/components/canonical/CanonicalSourceReview";
import { WorkspaceCollaborationPanel } from "@/components/workspaces/WorkspaceCollaborationPanel";
import { Button } from "@/components/ui/button";
import {
  postWorkspaceFlashcardGenerate,
  saveFlashcardSourceSelection,
} from "@/lib/client/flashcardGenerateStudySet";
import {
  postWorkspaceQuizGenerate,
  saveQuizSourceSelection,
} from "@/lib/client/quizGenerateStudySet";
import { fetchWorkspaceDetail } from "@/lib/client/workspaceApi";
import {
  flashcardOverview,
  flashcardPlay,
  quizOverview,
  quizPlay,
} from "@/lib/routes/studySetPaths";
import type {
  WorkspaceDetail,
  WorkspaceDetailCanonicalVersion,
} from "@/lib/workspaces/workspaceSummary";

export type WorkspaceDetailClientProps = Readonly<{
  workspaceId: string;
}>;

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function WorkspaceDetailClient({
  workspaceId,
}: WorkspaceDetailClientProps) {
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [readingVersionId, setReadingVersionId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<"quiz" | "flashcards" | null>(
    null,
  );

  const refresh = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const next = await fetchWorkspaceDetail(workspaceId);
      setDetail(next);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const completedVersions = useMemo(() => {
    if (!detail) return [] as Array<{
      documentTitle: string;
      version: WorkspaceDetailCanonicalVersion;
    }>;
    const rows: Array<{
      documentTitle: string;
      version: WorkspaceDetailCanonicalVersion;
    }> = [];
    for (const document of detail.documents) {
      for (const documentVersion of document.versions) {
        for (const canonical of documentVersion.canonicalVersions) {
          if (canonical.status === "completed") {
            rows.push({ documentTitle: document.title, version: canonical });
          }
        }
      }
    }
    return rows;
  }, [detail]);

  const toggleVersion = (canonicalVersionId: string) => {
    setSelectedVersionIds((prev) =>
      prev.includes(canonicalVersionId)
        ? prev.filter((id) => id !== canonicalVersionId)
        : [...prev, canonicalVersionId],
    );
  };

  const runGenerate = async (kind: "quiz" | "flashcards") => {
    if (selectedVersionIds.length === 0) {
      setGenerateError("Select at least one completed canonical version.");
      return;
    }
    setGenerateError(null);
    setGenerating(kind);
    try {
      if (kind === "quiz") {
        saveQuizSourceSelection(workspaceId, selectedVersionIds);
        const result = await postWorkspaceQuizGenerate(workspaceId, {
          canonicalVersionIds: selectedVersionIds,
        });
        const setId = result.bridgeStudySetId ?? result.studySetId;
        if (setId) {
          window.location.assign(quizOverview(setId));
          return;
        }
      } else {
        saveFlashcardSourceSelection(workspaceId, selectedVersionIds);
        const result = await postWorkspaceFlashcardGenerate(workspaceId, {
          canonicalVersionIds: selectedVersionIds,
          learningGoal: "memorize",
          coverage: "entire_document",
          amount: "recommended",
        });
        const setId = result.bridgeStudySetId ?? result.studySetId;
        if (setId) {
          window.location.assign(flashcardOverview(setId));
          return;
        }
      }
      await refresh();
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Generation failed.",
      );
    } finally {
      setGenerating(null);
    }
  };

  if (loading && !detail) {
    return (
      <p className="py-6 text-sm text-muted-foreground" role="status">
        Loading workspace…
      </p>
    );
  }

  if (loadError && !detail) {
    return (
      <div className="space-y-3 py-6">
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
        <Button type="button" variant="outline" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 py-6 sm:py-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Workspace · {detail.role}
        </p>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
          {detail.title}
        </h1>
        {detail.subtitle ? (
          <p className="max-w-2xl text-muted-foreground">{detail.subtitle}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Updated {formatDate(detail.updatedAt)}
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="documents-heading">
        <div>
          <h2 id="documents-heading" className="font-heading text-xl font-bold">
            Documents
          </h2>
          <p className="text-sm text-muted-foreground">
            Active sources and immutable versions. Soft-deleted sources are hidden.
          </p>
        </div>
        {detail.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active documents. Existing outputs below still work.
          </p>
        ) : (
          <ul className="space-y-6">
            {detail.documents.map((document) => (
              <li key={document.id} className="space-y-3 border-b border-border/60 pb-6">
                <div>
                  <h3 className="text-lg font-semibold">{document.title}</h3>
                  {document.description ? (
                    <p className="text-sm text-muted-foreground">
                      {document.description}
                    </p>
                  ) : null}
                </div>
                <ul className="space-y-3">
                  {document.versions.map((version) => (
                    <li key={version.id} className="space-y-2 pl-1">
                      <p className="text-sm font-medium">
                        Source v{version.versionNumber}
                        {version.originalFilename
                          ? ` · ${version.originalFilename}`
                          : ` · ${version.sourceKind}`}
                        <span className="text-muted-foreground">
                          {" "}
                          · {formatDate(version.createdAt)}
                        </span>
                      </p>
                      {version.canonicalVersions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No canonical versions yet.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {version.canonicalVersions.map((canonical) => {
                            const completed = canonical.status === "completed";
                            const selected = selectedVersionIds.includes(
                              canonical.id,
                            );
                            return (
                              <li
                                key={canonical.id}
                                className="flex flex-wrap items-center gap-2 text-sm"
                              >
                                <span>
                                  Canonical v{canonical.versionNumber} ·{" "}
                                  {canonical.status} · {canonical.provenanceLabel}{" "}
                                  · {formatDate(canonical.createdAt)}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setReadingVersionId(canonical.id)
                                  }
                                >
                                  Read
                                </Button>
                                {completed ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={selected ? "default" : "outline"}
                                    onClick={() => toggleVersion(canonical.id)}
                                  >
                                    {selected
                                      ? "Selected for generate"
                                      : "Select for generate"}
                                  </Button>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {readingVersionId ? (
        <section className="space-y-3" aria-labelledby="reader-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="reader-heading" className="font-heading text-xl font-bold">
              Canonical reader
            </h2>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReadingVersionId(null)}
            >
              Close
            </Button>
          </div>
          <CanonicalSourceReview
            progressive={{ workspaceId, versionId: readingVersionId }}
          />
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="generate-heading">
        <div>
          <h2 id="generate-heading" className="font-heading text-xl font-bold">
            Generate from completed sources
          </h2>
          <p className="text-sm text-muted-foreground">
            {completedVersions.length} completed version
            {completedVersions.length === 1 ? "" : "s"} available. Selection is
            sent as IDs only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={generating !== null || selectedVersionIds.length === 0}
            onClick={() => void runGenerate("quiz")}
          >
            {generating === "quiz" ? "Generating quiz…" : "Generate quiz"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={generating !== null || selectedVersionIds.length === 0}
            onClick={() => void runGenerate("flashcards")}
          >
            {generating === "flashcards"
              ? "Generating flashcards…"
              : "Generate flashcards"}
          </Button>
        </div>
        {generateError ? (
          <p className="text-sm text-destructive" role="alert">
            {generateError}
          </p>
        ) : null}
      </section>

      <section className="space-y-4" aria-labelledby="outputs-heading">
        <div>
          <h2 id="outputs-heading" className="font-heading text-xl font-bold">
            Outputs
          </h2>
          <p className="text-sm text-muted-foreground">
            Frozen quiz and flashcard sets stay reachable after source soft-delete.
          </p>
        </div>
        {detail.outputs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outputs yet.</p>
        ) : (
          <ul className="space-y-3">
            {detail.outputs.map((output) => {
              const overviewHref =
                output.kind === "flashcards"
                  ? flashcardOverview(output.bridgeStudySetId)
                  : quizOverview(output.bridgeStudySetId);
              const practiceHref =
                output.kind === "flashcards"
                  ? flashcardPlay(output.bridgeStudySetId)
                  : quizPlay(output.bridgeStudySetId);
              return (
                <li
                  key={output.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 py-3"
                >
                  <div>
                    <p className="font-medium">{output.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {output.kind} · {output.status} ·{" "}
                      {formatDate(output.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="rounded-md border border-border px-3 py-1.5 text-sm"
                      href={overviewHref}
                    >
                      Overview
                    </Link>
                    <Link
                      className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                      href={practiceHref}
                    >
                      Practice
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <WorkspaceCollaborationPanel
        workspaceId={workspaceId}
        membershipRole={detail.role}
      />

      <p>
        <Link href="/dashboard" className="text-sm text-muted-foreground underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
