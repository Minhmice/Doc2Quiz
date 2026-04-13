"use client";

import Link from "next/link";
import { ArrowLeft, Layers2, SquareStack } from "lucide-react";
import { ImportStepTabStrip } from "@/components/sets/new/import/StudySetNewImportStepContext";
import { newRoot } from "@/lib/routes/studySetPaths";

export type FlashcardsImportWorkbenchHeaderProps = {
  /** Primary line (e.g. workbench title) */
  title: string;
  /** Short deck/stack path cue */
  pathCue: string;
};

export function FlashcardsImportWorkbenchHeader({
  title,
  pathCue,
}: Readonly<FlashcardsImportWorkbenchHeaderProps>) {
  return (
    <header className="relative z-20 flex w-full shrink-0 flex-col border-b border-border/40 bg-secondary/90 backdrop-blur-md">
      <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <Link
            href={newRoot()}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Back to create quiz or flashcards"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="h-6 w-px shrink-0 bg-border/50" aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <SquareStack className="size-4 shrink-0 text-accent-foreground" aria-hidden />
              <p className="font-heading truncate text-base font-extrabold tracking-tight text-accent-foreground sm:text-lg">
                {title}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {pathCue}
              </span>
            </div>
          </div>
          <div className="hidden h-6 w-px shrink-0 bg-border/50 sm:block" aria-hidden />
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Stack
            </span>
            <span className="truncate text-xs font-medium text-foreground">Front · back pairs</span>
          </div>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden flex-col items-end text-right md:flex">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Deck build
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-accent-foreground">
              <Layers2 className="size-3.5 shrink-0" aria-hidden />
              PDF → cards
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-border/30 px-4 py-2 sm:px-6">
        <ImportStepTabStrip className="max-w-xs" />
      </div>
    </header>
  );
}
