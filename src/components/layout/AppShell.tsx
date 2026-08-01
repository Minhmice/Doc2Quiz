"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { DashboardMobileBottomNav } from "@/components/dashboard/DashboardMobileBottomNav";
import { FOCUS_LIBRARY_SEARCH_EVENT, LibrarySearchProvider, useLibrarySearch } from "@/components/layout/LibrarySearchContext";

function FocusSearchListener() {
  const { focusLibrarySearch } = useLibrarySearch();
  useEffect(() => {
    const fn = () => focusLibrarySearch();
    window.addEventListener(FOCUS_LIBRARY_SEARCH_EVENT, fn);
    return () => window.removeEventListener(FOCUS_LIBRARY_SEARCH_EVENT, fn);
  }, [focusLibrarySearch]);
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("doc2quiz_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("doc2quiz_sidebar_collapsed", String(next));
      }
      return next;
    });
  }, []);

  // Power user keyboard shortcut (Ctrl+[ or Cmd+[ / Ctrl+b or Cmd+b)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "[" || e.key === "b" || e.key === "B") &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapsed]);

  const focusMode = /^\/(quiz|flashcard)\/[^/]+\/(play|drill-mistake)$/.test(pathname);
  const topLevel = ["/dashboard", "/create", "/settings", "/help", "/profile"].includes(pathname);

  return (
    <LibrarySearchProvider>
      <FocusSearchListener />
      <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
        <AppSidebar
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          hidden={focusMode}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppTopBar hidden={focusMode} />
          <main
            className={
              focusMode
                ? "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background d2q-technical-grid px-3 py-4 sm:px-6 sm:py-5"
                : "relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-background d2q-technical-grid px-3 py-4 pb-24 sm:px-6 sm:py-5"
            }
          >
            {children}
          </main>
          {topLevel && !focusMode && <DashboardMobileBottomNav />}
        </div>
      </div>
    </LibrarySearchProvider>
  );
}
