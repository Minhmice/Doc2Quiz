"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RenameStudySetDialog } from "@/components/dashboard/RenameStudySetDialog";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
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
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_STATS_CHANGED_EVENT,
  STUDY_SETS_LIST_CHANGED_EVENT,
} from "@/lib/appEvents";
import {
  deleteStudySet,
  ensureStudySetDb,
  getApprovedBank,
  getDraftQuestions,
  listStudySetMetas,
} from "@/lib/db/studySetDb";
import { hasMistakesForStudySet } from "@/lib/studySet/activityTracking";
import type { StudySetMeta } from "@/types/studySet";

const DECK_ACCENTS = [
  "from-violet-600 via-violet-700 to-indigo-900",
  "from-orange-500 via-amber-600 to-orange-900",
  "from-sky-500 via-blue-600 to-indigo-900",
] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function accentFor(id: string, index: number) {
  return DECK_ACCENTS[(hashId(id) + index) % DECK_ACCENTS.length]!;
}

function dispatchStudySetsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STUDY_SETS_LIST_CHANGED_EVENT));
  }
}

export function DashboardLibraryClient() {
  const router = useRouter();
  const { search } = useLibrarySearch();
  const [sets, setSets] = useState<StudySetMeta[]>([]);
  const [counts, setCounts] = useState<
    Record<string, { draft: number; approved: number }>
  >({});
  const [mistakes, setMistakes] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renameMeta, setRenameMeta] = useState<StudySetMeta | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    meta: StudySetMeta;
    approvedCount: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      await ensureStudySetDb();
      const list = await listStudySetMetas();
      setSets(list);
      const next: Record<string, { draft: number; approved: number }> = {};
      const mist: Record<string, boolean> = {};
      await Promise.all(
        list.map(async (s) => {
          const [draft, bank] = await Promise.all([
            getDraftQuestions(s.id),
            getApprovedBank(s.id),
          ]);
          next[s.id] = {
            draft: draft.length,
            approved: bank?.questions.length ?? 0,
          };
          mist[s.id] = await hasMistakesForStudySet(s.id);
        }),
      );
      setCounts(next);
      setMistakes(mist);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load study sets.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onActivity = () => void refresh();
    window.addEventListener(ACTIVITY_STATS_CHANGED_EVENT, onActivity);
    return () =>
      window.removeEventListener(ACTIVITY_STATS_CHANGED_EVENT, onActivity);
  }, [refresh]);

  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return sets;
    }
    return sets.filter((s) => {
      const t = s.title.toLowerCase();
      const f = (s.sourceFileName ?? "").toLowerCase();
      const sub = (s.subtitle ?? "").toLowerCase();
      return t.includes(q) || f.includes(q) || sub.includes(q);
    });
  }, [sets, search]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    await deleteStudySet(deleteTarget.meta.id);
    setDeleteTarget(null);
    await refresh();
    dispatchStudySetsChanged();
  }, [deleteTarget, refresh]);

  return (
    <div className="flex flex-col gap-6">
      <header className="min-w-0">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Library
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your study sets — take a quiz, review mistakes, or open the editor from
          each card.
        </p>
      </header>

      {loadError ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      {sets.length === 0 && !loadError ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-foreground">No study sets yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Import a PDF to create your first set.
          </p>
          <Link
            href="/sets/new"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "mt-6 inline-flex font-semibold",
            )}
          >
            Import PDF
          </Link>
        </div>
      ) : null}

      {sets.length > 0 && !loadError ? (
        <>
          {filteredSets.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No sets match &ldquo;{search.trim()}&rdquo;.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredSets.map((s, index) => {
                const c = counts[s.id] ?? { draft: 0, approved: 0 };
                const grad = accentFor(s.id, index);
                const showMistakes = mistakes[s.id] === true && c.approved > 0;

                return (
                  <li key={s.id}>
                    <Card className="group relative flex h-full flex-col overflow-hidden pt-0 shadow-md transition-shadow hover:shadow-lg">
                      <div
                        className={cn(
                          "h-24 shrink-0 bg-gradient-to-br",
                          grad,
                        )}
                      />
                      <CardHeader className="space-y-2">
                        <CardTitle className="line-clamp-2 text-lg leading-snug">
                          {s.title}
                        </CardTitle>
                        {s.subtitle ? (
                          <p className="line-clamp-2 text-sm font-medium text-muted-foreground">
                            {s.subtitle}
                          </p>
                        ) : null}
                        <CardDescription className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="font-normal">
                            {c.approved} approved
                          </Badge>
                          {c.draft > 0 ? (
                            <Badge variant="outline" className="font-normal">
                              {c.draft} draft
                            </Badge>
                          ) : null}
                        </CardDescription>
                        <p className="text-xs text-muted-foreground">
                          Source: {s.sourceFileName ?? "—"}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 pb-2 pt-0">
                        <p className="text-xs text-muted-foreground">
                          Updated {new Date(s.updatedAt).toLocaleString()}
                        </p>
                      </CardContent>
                      <CardFooter className="flex flex-wrap gap-2 border-t border-border bg-muted/20 pt-4">
                        <Link
                          href={`/sets/${s.id}/play`}
                          className={cn(buttonVariants({ size: "sm" }))}
                        >
                          Take quiz
                        </Link>
                        {showMistakes ? (
                          <Link
                            href={`/sets/${s.id}/play?review=mistakes`}
                            className={cn(
                              buttonVariants({ size: "sm", variant: "secondary" }),
                            )}
                          >
                            Review mistakes
                          </Link>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className={cn(
                              buttonVariants({ size: "sm", variant: "outline" }),
                            )}
                          >
                            More
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-44">
                            <DropdownMenuItem
                              onClick={() => router.push(`/sets/${s.id}/source`)}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setRenameMeta(s)}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                setDeleteTarget({ meta: s, approvedCount: c.approved })
                              }
                            >
                              Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled>
                              Share (coming soon)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardFooter>
                    </Card>
                  </li>
                );
              })}

              <li className="flex min-h-0">
                <Link href="/sets/new" className="flex h-full min-h-0 w-full">
                  <Card className="flex h-full min-h-[18rem] w-full flex-col overflow-hidden border-2 border-dashed border-border bg-card/40 pt-0 shadow-md transition-colors hover:border-primary/50 hover:bg-card/60">
                    <div
                      className="h-24 shrink-0 border-b border-dashed border-border bg-muted/40"
                      aria-hidden
                    />
                    <CardHeader className="flex flex-1 flex-col items-center justify-center space-y-2 pb-2 text-center">
                      <span className="text-4xl font-light leading-none text-muted-foreground">
                        +
                      </span>
                      <CardTitle className="text-base font-semibold text-foreground">
                        Add new set
                      </CardTitle>
                      <CardDescription className="max-w-[14rem] text-pretty">
                        Import a PDF to start a new study set
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="mt-auto flex justify-center border-t border-dashed border-border bg-muted/10 py-4">
                      <span
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "pointer-events-none",
                        )}
                      >
                        Get started
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              </li>
            </ul>
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
          void refresh().then(() => dispatchStudySetsChanged());
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
    </div>
  );
}
