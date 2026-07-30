"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardLibraryHeader } from "@/components/dashboard/DashboardLibraryHeader";
import { DashboardMobileBottomNav } from "@/components/dashboard/DashboardMobileBottomNav";
import { formatRelativeShort } from "@/components/dashboard/dashboardFormat";
import type { WorkspaceCardModel } from "@/components/dashboard/workspaceDashboardModel";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import { useDashboardHome } from "@/hooks/useDashboardHome";
import { createStudySet } from "@/lib/routes/studySetPaths";

function WorkspaceCard({ workspace }: { workspace: WorkspaceCardModel }) {
  const { messages } = useLocale();
  const copy = messages.dashboard;
  return (
    <article className="flex min-h-56 flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="font-label text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        <span aria-hidden>● </span>{copy.statuses[workspace.status]}
      </p>
      <h3 className="mt-2 truncate font-heading text-base font-semibold">{workspace.title}</h3>
      {workspace.subtitle ? <p className="mt-1 truncate text-sm text-muted-foreground">{workspace.subtitle}</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{copy.metrics.sources}</dt><dd className="font-medium">{workspace.sourceCount}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{copy.metrics.quiz}</dt><dd className="font-medium">{workspace.quizCount}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{copy.metrics.flashcards}</dt><dd className="font-medium">{workspace.flashcardCount}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{copy.metrics.lastActivity}</dt><dd className="font-medium">{formatRelativeShort(workspace.updatedAt)}</dd></div>
      </dl>
      <Link href={workspace.href} className="mt-auto inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {copy.openWorkspace}
      </Link>
    </article>
  );
}

export function DashboardHomeClient() {
  const { search } = useLibrarySearch();
  const { messages } = useLocale();
  const copy = messages.dashboard;
  const { loading, revalidating, loadError, workspaces, filter, setFilter, sort, setSort, refresh, resume, review, filteredSortedWorkspaces } = useDashboardHome();

  useEffect(() => {
    const scrollToHash = () => {
      if (window.location.hash === "#library" || window.location.hash === "#workspaces") {
        queueMicrotask(() => document.getElementById("workspaces")?.scrollIntoView({ behavior: "smooth" }));
      }
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  if (loading && workspaces.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground" role="status">{copy.loadingDashboard}</p>;
  }

  return (
    <>
      <div className="relative z-1 w-full min-w-0 space-y-5 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <DashboardHero totalWorkspaces={workspaces.length} resumeHref={resume?.href ?? null} reviewHref={review?.href ?? null} createHref={createStudySet()} />
        <section id="workspaces" className="space-y-4 scroll-mt-24" aria-label={search || copy.workspaces} aria-busy={revalidating}>
          <DashboardLibraryHeader filter={filter} onFilterChange={setFilter} sort={sort} onSortChange={setSort} totalWorkspaces={workspaces.length} />
          {loadError ? (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4" role="alert">
              <p className="text-sm text-destructive">{loadError}</p>
              <button type="button" className="min-h-11 text-sm underline" onClick={() => void refresh()}>{copy.tryAgain}</button>
            </div>
          ) : null}
          {filteredSortedWorkspaces.length === 0 ? (
            <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
              <p className="text-sm text-muted-foreground">{workspaces.length === 0 ? copy.emptyDescription : search.trim() ? copy.noSearchMatch(search.trim()) : copy.noFilterMatch}</p>
              {workspaces.length === 0 ? <Link href={createStudySet()} className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">{copy.newWorkspace}</Link> : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredSortedWorkspaces.map((workspace) => <WorkspaceCard key={workspace.id} workspace={workspace} />)}
            </div>
          )}
        </section>
      </div>
      <DashboardMobileBottomNav />
      <div className="h-16 md:hidden" aria-hidden />
    </>
  );
}
