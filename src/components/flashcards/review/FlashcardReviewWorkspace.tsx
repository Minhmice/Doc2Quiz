"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/buttons/button";
import { Textarea } from "@/components/ui/textarea";
import { editFlashcards, flashcardsPlay } from "@/lib/routes/studySetPaths";
import { cn } from "@/lib/utils";
import type { FlashcardVisionItem } from "@/types/visionParse";

const FRONT_WARN_CHARS = 200;
const BACK_WARN_CHARS = 500;

export type FlashcardReviewWorkspaceProps = Readonly<{
  studySetId: string;
  title?: string;
  subtitle?: string;
  cards: FlashcardVisionItem[];
  initialCards: FlashcardVisionItem[];
  activeCardId: string | null;
  onActiveCardIdChange: (id: string | null) => void;
  approvedIds: ReadonlySet<string>;
  onApprove: (id: string) => void;
  dirty: boolean;
  saving: boolean;
  onSaveAll: () => void;
  onFrontChange: (id: string, text: string) => void;
  onBackChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}>;

function cardEdited(
  cur: FlashcardVisionItem,
  init: FlashcardVisionItem | undefined,
): boolean {
  if (!init) {
    return false;
  }
  return cur.front !== init.front || cur.back !== init.back;
}

function statusForCard(
  id: string,
  approvedIds: ReadonlySet<string>,
  edited: boolean,
): "pending" | "edited" | "approved" {
  if (approvedIds.has(id)) {
    return "approved";
  }
  if (edited) {
    return "edited";
  }
  return "pending";
}

