"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardMobileBottomNav } from "@/components/dashboard/DashboardMobileBottomNav";
import { DashboardLibraryHeader } from "@/components/dashboard/DashboardLibraryHeader";
import { formatRelativeShort } from "@/components/dashboard/dashboardFormat";
import {
  createStudySet,
  flashcardOverview,
  quizOverview,
} from "@/lib/routes/studySetPaths";
import { useDashboardHome } from "@/hooks/useDashboardHome";
import type { WorkspaceSummary } from "@/lib/workspaces/workspaceSummary";

function workspaceHref(workspace: WorkspaceSummary): string {
  return `/workspace/${workspace.id}`;
}

function resumeHrefFor(workspace: WorkspaceSummary | null): string | null {
  if (!workspace) return null;
  const recent = workspace.recentOutputs[0];
  if (!recent) return workspaceHref(workspace);
  return recent.kind === "flashcards"
    ? flashcardOverview(recent.bridgeStudySetId)
    : quizOverview(recent.bridgeStudySetId);
}

function WorkspaceCard({
  workspace,
  updatedLabel,
}: {
  workspace: WorkspaceSummary;
  updatedLabel: string;
}) {
  const href = workspaceHref(workspace);
  const outputCount =
    workspace.quizOutputCount + workspace.flashcardOutputCount;

  return (
    <Link
      href={href}
      className="block rounded-xl border border-border/70 bg-card p-5 shadow-sm transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate font-heading text-lg font-bold">
            {workspace.title}
          </h3>
          {workspace.subtitle ? (
            <p className="truncate text-sm text-muted-foreground">
              {workspace.subtitle}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
          {workspace.role}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-muted-foreground sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide">Docs</dt>
          <dd className="font-medium text-foreground">
            {workspace.documentCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide">Canonical</dt>
          <dd className="font-medium text-foreground">
            {workspace.canonicalVersionCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide">Quiz</dt>
          <dd className="font-medium text-foreground">
            {workspace.quizOutputCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide">Cards</dt>
          <dd className="font-medium text-foreground">
            {workspace.flashcardOutputCount}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        {outputCount > 0
          ? `${outputCount} output${outputCount === 1 ? "" : "s"} · `
          : "No outputs yet · "}
        Updated {updatedLabel}
      </p>
    </Link>
  );
}

export function DashboardHomeClient() {
  const { search } = useLibrarySearch();
  const {
    loading,
    loadError,
    workspaces,
    filter,
    setFilter,
    sort,
    setSort,
    refresh,
    setsNeedingEditsCount,
    setsWithApproved,
    featuredNeedsEdit,
    resumeLatest,
    filteredSortedWorkspaces,
  } = useDashboardHome();

  useEffect(() => {
    const scrollToHash = () => {
      if (typeof window === "undefined") {
        return;
      }
      if (window.location.hash === "#library") {
        queueMicrotask(() =>
          document
            .getElementById("library")
            ?.scrollIntoView({ behavior: "smooth" }),
        );
      }
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  const resumeHref = resumeHrefFor(resumeLatest);
  const featuredEditHref = featuredNeedsEdit
    ? workspaceHref(featuredNeedsEdit)
    : null;

  if (loading) {
    return (
      <p className="py-6 text-sm text-muted-foreground" role="status">
        Loading study dashboard…
      </p>
    );
  }

  return (
    <>
      <div className="relative z-[1] mx-auto w-full max-w-7xl min-w-0 space-y-8 py-6 sm:py-8">
        <DashboardHero
          totalSets={workspaces.length}
          setsNeedingEdits={setsNeedingEditsCount}
          setsWithApproved={setsWithApproved}
          resumePlayHref={resumeHref}
          editSetHref={featuredEditHref}
          createHref={createStudySet()}
        />

        <section
          id="library"
          className="space-y-4"
          aria-label={search || "Library"}
        >
          <DashboardLibraryHeader
            filter={filter}
            onFilterChange={setFilter}
            sort={sort}
            onSortChange={setSort}
            totalSets={workspaces.length}
          />

          {loadError ? (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm text-destructive" role="alert">
                {loadError}
              </p>
              <button
                type="button"
                className="text-sm underline"
                onClick={() => void refresh()}
              >
                Try again
              </button>
            </div>
          ) : null}

          {filteredSortedWorkspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {workspaces.length === 0
                ? "No workspaces yet. Import a source to create one."
                : "No workspaces match these filters."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredSortedWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  workspace={workspace}
                  updatedLabel={formatRelativeShort(workspace.updatedAt)}
                />
              ))}
              <Link
                href={createStudySet()}
                className="flex min-h-[10rem] items-center justify-center rounded-xl border-2 border-dashed border-border/90 bg-muted/25 p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                Add workspace
              </Link>
            </div>
          )}
        </section>
      </div>

      <DashboardMobileBottomNav />
      <div className="h-16 md:hidden" aria-hidden />
    </>
  );
}
