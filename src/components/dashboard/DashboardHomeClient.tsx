"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  Layers,
  MoreHorizontal,
  Play,
  Plus,
  Share2,
  Sparkles,
} from "lucide-react";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardLibraryHeader } from "@/components/dashboard/DashboardLibraryHeader";
import { DashboardMobileBottomNav } from "@/components/dashboard/DashboardMobileBottomNav";
import { formatRelativeShort } from "@/components/dashboard/dashboardFormat";
import {
  getContextualAction,
  type DashboardOutputCardModel,
  type WorkspaceCardModel,
} from "@/components/dashboard/workspaceDashboardModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import { useDashboardHome } from "@/hooks/useDashboardHome";

function RecentOutputCard({ output }: { output: DashboardOutputCardModel }) {
  const isFlashcard = output.kind === "flashcards";
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-2xs transition-all hover:border-primary/40 flex flex-col justify-between gap-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={isFlashcard ? "secondary" : "default"}
            className="font-label text-[10px] tracking-wider uppercase font-bold"
          >
            {isFlashcard ? "Flashcards" : "Quiz"}
          </Badge>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatRelativeShort(output.updatedAt)}
          </span>
        </div>
        <h3 className="font-heading font-bold text-base text-foreground truncate">
          {output.title}
        </h3>
        <p className="text-xs text-muted-foreground truncate">
          in <span className="font-medium text-foreground">{output.workspaceTitle}</span>
        </p>
      </div>

      <Link href={output.href} className="w-full">
        <Button size="sm" className="w-full gap-2 font-medium bg-oxblood-primary text-white">
          <Play className="size-3.5 fill-current" />
          Practice
        </Button>
      </Link>
    </div>
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceCardModel }) {
  const action = getContextualAction(workspace);

  const getStatusBadge = () => {
    switch (workspace.status) {
      case "ready":
        return (
          <Badge variant="default" className="bg-forest-sage text-white text-[10px] font-bold">
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
    <article className="group relative flex flex-col justify-between rounded-xl border border-border/60 bg-card p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs space-y-4">
      <div className="space-y-2 min-w-0">
        {/* Header Badges & Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {getStatusBadge()}
            {workspace.role !== "owner" ? (
              <Badge variant="outline" className="text-[10px] capitalize font-medium">
                {workspace.role}
              </Badge>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" className="size-8" aria-label={`Actions for ${workspace.title}`} />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { window.location.href = workspace.href; }}>
                Open workspace
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { window.location.href = workspace.href; }}>
                Share
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title & Subtitle */}
        <div>
          <h3 className="font-heading text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
            <Link href={workspace.href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
              {workspace.title}
            </Link>
          </h3>
          {workspace.subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{workspace.subtitle}</p>
          ) : null}
        </div>

        {/* Metrics Summary */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium pt-1">
          <span className="flex items-center gap-1">
            <FileText className="size-3.5 text-primary" />
            <strong className="text-foreground">{workspace.sourceCount}</strong> sources ({workspace.readySourceCount} ready)
          </span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-1">
            <Layers className="size-3.5 text-oxblood-primary" />
            <strong className="text-foreground">{workspace.quizCount + workspace.flashcardCount}</strong> outputs
          </span>
        </div>

        {/* Latest Output Tag */}
        {workspace.latestOutputTitle ? (
          <p className="text-[11px] text-muted-foreground truncate bg-muted/40 rounded-md px-2 py-1 font-medium">
            Latest: <span className="text-foreground font-semibold">{workspace.latestOutputTitle}</span>
          </p>
        ) : null}
      </div>

      {/* Primary Contextual Action */}
      <div className="pt-2 border-t border-border/40">
        <Link href={action.href} className="w-full block">
          <Button
            type="button"
            variant={workspace.status === "ready" ? "default" : "outline"}
            size="sm"
            className={`w-full justify-between font-medium text-xs ${
              workspace.status === "ready" ? "bg-oxblood-primary text-white" : ""
            }`}
          >
            <span>{action.label}</span>
            <ArrowRight className="size-3.5" />
          </Button>
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
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-8 text-center" role="status">
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {copy.loadingDashboard}
        </p>
      </div>
    );
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
            <h2 id="continue-studying-heading" className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
              <BookOpen className="size-4 text-oxblood-primary" />
              Continue studying
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentOutputs.map((output) => (
              <RecentOutputCard key={output.id} output={output} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Section 2: Needs Attention (Conditional) */}
      {needsAttentionWorkspaces.length > 0 && filter === "all" ? (
        <section aria-labelledby="needs-attention-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="needs-attention-heading" className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-600" />
              Needs attention ({needsAttentionWorkspaces.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {needsAttentionWorkspaces.slice(0, 3).map((ws) => (
              <WorkspaceCard key={ws.id} workspace={ws} />
            ))}
          </div>
        </section>
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
          <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
            <p className="text-sm font-semibold text-destructive">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
              {copy.tryAgain}
            </Button>
          </div>
        ) : null}

        {filteredSortedWorkspaces.length === 0 ? (
          <Card className="p-8 text-center border-dashed space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              {workspaces.length === 0
                ? copy.emptyDescription
                : search.trim()
                ? copy.noSearchMatch(search.trim())
                : copy.noFilterMatch}
            </p>
            {workspaces.length === 0 ? (
              <Link href="/create" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-oxblood-primary px-4 text-sm font-semibold text-white">
                <Plus className="size-4" />
                {copy.newWorkspace}
              </Link>
            ) : null}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSortedWorkspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
        )}
      </section>

      <DashboardMobileBottomNav />
      <div className="h-16 md:hidden" aria-hidden />
    </div>
  );
}
