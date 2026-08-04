"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  AlertCircle,
  ArrowRight,
  FileText,
  Layers,
  Play,
  Plus,
} from "lucide-react";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardHomeSkeleton } from "@/components/dashboard/DashboardHomeSkeleton";
import { DashboardLibraryHeader } from "@/components/dashboard/DashboardLibraryHeader";
import { formatRelativeShort } from "@/components/dashboard/dashboardFormat";
import {
  getContextualAction,
  type DashboardOutputCardModel,
  type WorkspaceCardModel,
} from "@/components/dashboard/workspaceDashboardModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import { useDashboardHome } from "@/hooks/useDashboardHome";

function RecentOutputCard({ output }: { output: DashboardOutputCardModel }) {
  const isFlashcard = output.kind === "flashcards";
  return (
    <article className="flex min-w-0 flex-col justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-primary/30">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={isFlashcard ? "secondary" : "default"}
            className="font-label text-[10px] font-bold uppercase tracking-wider"
          >
            {isFlashcard ? "Flashcards" : "Quiz"}
          </Badge>
          <time dateTime={output.updatedAt} className="text-xs tabular-nums text-muted-foreground">
            {formatRelativeShort(output.updatedAt)}
          </time>
        </div>
        <h3 className="truncate font-heading text-base font-bold text-foreground" title={output.title}>
          {output.title}
        </h3>
        <p className="truncate text-xs text-muted-foreground">
          in <span className="font-medium text-foreground">{output.workspaceTitle}</span>
        </p>
      </div>

      <Link
        href={output.href}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Play className="size-3.5 fill-current" aria-hidden />
        Practice
      </Link>
    </article>
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceCardModel }) {
  const action = getContextualAction(workspace);

  const getStatusBadge = () => {
    switch (workspace.status) {
      case "ready":
        return (
          <Badge variant="default" className="bg-[color:var(--d2q-blue)] text-white text-[10px] font-bold">
            Ready
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px] animate-pulse">
            Processing…
          </Badge>
        );
      case "processing_failed":
        return (
          <Badge variant="destructive" className="text-[10px] font-bold">
            Processing failed
          </Badge>
        );
      case "needs_review":
        return (
          <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/10 text-[10px] font-bold">
            Needs review
          </Badge>
        );
      case "empty":
      default:
        return (
          <Badge variant="secondary" className="text-[10px] font-bold text-muted-foreground">
            Empty
          </Badge>
        );
    }
  };

  return (
    <article className="group relative flex min-w-0 flex-col justify-between gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-primary/30">
      <div className="min-w-0 space-y-2">
        <div className="flex min-h-7 flex-wrap items-center gap-1.5">
          {getStatusBadge()}
          {workspace.role !== "owner" ? (
            <Badge variant="outline" className="text-[10px] font-medium capitalize">
              {workspace.role}
            </Badge>
          ) : null}
          <time dateTime={workspace.updatedAt} className="ml-auto text-xs tabular-nums text-muted-foreground">
            {formatRelativeShort(workspace.updatedAt)}
          </time>
        </div>

        <div>
          <h3 className="font-heading text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
            <Link href={workspace.href} className="inline-flex min-h-11 max-w-full items-center rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="truncate">{workspace.title}</span>
            </Link>
          </h3>
          {workspace.subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{workspace.subtitle}</p>
          ) : null}
        </div>

        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary" aria-hidden />
            <dt className="sr-only">Sources</dt>
            <dd><strong className="text-foreground">{workspace.sourceCount}</strong> sources · {workspace.readySourceCount} ready</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary" aria-hidden />
            <dt className="sr-only">Outputs</dt>
            <dd><strong className="text-foreground">{workspace.quizCount + workspace.flashcardCount}</strong> outputs</dd>
          </div>
        </dl>

        {workspace.latestOutputTitle ? (
          <p className="truncate rounded-md bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground" title={workspace.latestOutputTitle}>
            Latest: <span className="font-semibold text-foreground">{workspace.latestOutputTitle}</span>
          </p>
        ) : null}
      </div>

      <div className="border-t border-border/40 pt-3">
        <Link
          href={action.href}
          className={`inline-flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
            workspace.status === "ready"
              ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
              : "border-border bg-background text-foreground hover:bg-muted"
          }`}
        >
          <span>{action.label}</span>
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function DashboardHomeClient() {
  const { search } = useLibrarySearch();
  const { messages } = useLocale();
  const copy = messages.dashboard;
  const {
    loading,
    revalidating,
    loadError,
    workspaces,
    filter,
    setFilter,
    sort,
    setSort,
    refresh,
    filteredSortedWorkspaces,
    recentOutputs,
    counts,
  } = useDashboardHome();

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
    return <DashboardHomeSkeleton />;
  }

  // Workspaces that need attention
  const needsAttentionWorkspaces = filteredSortedWorkspaces.filter(
    (w) => w.status === "needs_review" || w.status === "processing_failed" || w.status === "processing",
  );

  return (
    <div className="relative z-1 w-full min-w-0 space-y-6 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      {/* Hero Section */}
      <DashboardHero
        totalWorkspaces={workspaces.length}
        readyCount={counts.ready}
        needsAttentionCount={counts.needsAttention}
        createHref="/create"
      />

      {/* Section 1: Continue Studying (Recent Ready Outputs) */}
      {recentOutputs.length > 0 ? (
        <section aria-labelledby="continue-studying-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="continue-studying-heading" className="font-heading text-lg font-bold text-foreground">
              Continue studying
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {recentOutputs.map((output) => (
              <RecentOutputCard key={output.id} output={output} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Section 2: Needs Attention (Conditional) */}
      {needsAttentionWorkspaces.length > 0 && filter === "all" ? (
        <aside aria-labelledby="needs-attention-heading" className="flex flex-col gap-3 rounded-xl bg-amber-500/8 p-4 ring-1 ring-amber-700/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300">
              <AlertCircle className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="needs-attention-heading" className="font-heading text-sm font-bold text-foreground">
                {needsAttentionWorkspaces.length} {needsAttentionWorkspaces.length === 1 ? "workspace needs" : "workspaces need"} attention
              </h2>
              <p className="mt-0.5 text-xs text-amber-950/75 dark:text-amber-100/75">
                Review sources, retry failed processing, or check active progress.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setFilter("needs_attention")} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-amber-100">
            Show workspaces
          </button>
        </aside>
      ) : null}

      {/* Section 3: Workspaces */}
      <section id="workspaces" className="space-y-4 scroll-mt-24" aria-label={search || copy.workspaces} aria-busy={revalidating}>
        <DashboardLibraryHeader
          filter={filter}
          onFilterChange={setFilter}
          sort={sort}
          onSortChange={setSort}
          totalWorkspaces={filteredSortedWorkspaces.length}
        />

        {loadError ? (
          <Alert variant="destructive" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AlertDescription className="font-semibold">{loadError}</AlertDescription>
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
              {copy.tryAgain}
            </Button>
          </Alert>
        ) : null}

        {filteredSortedWorkspaces.length === 0 ? (
          <Card className="flex min-h-56 flex-col items-center justify-center space-y-4 border-dashed p-8 text-center">
            <p className="max-w-lg text-pretty text-sm font-medium text-muted-foreground">
              {workspaces.length === 0
                ? copy.emptyDescription
                : search.trim()
                ? copy.noSearchMatch(search.trim())
                : copy.noFilterMatch}
            </p>
            {workspaces.length === 0 ? (
              <Link href="/create" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Plus className="size-4" />
                {copy.newWorkspace}
              </Link>
            ) : null}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredSortedWorkspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
