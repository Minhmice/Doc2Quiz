"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, LayoutDashboard, Library, Plus } from "lucide-react";
import { useLocale } from "@/components/locale/LocaleProvider";
import { cn } from "@/lib/utils";

export function DashboardMobileBottomNav({ className }: Readonly<{ className?: string }>) {
  const pathname = usePathname() ?? "";
  const { messages } = useLocale();
  const n = messages.navigation;
  const items = [{ href: "/dashboard", label: n.dashboard, icon: LayoutDashboard }, { href: "/dashboard?type=all", label: n.allSets, icon: Library }, { href: "/create", label: n.create, icon: Plus }, { href: "/settings", label: n.settings, icon: CircleUserRound }];
  return <nav className={cn("fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-4 border-t border-border/60 bg-card md:hidden", className)} aria-label={n.primaryNavigation}>{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-h-11 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === href.split("?")[0] && "text-[color:var(--d2q-accent)]")}>{<Icon className="size-5" aria-hidden />}{label}</Link>)}</nav>;
}
