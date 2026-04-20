"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RenameStudySetDialog } from "@/components/dashboard/RenameStudySetDialog";
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
import { newRoot } from "@/lib/routes/studySetPaths";
import {
  deleteStudySet,
} from "@/lib/db/studySetDb";
import type { DashboardFilter, DashboardSetCounts, DashboardSort } from "@/hooks/useDashboardHome";
import { dispatchStudySetsChanged } from "@/hooks/useDashboardHome";
import type { StudySetMeta } from "@/types/studySet";

const DECK_GRADIENTS = [
  "from-indigo-500 to-emerald-600",
  "from-[color:var(--d2q-accent)] to-primary",
  "from-teal-500 to-[color:var(--d2q-blue)]",
] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function gradientFor(id: string, index: number): string {
  return DECK_GRADIENTS[(hashId(id) + index) % DECK_GRADIENTS.length]!;
}

const EMPTY_HEADLINE_IDLE = "No study sets yet.";
const EMPTY_HEADLINE_CTA = "Create study set";

const HIDE_FALLBACK_MS = 720;

function LibraryCardsSkeletonGrid() {
  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading your study sets"
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

/** Dashed “import PDF” CTA — empty library + trailing “more quiz” grid tile */
const dashboardPdfImportDashedLinkClassName = cn(
  "block rounded-lg border-[3px] border-dashed border-border/90 bg-muted/25 p-10 text-center",
  "box-border cursor-pointer outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-out",
  "hover:-translate-y-0.5 hover:border-[3px] hover:border-dashed hover:border-primary/55 hover:bg-muted/45 hover:shadow-md hover:shadow-primary/10",
  "motion-reduce:transition-colors motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none",
  "active:translate-y-0 active:border-[3px] active:scale-[0.995] active:transition-[transform] active:duration-150 motion-reduce:active:scale-100",
  "focus-visible:border-[3px] focus-visible:border-dashed focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

function EmptyLibraryZeroState() {
  const [headline, setHeadline] = useState(EMPTY_HEADLINE_IDLE);
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
      setHeadline(EMPTY_HEADLINE_CTA);
    } else if (pending === "idle") {
      setHeadline(EMPTY_HEADLINE_IDLE);
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
      setHeadline(EMPTY_HEADLINE_CTA);
      return;
    }
    if (headline === EMPTY_HEADLINE_CTA) {
      return;
    }
    if (!initialEnterDoneRef.current) {
      setHeadline(EMPTY_HEADLINE_CTA);
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
  }, [headline, reducedMotion, scheduleHideFallback, transitionLock]);

  const requestShowIdle = useCallback(() => {
    if (reducedMotion) {
      setHeadline(EMPTY_HEADLINE_IDLE);
      return;
    }
    if (headline === EMPTY_HEADLINE_IDLE) {
      return;
    }
    if (!initialEnterDoneRef.current) {
      setHeadline(EMPTY_HEADLINE_IDLE);
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
  }, [headline, reducedMotion, scheduleHideFallback, transitionLock]);

  return (
    <Link
      href={newRoot()}
      aria-label="Create a study set. Import a PDF to build your first set."
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
          Import a PDF to create your first set.
        </p>
      </div>
    </Link>
  );
}

function cardVariantFor(
  set: StudySetMeta,
  approved: number,
): DashboardStudySetCardVariant {
  if (approved <= 0) {
    return "needs_edit";
  }
  if (set.status === "ready") {
    return "ready";
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

  const reduceMotion = useReducedMotion() === true;

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
              You can still create a set below. If the message mentions a missing database column, apply pending
              Supabase migrations (for example{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">
                supabase/migrations/20260418_000002_add_study_set_parse_progress.sql
              </code>
              ).
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
              {search.trim() ? (
                <>
                  No sets match &ldquo;{search.trim()}&rdquo; for this filter.
                </>
              ) : (
                <>No sets match this filter.</>
              )}
            </p>
          ) : (
            <motion.div
              className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
              initial={reduceMotion ? false : "hidden"}
              animate={reduceMotion ? undefined : "show"}
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: 0.2,
                    delayChildren: 0.09,
                  },
                },
              }}
            >
              {filteredSortedSets.map((s, index) => {
                const c = counts[s.id] ?? { editorStaging: 0, approved: 0 };
                const variant = cardVariantFor(s, c.approved);
                return (
                  <motion.div
                    key={s.id}
                    className="h-full"
                    variants={{
                      hidden: { opacity: 0, y: 14 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: {
                          duration: 0.72,
                          ease: [0.22, 1, 0.36, 1],
                        },
                      },
                    }}
                  >
                    <DashboardStudySetCard
                      meta={s}
                      editorStagingCount={c.editorStaging}
                      approvedCount={c.approved}
                      hasMistakes={mistakes[s.id] === true}
                      variant={variant}
                      gradientClass={gradientFor(s.id, index)}
                      updatedLabel={formatRelativeShort(s.updatedAt)}
                      onRename={() => setRenameMeta(s)}
                      onDelete={() =>
                        setDeleteTarget({ meta: s, approvedCount: c.approved })
                      }
                    />
                  </motion.div>
                );
              })}

              <motion.div
                className="flex h-full min-h-0 flex-col"
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: 0.72,
                      ease: [0.22, 1, 0.36, 1],
                    },
                  },
                }}
              >
                <Link
                  href={newRoot()}
                  aria-label="Add another study set. Import a PDF to build more quizzes."
                  className={cn(
                    dashboardPdfImportDashedLinkClassName,
                    "flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center",
                  )}
                >
                  <div className="mx-auto flex max-w-md flex-col items-center px-2">
                    <p className="text-lg font-semibold text-foreground sm:text-xl">
                      More quiz
                    </p>
                    <p className="mt-2 text-pretty text-sm text-muted-foreground">
                      Import a PDF to add another study set.
                    </p>
                  </div>
                </Link>
              </motion.div>
            </motion.div>
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
            <AlertDialogTitle>Delete study set?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &ldquo;{deleteTarget?.meta.title ?? ""}&rdquo; and
              all of its data
              {deleteTarget && deleteTarget.approvedCount > 0
                ? `, including ${deleteTarget.approvedCount} approved question${deleteTarget.approvedCount === 1 ? "" : "s"}.`
                : "."}{" "}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
