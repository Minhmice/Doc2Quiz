"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/buttons/button";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";

export function AppTopBar({ hidden = false, onToggleSidebar }: { hidden?: boolean; onToggleSidebar?: () => void }) {
  const pathname = usePathname() ?? "";
  const { messages } = useLocale();
  const { search, setSearch, desktopSearchRef } = useLibrarySearch();
  if (hidden) return null;
  const title = pathname === "/dashboard" ? messages.navigation.dashboard : pathname === "/help" ? messages.navigation.help : pathname === "/settings" ? messages.navigation.settings : pathname.startsWith("/create") ? messages.navigation.create : messages.navigation.currentSet;
  const searchable = pathname === "/dashboard";
  return <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-card/85 px-3 backdrop-blur-xl sm:px-6" role="banner"><Button type="button" variant="ghost" size="icon" className="size-11 lg:hidden" onClick={onToggleSidebar} aria-label={messages.navigation.openNavigation}><Menu className="size-5" /></Button><div className="min-w-0 flex-1"><h1 className="truncate font-heading text-base font-bold">{title}</h1></div>{searchable && <input ref={desktopSearchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.navigation.searchStudySetsPlaceholder} aria-label={messages.navigation.searchStudySets} className="hidden h-9 w-full max-w-md rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block" />}</header>;
}