export function FlashcardReviewWorkspace({
  studySetId,
  title,
  subtitle,
  cards,
  initialCards,
  activeCardId,
  onActiveCardIdChange,
  approvedIds,
  onApprove,
  dirty,
  saving,
  onSaveAll,
  onFrontChange,
  onBackChange,
  onRemove,
}: FlashcardReviewWorkspaceProps) {
  const [listMode, setListMode] = useState<"list" | "compact">("list");

  const initialById = useMemo(() => {
    const m = new Map<string, FlashcardVisionItem>();
    for (const c of initialCards) {
      if (c.id) {
        m.set(c.id, c);
      }
    }
    return m;
  }, [initialCards]);

  const editedIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of cards) {
      if (!c.id) {
        continue;
      }
      const init = initialById.get(c.id);
      if (cardEdited(c, init)) {
        s.add(c.id);
      }
    }
    return s;
  }, [cards, initialById]);

  useEffect(() => {
    const ids = cards.map((c) => c.id).filter((x): x is string => Boolean(x));
    if (activeCardId && !ids.includes(activeCardId)) {
      onActiveCardIdChange(ids[0] ?? null);
    }
  }, [cards, activeCardId, onActiveCardIdChange]);

  const activeCard = useMemo(
    () => cards.find((c) => c.id === activeCardId) ?? null,
    [cards, activeCardId],
  );

  const reviewedCount = approvedIds.size;
  const total = cards.length;
  const revisionCount = editedIds.size;

  const navigatorSlots = useMemo(() => {
    return cards.map((c, i) => ({
      card: c,
      index: i,
      id: c.id ?? `idx-${i}`,
    }));
  }, [cards]);

  const frontTooLong =
    activeCard && activeCard.front.length > FRONT_WARN_CHARS;
  const backTooLong = activeCard && activeCard.back.length > BACK_WARN_CHARS;

  const handlePickCompact = useCallback(
    (id: string) => {
      onActiveCardIdChange(id);
    },
    [onActiveCardIdChange],
  );

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
        <p className="font-heading text-lg font-semibold text-foreground">
          No cards yet
        </p>
        <p className="text-sm text-muted-foreground">
          Run <span className="font-medium text-foreground">Parse with AI</span>{" "}
          on the Source step to generate flashcards from your PDF.
        </p>
        <Link
          href={editFlashcards(studySetId)}
          className={cn(
            buttonVariants({ variant: "default", size: "default" }),
            "inline-flex w-fit",
          )}
        >
          Go to Source
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <header className="space-y-6">
        <div className="space-y-2">
          <nav
            className="flex flex-wrap items-center gap-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <span className="text-[color:var(--d2q-blue)]">Doc2Quiz</span>
            <ChevronRight className="size-3 opacity-50" aria-hidden />
            <span className="opacity-80">Step 2 · Edit flashcards</span>
          </nav>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-accent-foreground sm:text-4xl">
            Edit your flashcards
          </h1>
          {title ? (
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
          ) : null}
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Refine the front and back of each card before studying. Mark cards you
            are happy with, then save and open the deck to study.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 border-l-4 border-primary bg-muted/40 px-6 py-5 shadow-sm ring-1 ring-border/60">
          <div className="flex flex-wrap gap-8">
            <div className="flex flex-col gap-0.5">
              <span className="font-label text-[10px] uppercase tracking-widest text-muted-foreground">
                Total volume
              </span>
              <span className="font-heading text-xl font-bold tabular-nums text-accent-foreground">
                {total} flashcard{total === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-label text-[10px] uppercase tracking-widest text-[color:var(--d2q-blue)]">
                Approved
              </span>
              <span className="font-heading text-xl font-bold tabular-nums text-[color:var(--d2q-blue)]">
                {reviewedCount} approved
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-label text-[10px] uppercase tracking-widest text-muted-foreground">
                Not approved
              </span>
              <span className="font-heading text-xl font-bold tabular-nums text-accent-foreground">
                {Math.max(0, total - reviewedCount)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-label text-[10px] uppercase tracking-widest text-primary">
                Revision
              </span>
              <span className="font-heading text-xl font-bold tabular-nums text-primary">
                {revisionCount} edited
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-label text-xs uppercase tracking-widest"
              disabled={!dirty || saving}
              onClick={() => onSaveAll()}
            >
              {saving ? "Saving…" : "Save all"}
            </Button>
            <Link
              href={flashcardsPlay(studySetId)}
              className={cn(
                buttonVariants({ size: "sm" }),
                "inline-flex items-center gap-2 font-label text-xs uppercase tracking-widest",
              )}
            >
              Study deck
              <Play className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-background/90 py-3 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${total ? Math.round((100 * reviewedCount) / total) : 0}%`,
                    }}
                  />
                </div>
                <span className="font-label text-xs tracking-tight text-muted-foreground">
                  {reviewedCount} / {total} reviewed
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    listMode === "list"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                  aria-label="List view"
                  onClick={() => setListMode("list")}
                >
                  <LayoutList className="size-4" />
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    listMode === "compact"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                  aria-label="Compact view"
                  onClick={() => setListMode("compact")}
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {activeCard?.id ? (
            <article className="space-y-6 border-l-4 border-primary bg-card p-6 shadow-sm ring-1 ring-border/50 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-label text-xs text-muted-foreground">
                    Card{" "}
                    {cards.findIndex((c) => c.id === activeCard.id) + 1}
                  </span>
                  <span
                    className={cn(
                      "rounded-sm px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider",
                      statusForCard(
                        activeCard.id,
                        approvedIds,
                        editedIds.has(activeCard.id),
                      ) === "approved"
                        ? "bg-[color:var(--d2q-blue)] text-white"
                        : statusForCard(
                              activeCard.id,
                              approvedIds,
                              editedIds.has(activeCard.id),
                            ) === "edited"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {statusForCard(
                      activeCard.id,
                      approvedIds,
                      editedIds.has(activeCard.id),
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove card"
                    onClick={() => {
                      if (activeCard.id) {
                        onRemove(activeCard.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  {activeCard.id && !approvedIds.has(activeCard.id) ? (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 bg-[color:var(--d2q-blue)] font-label text-[10px] uppercase tracking-widest text-white hover:bg-[color:var(--chart-4)]"
                      onClick={() => onApprove(activeCard.id!)}
                    >
                      Approve
                      <Check className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="font-label text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Front (question)
                  </label>
                  <Textarea
                    value={activeCard.front}
                    onChange={(e) =>
                      activeCard.id &&
                      onFrontChange(activeCard.id, e.target.value)
                    }
                    rows={listMode === "compact" ? 4 : 5}
                    className="min-h-[120px] resize-none border-0 bg-muted/50 font-heading text-base leading-relaxed focus-visible:border-b-2 focus-visible:border-primary"
                  />
                  {frontTooLong ? (
                    <p className="flex items-center gap-2 text-primary">
                      <AlertTriangle className="size-4 shrink-0" aria-hidden />
                      <span className="font-label text-[10px] uppercase tracking-widest">
                        Long front — consider shortening for study mode
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="relative space-y-2 md:border-l md:border-border/60 md:pl-8">
                  <label className="font-label text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Back
                  </label>
                  <Textarea
                    value={activeCard.back}
                    onChange={(e) =>
                      activeCard.id &&
                      onBackChange(activeCard.id, e.target.value)
                    }
                    rows={listMode === "compact" ? 4 : 5}
                    className="min-h-[120px] resize-none border-0 bg-muted/50 text-sm leading-relaxed focus-visible:border-b-2 focus-visible:border-primary"
                  />
                  {backTooLong ? (
                    <p className="flex items-center gap-2 text-primary">
                      <AlertTriangle className="size-4 shrink-0" aria-hidden />
                      <span className="font-label text-[10px] uppercase tracking-widest">
                        Long back — consider splitting concepts
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ) : null}

          <div className="space-y-3">
            <p className="font-label text-[10px] uppercase tracking-widest text-muted-foreground">
              Deck ({cards.length} cards)
            </p>
            {cards.map((c) => {
              const idx = cards.findIndex((x) => x === c);
              const cid = c.id ?? `idx-${idx}`;
              const isActive = c.id === activeCardId;
              if (isActive && listMode === "list") {
                return null;
              }
              const st = c.id
                ? statusForCard(c.id, approvedIds, editedIds.has(c.id))
                : "pending";
              const warn =
                c.front.length > FRONT_WARN_CHARS ||
                c.back.length > BACK_WARN_CHARS;
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => c.id && onActiveCardIdChange(c.id)}
                  className={cn(
                    "group flex w-full items-center justify-between gap-4 rounded-lg border border-transparent bg-muted/30 p-4 text-left transition-colors hover:bg-muted/60",
                    isActive && "ring-2 ring-primary/30",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden">
                    <span className="w-12 shrink-0 font-label text-xs text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div
                      className="hidden h-6 w-px bg-border sm:block"
                      aria-hidden
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-8">
                      <p className="truncate font-heading text-sm font-semibold text-foreground sm:max-w-[200px]">
                        {c.front || "—"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground sm:max-w-[280px]">
                        {c.back || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {warn ? (
                      <AlertTriangle
                        className="size-5 text-destructive"
                        aria-label="Length warning"
                      />
                    ) : null}
                    <span
                      className={cn(
                        "rounded-sm px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider",
                        st === "approved"
                          ? "bg-[color:var(--d2q-blue)]/15 text-[color:var(--d2q-blue)]"
                          : st === "edited"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {st}
                    </span>
                    <Pencil
                      className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70"
                      aria-hidden
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-6 lg:col-span-4 lg:sticky lg:top-4">
          <section className="rounded-xl bg-muted/40 p-5 ring-1 ring-border/60">
            <h3 className="mb-4 font-label text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Deck navigator
            </h3>
            <div className="grid grid-cols-6 gap-2">
              {navigatorSlots.map(({ card, index, id }) => {
                const st = card.id
                  ? statusForCard(card.id, approvedIds, editedIds.has(card.id))
                  : "pending";
                const active = card.id === activeCardId;
                return (
                  <button
                    key={id}
                    type="button"
                    title={`Card ${index + 1}`}
                    onClick={() => card.id && handlePickCompact(card.id)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-md font-label text-[10px] font-bold transition-transform",
                      active &&
                        "z-10 ring-2 ring-primary ring-offset-2 ring-offset-background",
                      st === "approved" &&
                        "bg-[color:var(--d2q-blue)] text-white hover:opacity-90",
                      st === "edited" &&
                        "bg-primary/20 text-primary hover:bg-primary/25",
                      st === "pending" &&
                        "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-2 font-label text-[10px] uppercase tracking-wider text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[color:var(--d2q-blue)]" />
                Approved
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary/60" />
                Edited
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-muted-foreground/40" />
                Pending
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-[color:var(--chart-4)]/10 p-5 text-accent-foreground ring-1 ring-[color:var(--chart-4)]/25">
            <h3 className="mb-2 font-label text-xs font-bold uppercase tracking-widest text-[color:var(--chart-4)]">
              Atomic knowledge
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              One idea per card. If a back paragraph tries to explain three
              concepts, split into multiple cards so review stays fast.
            </p>
          </section>
        </aside>
      </div>

      <p className="text-sm text-muted-foreground">
        <Link
          href={editFlashcards(studySetId)}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          ← Back to Source
        </Link>
      </p>
    </div>
  );
}
