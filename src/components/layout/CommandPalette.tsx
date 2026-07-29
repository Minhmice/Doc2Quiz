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
  Play,
} from "lucide-react";
import { useLocale } from "@/components/locale/LocaleProvider";
import { FOCUS_LIBRARY_SEARCH_EVENT } from "@/lib/appEvents";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/client/studySetDb";
import { flashcardEdit, flashcardPlay, createStudySet, quizEdit, quizPlay } from "@/lib/routes/studySetPaths";
import type { StudyContentKind } from "@/types/studySet";

function studySetIdFromPathname(pathname: string): string | undefined {
  const patterns = [
    /^\/quiz\/([^/]+)/,
    /^\/flashcard\/([^/]+)/,
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
  const { messages } = useLocale();

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
        ? flashcardEdit(studySetId)
        : quizEdit(studySetId);

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
        <CommandInput placeholder={messages.navigation.searchCommands} />
        <CommandList>
        <CommandEmpty>{messages.navigation.noResults}</CommandEmpty>
        <CommandGroup heading={messages.navigation.navigate}>
          <CommandItem
            onSelect={() => {
              go("/dashboard");
              requestAnimationFrame(() =>
                window.dispatchEvent(new Event(FOCUS_LIBRARY_SEARCH_EVENT)),
              );
            }}
          >
            <SearchIcon />
            {messages.navigation.searchStudySets}
          </CommandItem>
          <CommandItem onSelect={() => go(createStudySet())}>
            <PlusIcon />
            {messages.navigation.newStudySet}
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <SettingsIcon />
            {messages.navigation.settings}
          </CommandItem>
        </CommandGroup>
        {studySetId ? (
          <>
            <CommandSeparator />
            <CommandGroup heading={messages.navigation.currentSet}>
              <CommandItem onSelect={() => go(reviewHref)}>
                <BookOpenIcon />
                {messages.navigation.review}
              </CommandItem>
              {contentKind === "flashcards" ||
              contentKind === "quiz" ||
              contentKind === null ? (
                <CommandItem
                  onSelect={() =>
                    go(
                      contentKind === "flashcards"
                        ? flashcardPlay(studySetId)
                        : quizPlay(studySetId),
                    )
                  }
                >
                  <Play />
                  {messages.navigation.practice}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </>
        ) : null}
        <CommandSeparator />
        <CommandGroup heading={messages.navigation.shortcuts}>
          <CommandItem disabled>
            {messages.navigation.openCommandPalette}
            <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
