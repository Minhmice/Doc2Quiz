"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, ListChecks, Plus, Sparkles } from "lucide-react";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useDisplayName } from "@/components/profile/DisplayNameProvider";
import { fetchUserUsage, type UserUsage } from "@/lib/client/fetchUserUsage";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  hidden?: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  initialUsage?: UserUsage;
};

export function AppSidebar({ collapsed, onToggle, hidden = false, mobileOpen, onMobileOpenChange, initialUsage }: AppSidebarProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const { messages } = useLocale();
  const { displayName } = useDisplayName();
  const n = messages.navigation;
  const [usage, setUsage] = useState<UserUsage | undefined>(initialUsage);
  const usageLabel = usage?.plan === "pro"
    ? messages.plan.proUsage
    : usage
      ? messages.plan.freeUsage(usage.weeklyUsed, usage.weeklyLimit + usage.bonusCredits)
      : n.planUsage;

  useEffect(() => {
    const refreshUsage = () => void fetchUserUsage().then(setUsage).catch(() => undefined);
    if (!initialUsage) refreshUsage();
    window.addEventListener("doc2quiz:usage-updated", refreshUsage);
    return () => window.removeEventListener("doc2quiz:usage-updated", refreshUsage);
  }, [initialUsage]);

  const items = [
    { href: "/create", label: n.create, icon: Plus, primary: true, iconMotion: "group-hover:rotate-90" },
    { href: "/dashboard?type=all", label: n.allSets, icon: ListChecks, iconMotion: "group-hover:translate-x-0.5" },
    { href: "/dashboard?type=quiz", label: n.quizzes, icon: BookOpen, iconMotion: "group-hover:rotate-6 group-hover:translate-x-0.5" },
    { href: "/dashboard?type=flashcards", label: n.flashcards, icon: Sparkles, iconMotion: "group-hover:rotate-12 group-hover:scale-110" },
    { href: "/dashboard?practice=resume", label: n.continueStudying, icon: BookOpen, iconMotion: "group-hover:translate-x-0.5" },
    { href: "/dashboard?practice=mistakes", label: n.mistakeDrills, icon: ListChecks, iconMotion: "group-hover:translate-x-0.5 group-hover:translate-y-0.5" },
  ];
  const active = (href: string) => {
    const [route, query] = href.split("?");
    if (pathname !== route) return false;
    if (!query) return [...searchParams.keys()].length === 0;
    return new URLSearchParams(query).entries().every(([key, value]) => searchParams.get(key) === value);
  };
  const navigation = (compact = false, closeMobile = false) => <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={n.primaryNavigation}>
    {items.map(({ href, label, icon: Icon, primary, iconMotion }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} aria-label={compact ? label : undefined} onClick={closeMobile ? () => onMobileOpenChange(false) : undefined} className={cn("group flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-[background-color,color,transform] duration-200 ease-out hover:bg-muted hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none", active(href) && "bg-muted text-foreground", primary && "bg-primary text-primary-foreground hover:bg-primary/90 hover:translate-x-0", compact && "justify-center px-0 hover:translate-x-0")}>{<Icon className={cn("size-5 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none", iconMotion)} aria-hidden />}{!compact && <span>{label}</span>}</Link>)}
  </nav>;
  const footerNavigation = (compact = false, closeMobile = false) => <div className={cn("border-t border-border/60 p-3", compact && "px-2")}>
    <AccountMenu compact={compact} initial={(displayName.trim()[0] ?? "?").toUpperCase()} usageLabel={usageLabel} onNavigate={closeMobile ? () => onMobileOpenChange(false) : undefined} />
  </div>;

  if (hidden) return null;
  return <>
    <aside className={cn("hidden shrink-0 border-r border-border/70 bg-card/80 transition-[width] duration-200 motion-reduce:transition-none lg:flex lg:flex-col", collapsed ? "w-20" : "w-64")}>
      <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
        {!collapsed && <Link href="/dashboard" className="font-heading text-xl font-extrabold tracking-tight">{n.brandName}</Link>}
        <button type="button" onClick={onToggle} className="flex size-11 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={collapsed ? n.expandSidebar : n.collapseSidebar}>{collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}</button>
      </div>
      {navigation(collapsed)}
      {footerNavigation(collapsed)}
    </aside>
    <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
      <SheetContent side="left" className="w-[min(20rem,85vw)] p-0 lg:hidden">
        <SheetHeader className="border-b border-border/60 pr-14">
          <SheetTitle>{n.brandName}</SheetTitle>
          <SheetDescription className="sr-only">{n.primaryNavigation}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">{navigation(false, true)}{footerNavigation(false, true)}</div>
      </SheetContent>
    </Sheet>
  </>;
}
