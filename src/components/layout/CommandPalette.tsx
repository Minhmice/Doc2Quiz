"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  PlusIcon,
  SettingsIcon,
  BookOpenIcon,
  SearchIcon,
  LayersIcon,
  FlaskConical,
} from "lucide-react";
import { FOCUS_LIBRARY_SEARCH_EVENT } from "@/lib/appEvents";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/db/studySetDb";
import {
  editFlashcards,
  editQuiz,
  flashcardsPlay,
  newRoot,
  quizPlay,
} from "@/lib/routes/studySetPaths";
import type { StudyContentKind } from "@/types/studySet";

function studySetIdFromPathname(pathname: string): string | undefined {
  const patterns = [
    /^\/sets\/([^/]+)/,
    /^\/quiz\/([^/]+)/,
    /^\/flashcards\/([^/]+)/,
    /^\/edit\/quiz\/([^/]+)/,
    /^\/edit\/flashcards\/([^/]+)/,
  ];
  for (const re of patterns) {
    const m = pathname.match(re);
    if (m?.[1]) {
      return m[1];
    }
  }
  return undefined;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [contentKind, setContentKind] = useState<StudyContentKind | null>(null);

  const studySetId = studySetIdFromPathname(pathname);

  useEffect(() => {
    if (!studySetId) {
      setContentKind(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await ensureStudySetDb();
        const meta = await getStudySetMeta(studySetId);
        if (!cancelled) {
          setContentKind(meta?.contentKind ?? null);
        }
      } catch {
        if (!cancelled) {
          setContentKind(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studySetId]);

  const reviewHref =
    studySetId === undefined
      ? ""
      : contentKind === "flashcards"
        ? editFlashcards(studySetId)
        : editQuiz(studySetId);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Search commands…" />
        <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem
            onSelect={() => {
              go("/dashboard");
              requestAnimationFrame(() =>
                window.dispatchEvent(new Event(FOCUS_LIBRARY_SEARCH_EVENT)),
              );
            }}
          >
            <SearchIcon />
            Search study sets
          </CommandItem>
          <CommandItem onSelect={() => go(newRoot())}>
            <PlusIcon />
            New study set
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <SettingsIcon />
            Settings
          </CommandItem>
        </CommandGroup>
        {studySetId ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Current set">
              <CommandItem onSelect={() => go(reviewHref)}>
                <BookOpenIcon />
                Open editor
              </CommandItem>
              {contentKind === "flashcards" ? (
                <CommandItem onSelect={() => go(flashcardsPlay(studySetId))}>
                  <LayersIcon />
                  Flashcards
                </CommandItem>
              ) : contentKind === "quiz" ? (
                <CommandItem onSelect={() => go(quizPlay(studySetId))}>
                  <BookOpenIcon />
                  Take quiz
                </CommandItem>
              ) : null}
            </CommandGroup>
          </>
        ) : null}
        {process.env.NODE_ENV === "development" ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Develop">
              <CommandItem onSelect={() => go("/develop")}>
                <FlaskConical />
                Develop lab
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
        <CommandSeparator />
        <CommandGroup heading="Shortcuts">
          <CommandItem disabled>
            Open command palette
            <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
