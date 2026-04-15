"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AppTopBar } from "@/components/layout/AppTopBar";
import {
  FOCUS_LIBRARY_SEARCH_EVENT,
  LibrarySearchProvider,
  useLibrarySearch,
} from "@/components/layout/LibrarySearchContext";
function FocusSearchListener() {
  const { focusLibrarySearch } = useLibrarySearch();

  useEffect(() => {
    const fn = () => {
      focusLibrarySearch();
    };
    window.addEventListener(FOCUS_LIBRARY_SEARCH_EVENT, fn);
    return () => window.removeEventListener(FOCUS_LIBRARY_SEARCH_EVENT, fn);
  }, [focusLibrarySearch]);

  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudyMode =
    !!pathname && /^\/(flashcards|quiz)\/[^/]+(?:\/done)?$/.test(pathname);

  return (
    <LibrarySearchProvider>
      <FocusSearchListener />
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AppTopBar />
          <main
            className={
              isStudyMode
                ? "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background d2q-technical-grid px-3 py-5 sm:px-8 sm:py-8"
                : "relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-background d2q-technical-grid px-3 py-5 sm:px-8 sm:py-8"
            }
          >
            {children}
          </main>
        </div>
      </div>
    </LibrarySearchProvider>
  );
}
