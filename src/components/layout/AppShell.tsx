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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("doc2quiz_sidebar_collapsed") === "true");
  }, []);

  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [pathname]);

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
  const showMobileBottomNav = ["/dashboard", "/create", "/settings"].includes(pathname);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavigationOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavigationOpen]);

  return (
    <LibrarySearchProvider>
      <FocusSearchListener />
      <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
        <AppSidebar
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          hidden={focusMode}
          mobileOpen={mobileNavigationOpen}
          onMobileOpenChange={setMobileNavigationOpen}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppTopBar hidden={focusMode} onOpenNavigation={() => setMobileNavigationOpen(true)} />
          <main
            className={
              focusMode
                ? "relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-background d2q-technical-grid px-3 py-3 sm:px-6 sm:py-5"
                : showMobileBottomNav
                ? "relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-background d2q-technical-grid px-3 py-4 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-5 md:pb-5"
                : "relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-background d2q-technical-grid px-3 py-4 pb-4 sm:px-6 sm:py-5 md:pb-5"
            }
          >
            {children}
          </main>
          {showMobileBottomNav && !focusMode && <DashboardMobileBottomNav />}
        </div>
      </div>
    </LibrarySearchProvider>
  );
}
