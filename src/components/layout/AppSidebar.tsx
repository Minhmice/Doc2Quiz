"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, CircleHelp, LayoutDashboard, ListChecks, Plus, Settings, Sparkles } from "lucide-react";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useDisplayName } from "@/components/profile/DisplayNameProvider";
import { cn } from "@/lib/utils";

export function AppSidebar({ collapsed, onToggle, hidden = false }: { collapsed: boolean; onToggle: () => void; hidden?: boolean }) {
  const pathname = usePathname() ?? "";
  const { messages } = useLocale();
  const { displayName } = useDisplayName();
  const n = messages.navigation;
  const items = [
    { href: "/dashboard", label: n.dashboard, icon: LayoutDashboard },
    { href: "/create", label: n.create, icon: Plus, primary: true },
    { href: "/dashboard?type=all", label: n.allSets, icon: ListChecks },
    { href: "/dashboard?type=quiz", label: n.quizzes, icon: BookOpen },
    { href: "/dashboard?type=flashcards", label: n.flashcards, icon: Sparkles },
    { href: "/dashboard?practice=resume", label: n.continueStudying, icon: BookOpen },
    { href: "/dashboard?practice=mistakes", label: n.mistakeDrills, icon: ListChecks },
  ];
  const secondary = [{ href: "/settings", label: n.settings, icon: Settings }, { href: "/help", label: n.help, icon: CircleHelp }];
  const active = (href: string) => href === "/dashboard" ? pathname === href : pathname === href.split("?")[0];
  if (hidden) return null;
  return <aside className={cn("hidden shrink-0 border-r border-border/70 bg-card/80 transition-[width] duration-200 motion-reduce:transition-none lg:flex lg:flex-col", collapsed ? "w-20" : "w-64")} aria-label={n.primaryNavigation}>
    <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
      {!collapsed && <Link href="/dashboard" className="font-heading text-xl font-extrabold tracking-tight">{n.brandName}</Link>}
      <button type="button" onClick={onToggle} className="flex size-11 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={collapsed ? n.expandSidebar : n.collapseSidebar}>{collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}</button>
    </div>
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {items.map(({ href, label, icon: Icon, primary }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active(href) && "bg-muted text-foreground", primary && "bg-[color:var(--d2q-accent)] text-primary-foreground hover:opacity-90", collapsed && "justify-center px-0")}>{<Icon className="size-5 shrink-0" aria-hidden />}{!collapsed && <span>{label}</span>}</Link>)}
      <div className="my-4 border-t border-border/60 pt-3">{secondary.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed && "justify-center px-0")}>{<Icon className="size-5 shrink-0" aria-hidden />}{!collapsed && <span>{label}</span>}</Link>)}</div>
    </nav>
    <div className={cn("border-t border-border/60 p-4 text-sm", collapsed && "text-center px-2")}><div className="font-semibold">{collapsed ? (displayName.trim()[0] ?? "?").toUpperCase() : displayName}</div>{!collapsed && <div className="text-xs text-muted-foreground">{n.planUsage}</div>}</div>
  </aside>;
}
