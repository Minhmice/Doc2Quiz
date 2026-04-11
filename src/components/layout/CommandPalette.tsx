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
} from "lucide-react";
import { FOCUS_LIBRARY_SEARCH_EVENT } from "@/lib/appEvents";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const setIdMatch = pathname.match(/^\/sets\/([^/]+)/);
  const studySetId = setIdMatch?.[1];

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
          <CommandItem onSelect={() => go("/sets/new")}>
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
              <CommandItem onSelect={() => go(`/sets/${studySetId}/source`)}>
                <BookOpenIcon />
                Source &amp; parse
              </CommandItem>
              <CommandItem onSelect={() => go(`/sets/${studySetId}/review`)}>
                <BookOpenIcon />
                Review questions
              </CommandItem>
              <CommandItem onSelect={() => go(`/sets/${studySetId}/play`)}>
                <BookOpenIcon />
                Take quiz
              </CommandItem>
              <CommandItem onSelect={() => go(`/sets/${studySetId}/flashcards`)}>
                <LayersIcon />
                Flashcards
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
