"use client";

import { useEffect } from "react";
import { AppTopBar } from "@/components/layout/AppTopBar";
import {
  FOCUS_LIBRARY_SEARCH_EVENT,
  LibrarySearchProvider,
  useLibrarySearch,
} from "@/components/layout/LibrarySearchContext";
import { ParseProgressStrip } from "@/components/layout/ParseProgressStrip";

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
  return (
    <LibrarySearchProvider>
      <FocusSearchListener />
      <div className="flex min-h-screen flex-col bg-background">
        <AppTopBar />
        <ParseProgressStrip />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-5 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </LibrarySearchProvider>
  );
}
