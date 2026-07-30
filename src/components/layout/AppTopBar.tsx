"use client";

import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/buttons/button";
import { ApiStatusButton } from "@/components/layout/ApiStatusButton";
import { FriendsMenu } from "@/components/layout/FriendsMenu";
import { StreakButton } from "@/components/layout/StreakButton";
import { WorkspaceTopBarActions } from "@/components/layout/WorkspaceTopBarActions";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";

export function AppTopBar({ hidden = false, onOpenNavigation }: { hidden?: boolean; onOpenNavigation?: () => void }) {
  const pathname = usePathname() ?? "";
  const { messages } = useLocale();
  const { search, setSearch, desktopSearchRef, focusLibrarySearch } = useLibrarySearch();
  if (hidden) return null;
  const title = pathname === "/dashboard" ? messages.navigation.dashboard : pathname === "/help" ? messages.navigation.help : pathname === "/settings" ? messages.navigation.settings : pathname.startsWith("/create") ? messages.navigation.create : messages.navigation.currentSet;
  const searchable = pathname === "/dashboard";
  const workspaceId = pathname.match(/^\/workspace\/([^/]+)/)?.[1];
  return <header className="sticky top-0 z-40 grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border/60 bg-card/85 px-3 backdrop-blur-xl sm:px-6" role="banner">
    <div className="flex min-w-0 items-center gap-3"><Button type="button" variant="ghost" size="icon" className="size-11 lg:hidden" onClick={onOpenNavigation} aria-label={messages.navigation.openNavigation}><Menu className="size-5" /></Button><h1 className="truncate font-heading text-base font-bold">{title}</h1></div>
    {searchable ? <input ref={desktopSearchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.navigation.searchWorkspacesPlaceholder} aria-label={messages.navigation.searchWorkspaces} className="hidden h-9 w-[min(36vw,28rem)] rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:block" /> : <div />}
    <div className="flex items-center justify-end gap-1"><StreakButton />{workspaceId ? <WorkspaceTopBarActions workspaceId={workspaceId} /> : null}<FriendsMenu /><ApiStatusButton />{searchable && <Button type="button" variant="ghost" size="icon" className="size-10 md:hidden" onClick={focusLibrarySearch} aria-label={messages.navigation.searchWorkspaces}><Search className="size-5" /></Button>}</div>
  </header>;
}
