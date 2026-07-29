"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { DashboardMobileBottomNav } from "@/components/dashboard/DashboardMobileBottomNav";
import { FOCUS_LIBRARY_SEARCH_EVENT, LibrarySearchProvider, useLibrarySearch } from "@/components/layout/LibrarySearchContext";

function FocusSearchListener() {
  const { focusLibrarySearch } = useLibrarySearch();
  useEffect(() => { const fn = () => focusLibrarySearch(); window.addEventListener(FOCUS_LIBRARY_SEARCH_EVENT, fn); return () => window.removeEventListener(FOCUS_LIBRARY_SEARCH_EVENT, fn); }, [focusLibrarySearch]);
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const focusMode = /^\/(quiz|flashcard)\/[^/]+\/(play|drill-mistake)$/.test(pathname);
  const topLevel = ["/dashboard", "/create", "/settings", "/help"].includes(pathname);
  return <LibrarySearchProvider><FocusSearchListener /><div className="flex h-dvh min-h-0 overflow-hidden bg-background"><AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} hidden={focusMode} /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><AppTopBar hidden={focusMode} onToggleSidebar={() => setCollapsed((value) => !value)} /><main className={focusMode ? "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background d2q-technical-grid px-3 py-5 sm:px-8 sm:py-8" : "relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-background d2q-technical-grid px-3 py-5 pb-24 sm:px-8 sm:py-8"}>{children}</main>{topLevel && !focusMode && <DashboardMobileBottomNav />}</div></div></LibrarySearchProvider>;
}
