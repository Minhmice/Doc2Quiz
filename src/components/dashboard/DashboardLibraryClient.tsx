"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RenameStudySetDialog } from "@/components/dashboard/RenameStudySetDialog";
import { useLocale } from "@/components/locale/LocaleProvider";
import { LocalizedSlangLine } from "@/components/locale/LocalizedCopy";
import { DashboardLibraryHeader } from "@/components/dashboard/DashboardLibraryHeader";
import { DashboardStudySetCard } from "@/components/dashboard/DashboardStudySetCard";
import type { DashboardStudySetCardVariant } from "@/components/dashboard/DashboardStudySetCard";
import { formatRelativeShort } from "@/components/dashboard/dashboardFormat";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  VerticalCutReveal,
  type VerticalCutRevealRef,
} from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";
import { createStudySet } from "@/lib/routes/studySetPaths";
import {
  deleteStudySet,
} from "@/lib/client/studySetDb";
import type { DashboardFilter, DashboardSetCounts, DashboardSort } from "@/hooks/useDashboardHome";
import { dispatchStudySetsChanged } from "@/hooks/useDashboardHome";
import type { PipelineStage, StudySetMeta } from "@/types/studySet";

const HIDE_FALLBACK_MS = 720;

function LibraryCardsSkeletonGrid() {
  const { messages } = useLocale();
  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label={messages.dashboard.loadingSets}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-border/70 bg-card p-5 shadow-sm"
        >
          <Skeleton className="h-5 w-3/4 motion-reduce:animate-none" />
          <Skeleton className="mt-2 h-4 w-1/2 motion-reduce:animate-none" />
          <div className="mt-5 flex items-center gap-3">
            <Skeleton className="h-9 w-24 motion-reduce:animate-none" />
            <Skeleton className="h-9 w-20 motion-reduce:animate-none" />
            <Skeleton className="ml-auto h-9 w-9 rounded-full motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Dashed “import text” CTA — empty library + trailing “add study set” grid tile */
const dashboardPdfImportDashedLinkClassName = cn(
      "block rounded-lg border-2 border-dashed border-border/90 bg-muted/25 p-10 text-center",
  "box-border cursor-pointer outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-out",
  "hover:-translate-y-0.5 hover:border-[3px] hover:border-dashed hover:border-primary/55 hover:bg-muted/45 hover:shadow-md hover:shadow-primary/10",
  "motion-reduce:transition-colors motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none",
  "active:translate-y-0 active:border-[3px] active:scale-[0.995] active:transition-[transform] active:duration-150 motion-reduce:active:scale-100",
  "focus-visible:border-[3px] focus-visible:border-dashed focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

function EmptyLibraryZeroState() {
  const { locale, messages } = useLocale();
  const copy = messages.dashboard;
  const [headlineMode, setHeadlineMode] = useState<"idle" | "cta">("idle");
  const headline = headlineMode === "cta" ? copy.emptyCta : copy.emptyTitle;
  const [reducedMotion, setReducedMotion] = useState(false);
  const [transitionLock, setTransitionLock] = useState(false);
  const revealRef = useRef<VerticalCutRevealRef | null>(null);
  const pendingAfterHideRef = useRef<"cta" | "idle" | null>(null);
  const initialEnterDoneRef = useRef(false);
  const hideFallbackTimerRef = useRef<number | null>(null);

  const clearHideFallback = useCallback(() => {
    if (hideFallbackTimerRef.current != null) {
      window.clearTimeout(hideFallbackTimerRef.current);
      hideFallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      initialEnterDoneRef.current = true;
      return;
    }
    queueMicrotask(() => revealRef.current?.startAnimation());
  }, [reducedMotion]);

  useEffect(() => {
    return () => clearHideFallback();
  }, [clearHideFallback]);

  const finishHideAndContinue = useCallback(() => {
    clearHideFallback();
    const pending = pendingAfterHideRef.current;
    if (pending == null) {
      return;
    }
    pendingAfterHideRef.current = null;
    if (pending === "cta") {
      setHeadlineMode("cta");
    } else if (pending === "idle") {
      setHeadlineMode("idle");
    }
    queueMicrotask(() => {
      revealRef.current?.startAnimation();
      setTransitionLock(false);
    });
  }, [clearHideFallback]);

  const scheduleHideFallback = useCallback(() => {
    clearHideFallback();
    hideFallbackTimerRef.current = window.setTimeout(() => {
      hideFallbackTimerRef.current = null;
      if (pendingAfterHideRef.current != null) {
        finishHideAndContinue();
      }
    }, HIDE_FALLBACK_MS);
  }, [clearHideFallback, finishHideAndContinue]);

  const requestShowCta = useCallback(() => {
    if (reducedMotion) {
      setHeadlineMode("cta");
      return;
    }
    if (headlineMode === "cta") {
      return;
    }
    if (!initialEnterDoneRef.current) {
      setHeadlineMode("cta");
      queueMicrotask(() => revealRef.current?.startAnimation());
      return;
    }
    if (transitionLock) {
      return;
    }
    setTransitionLock(true);
    pendingAfterHideRef.current = "cta";
    revealRef.current?.reset();
    scheduleHideFallback();
  }, [headlineMode, reducedMotion, scheduleHideFallback, transitionLock]);

  const requestShowIdle = useCallback(() => {
    if (reducedMotion) {
      setHeadlineMode("idle");
      return;
    }
    if (headlineMode === "idle") {
      return;
    }
    if (!initialEnterDoneRef.current) {
      setHeadlineMode("idle");
      queueMicrotask(() => revealRef.current?.startAnimation());
      return;
    }
    if (transitionLock) {
      return;
    }
    setTransitionLock(true);
    pendingAfterHideRef.current = "idle";
    revealRef.current?.reset();
    scheduleHideFallback();
  }, [headlineMode, reducedMotion, scheduleHideFallback, transitionLock]);

  return (
    <Link
      href={createStudySet()}
      aria-label={copy.emptyAria}
      className={dashboardPdfImportDashedLinkClassName}
      onMouseEnter={requestShowCta}
      onMouseLeave={requestShowIdle}
      onFocus={requestShowCta}
      onBlur={requestShowIdle}
    >
      <div className="mx-auto flex max-w-lg flex-col items-center">
        <div className="flex min-h-10 w-full items-center justify-center sm:min-h-12">
          {reducedMotion ? (
            <p className="text-lg font-semibold text-foreground sm:text-xl">
              {headline}
            </p>
          ) : (
            <div className="text-lg font-semibold text-foreground sm:text-xl">
              <VerticalCutReveal
                ref={revealRef}
                splitBy="characters"
                staggerDuration={0.025}
                staggerFrom="first"
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 22,
                }}
                autoStart={false}
                onComplete={() => {
                  initialEnterDoneRef.current = true;
                }}
                onHideComplete={finishHideAndContinue}
                containerClassName="flex-nowrap justify-center"
                className="justify-center"
              >
                {headline}
              </VerticalCutReveal>
            </div>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {copy.emptyDescription}
        </p>
        <LocalizedSlangLine context="empty" eventKey={`dashboard-empty:${locale}`} className="mt-2 text-xs leading-relaxed text-muted-foreground" />
      </div>
    </Link>
  );
}

function stageRank(stage: PipelineStage): number {
  const order: PipelineStage[] = [
    "input",
    "raw",
    "canonical",
    "mode_selected",
    "quiz",
    "flashcards",
  ];
  return order.indexOf(stage);
}

function cardVariantFor(
  set: StudySetMeta,
  approved: number,
): DashboardStudySetCardVariant {
  if (approved > 0 && set.pipelineStage === "quiz") {
    return "ready";
  }
  if (approved > 0 && set.pipelineStage === "flashcards") {
    return "ready";
  }
  if (approved === 0 && stageRank(set.pipelineStage) < stageRank("quiz")) {
    return "needs_edit";
  }
  if (approved <= 0) {
    return "needs_edit";
  }
  return "in_progress";
}

export type DashboardLibraryClientProps = Readonly<{
  loading: boolean;
  loadError: string | null;
  setsLength: number;
  search: string;
  totalSets: number;
  filter: DashboardFilter;
  onFilterChange: (f: DashboardFilter) => void;
  sort: DashboardSort;
  onSortChange: (s: DashboardSort) => void;
  filteredSortedSets: StudySetMeta[];
  counts: DashboardSetCounts;
  mistakes: Record<string, boolean>;
  onRefresh: () => Promise<void>;
}>;

export function DashboardLibraryClient({
  loading,
  loadError,
  setsLength,
  search,
  totalSets,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  filteredSortedSets,
  counts,
  mistakes,
  onRefresh,
}: DashboardLibraryClientProps) {
  const { locale, messages } = useLocale();
  const copy = messages.dashboard;
  const [renameMeta, setRenameMeta] = useState<StudySetMeta | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    meta: StudySetMeta;
    approvedCount: number;
  } | null>(null);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    await deleteStudySet(deleteTarget.meta.id);
    setDeleteTarget(null);
    await onRefresh();
    dispatchStudySetsChanged();
  }, [deleteTarget, onRefresh]);

  return (
    <section
      id="library"
      className="space-y-6 scroll-mt-24"
      aria-busy={loading ? "true" : "false"}
    >
      <DashboardLibraryHeader
        totalSets={totalSets}
        filter={filter}
        onFilterChange={onFilterChange}
        sort={sort}
        onSortChange={onSortChange}
      />

      {loadError ? (
        <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4" role="alert">
          <p className="text-sm font-medium text-destructive">{loadError}</p>
          {setsLength === 0 && !loading ? (
            <p className="text-xs text-muted-foreground">
              {copy.loadRecovery}
            </p>
          ) : null}
        </div>
      ) : null}

      {setsLength === 0 && loading ? <LibraryCardsSkeletonGrid /> : null}

      {setsLength === 0 && !loading ? <EmptyLibraryZeroState /> : null}

      {setsLength > 0 && !loadError ? (
        <>
          {filteredSortedSets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 bg-muted/25 p-8 text-center text-sm text-muted-foreground">
              {search.trim() ? copy.noSearchMatch(search.trim()) : copy.noFilterMatch}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredSortedSets.map((s) => {
                const c = counts[s.id] ?? { editorStaging: 0, approved: 0 };
                const variant = cardVariantFor(s, c.approved);
                return (
                  <div key={s.id} className="h-full">
                    <DashboardStudySetCard
                      meta={s}
                      editorStagingCount={c.editorStaging}
                      approvedCount={c.approved}
                      hasMistakes={mistakes[s.id] === true}
                      variant={variant}
                      updatedLabel={formatRelativeShort(s.updatedAt)}
                      onRename={() => setRenameMeta(s)}
                      onDelete={() =>
                        setDeleteTarget({ meta: s, approvedCount: c.approved })
                      }
                    />
                  </div>
                );
              })}

              <div className="flex h-full min-h-0 flex-col">
                <Link
                  href={createStudySet()}
                  aria-label={copy.addAria}
                  className={cn(
                    dashboardPdfImportDashedLinkClassName,
                    "flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center",
                  )}
                >
                  <div className="mx-auto flex max-w-md flex-col items-center px-2">
                    <p className="text-lg font-semibold text-foreground sm:text-xl">
                      {copy.addTitle}
                    </p>
                    <p className="mt-2 text-pretty text-sm text-muted-foreground">
                      {copy.addDescription}
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </>
      ) : null}

      <RenameStudySetDialog
        open={renameMeta !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameMeta(null);
          }
        }}
        meta={renameMeta}
        onSaved={() => {
          void onRefresh().then(() => dispatchStudySetsChanged());
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.deleteDescription(
                deleteTarget?.meta.title ?? "",
                deleteTarget && deleteTarget.approvedCount > 0
                  ? new Intl.NumberFormat(locale).format(deleteTarget.approvedCount)
                  : null,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              {copy.deleteAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
