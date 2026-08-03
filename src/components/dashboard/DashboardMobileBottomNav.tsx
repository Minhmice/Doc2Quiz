"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CircleUserRound, LayoutDashboard, Library, Plus } from "lucide-react";
import { useLocale } from "@/components/locale/LocaleProvider";
import { cn } from "@/lib/utils";

export function DashboardMobileBottomNav({ className }: Readonly<{ className?: string }>) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const { messages } = useLocale();
  const n = messages.dashboard.mobile;
  const items = [{ href: "/dashboard", label: n.dashboard, icon: LayoutDashboard }, { href: "/dashboard?kind=all", label: n.library, icon: Library }, { href: "/create", label: n.create, icon: Plus }, { href: "/settings", label: n.settings, icon: CircleUserRound }];
  const dashboardKind = searchParams.get("kind") ?? searchParams.get("type");
  return <nav className={cn("fixed inset-x-0 bottom-0 z-50 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-border/60 bg-card pb-[env(safe-area-inset-bottom)] md:hidden", className)} aria-label={n.aria}>{items.map(({ href, label, icon: Icon }) => { const isActive = href === "/dashboard" ? pathname === "/dashboard" && dashboardKind !== "all" : href === "/dashboard?kind=all" ? pathname === "/dashboard" && dashboardKind === "all" : pathname === href; return <Link key={href} href={href} aria-current={isActive ? "page" : undefined} className={cn("flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold text-muted-foreground transition-[color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none", isActive && "text-primary")}>{<Icon className="size-5" aria-hidden />}{label}</Link>; })}</nav>;
}
