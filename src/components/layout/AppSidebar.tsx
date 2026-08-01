"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";

import { AccountMenu } from "@/components/layout/AccountMenu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/components/locale/LocaleProvider";
import { useDisplayName } from "@/components/profile/DisplayNameProvider";
import { fetchUserUsage, type UserUsage } from "@/lib/client/fetchUserUsage";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  hidden?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  initialUsage?: UserUsage;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
  iconMotion?: string;
  category?: string;
};

export function AppSidebar({
  collapsed,
  onToggle,
  hidden = false,
  mobileOpen = false,
  onMobileOpenChange = () => undefined,
  initialUsage,
}: AppSidebarProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const { messages } = useLocale();
  const { displayName, avatarUrl } = useDisplayName();
  const n = messages.navigation;
  const [usage, setUsage] = useState<UserUsage | undefined>(initialUsage);

  const isVi = n.brandName.toLowerCase().includes("đốc") || n.brandName.toLowerCase().includes("tày");
  const logoBadgeText = isVi ? "đq" : "DQ";

  const remainingGenerations = usage
    ? usage.weeklyRemaining + usage.bonusCredits
    : 0;

  const usageLabel = usage?.plan === "pro"
    ? messages.plan.proUsage
    : usage
      ? messages.plan.remainingUsage(remainingGenerations)
      : n.planUsage;

  useEffect(() => {
    const refreshUsage = () => void fetchUserUsage().then(setUsage).catch(() => undefined);
    if (!initialUsage) refreshUsage();
    window.addEventListener("doc2quiz:usage-updated", refreshUsage);
    return () => window.removeEventListener("doc2quiz:usage-updated", refreshUsage);
  }, [initialUsage]);

  const navSections: Array<{ category?: string; items: NavItem[] }> = [
    {
      items: [
        {
          href: "/create",
          label: "New workspace",
          icon: Plus,
          primary: true,
          iconMotion: "group-hover:rotate-90 transition-transform duration-300 ease-out",
        },
        {
          href: "/dashboard",
          label: "Workspaces",
          icon: LayoutGrid,
          iconMotion: "group-hover:scale-110 group-hover:translate-x-0.5 transition-transform duration-200",
        },
      ],
    },
    {
      category: "STUDY",
      items: [
        {
          href: "/dashboard?kind=quiz",
          label: n.quizzes,
          icon: BookOpen,
          iconMotion: "group-hover:-rotate-12 group-hover:scale-110 transition-transform duration-200",
        },
        {
          href: "/dashboard?kind=flashcards",
          label: n.flashcards,
          icon: Sparkles,
          iconMotion: "group-hover:rotate-180 group-hover:scale-115 transition-transform duration-300",
        },
        {
          href: "/dashboard?section=continue",
          label: n.continueStudying,
          icon: Play,
          iconMotion: "group-hover:translate-x-1 transition-transform duration-200",
        },
      ],
    },
    {
      category: "REVIEW",
      items: [
        {
          href: "/dashboard?status=needs_attention",
          label: "Needs attention",
          icon: AlertCircle,
          iconMotion: "group-hover:rotate-12 group-hover:scale-110 transition-transform duration-200",
        },
      ],
    },
  ];

  const active = (href: string) => {
    const [route, query] = href.split("?");
    if (pathname !== route) return false;
    if (!query) {
      const filterKeys = ["kind", "type", "status", "section", "practice"];
      return !filterKeys.some((k) => searchParams.has(k));
    }
    const itemParams = new URLSearchParams(query);
    for (const [key, value] of itemParams.entries()) {
      const current = searchParams.get(key);
      if (key === "kind" && searchParams.get("type") === value) continue;
      if (key === "section" && searchParams.get("practice") === value) continue;
      if (current !== value) return false;
    }
    return true;
  };

  const renderNavItem = (
    item: NavItem,
    compact: boolean,
    closeMobile = false,
  ) => {
    const isActive = active(item.href);
    const Icon = item.icon;

    const linkContent = (
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        aria-label={compact ? item.label : undefined}
        onClick={closeMobile ? () => onMobileOpenChange(false) : undefined}
        className={cn(
          "group relative flex min-h-11 items-center gap-3 rounded-lg text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
          compact
            ? "size-11 justify-center px-0 mx-auto"
            : "px-3 w-full hover:translate-x-0.5",
          item.primary
            ? "bg-oxblood-primary text-white shadow-2xs hover:bg-oxblood-primary/90 hover:shadow-xs active:scale-[0.98]"
            : isActive
            ? "bg-muted/80 text-foreground font-bold shadow-2xs"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        {/* Active Indicator Bar */}
        {isActive && !item.primary ? (
          <span
            className={cn(
              "absolute bg-oxblood-primary rounded-full transition-all",
              compact
                ? "left-0 top-2.5 bottom-2.5 w-1 rounded-r-full"
                : "left-0 top-2 bottom-2 w-1 rounded-r-full",
            )}
            aria-hidden="true"
          />
        ) : null}

        <Icon
          className={cn(
            "size-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            item.iconMotion,
            isActive && !item.primary && "text-oxblood-primary",
          )}
        />
        {!compact && <span className="truncate">{item.label}</span>}
      </Link>
    );

    if (compact) {
      return (
        <TooltipProvider key={item.href} delay={100}>
          <Tooltip>
            <TooltipTrigger render={linkContent} />
            <TooltipContent side="right" className="font-semibold text-xs">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <div key={item.href}>{linkContent}</div>;
  };

  const navigation = (compact = false, closeMobile = false) => (
    <nav className="flex-1 space-y-3 overflow-y-auto p-3" aria-label={n.primaryNavigation}>
      {navSections.map((section, idx) => (
        <div key={idx} className="space-y-1">
          {section.category ? (
            compact ? (
              <div className="my-2 border-t border-border/40 mx-2" aria-hidden="true" />
            ) : (
              <p className="px-3 font-label text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80 py-1">
                {section.category}
              </p>
            )
          ) : null}
          <div className="space-y-1">
            {section.items.map((item) => renderNavItem(item, compact, closeMobile))}
          </div>
        </div>
      ))}
    </nav>
  );

  const footerNavigation = (compact = false, closeMobile = false) => (
    <div className={cn("border-t border-border/60 p-3 space-y-2 flex items-center justify-center w-full", compact && "px-0 py-3")}>
      <AccountMenu
        compact={compact}
        initial={(displayName.trim()[0] ?? "?").toUpperCase()}
        avatarUrl={avatarUrl}
        usageLabel={usageLabel}
        onNavigate={closeMobile ? () => onMobileOpenChange(false) : undefined}
      />
    </div>
  );

  if (hidden) return null;

  const toggleButton = (
    <button
      type="button"
      onClick={onToggle}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors active:scale-95 shadow-2xs"
      aria-label={collapsed ? n.expandSidebar : n.collapseSidebar}
    >
      <ChevronLeft className="size-4.5" />
    </button>
  );

  const collapsedHeaderTrigger = (
    <button
      type="button"
      onClick={onToggle}
      className="size-10 rounded-xl bg-oxblood-primary text-white font-black text-xs tracking-tighter flex items-center justify-center shadow-2xs hover:scale-105 active:scale-95 transition-all mx-auto"
      aria-label={n.expandSidebar}
    >
      <span>{logoBadgeText}</span>
    </button>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border/70 bg-card/80 backdrop-blur-md transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none lg:flex lg:flex-col",
          collapsed ? "w-20" : "w-64",
        )}
      >
        {/* Brand Header */}
        {collapsed ? (
          <div className="flex h-16 items-center justify-center border-b border-border/60 px-2">
            <TooltipProvider delay={100}>
              <Tooltip>
                <TooltipTrigger render={collapsedHeaderTrigger} />
                <TooltipContent side="right" className="font-semibold text-xs">
                  Expand sidebar (Ctrl+[)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          <div className="flex h-16 items-center justify-between border-b border-border/60 px-4 gap-2">
            <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 group">
              <div className="size-8 rounded-lg bg-oxblood-primary text-white font-black text-xs tracking-tighter flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <span>{logoBadgeText}</span>
              </div>
              <span className="font-heading text-lg font-extrabold tracking-tight text-foreground truncate">
                {n.brandName}
              </span>
            </Link>

            <TooltipProvider delay={100}>
              <Tooltip>
                <TooltipTrigger render={toggleButton} />
                <TooltipContent side="right" className="font-semibold text-xs">
                  Collapse sidebar (Ctrl+[)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {navigation(collapsed)}
        {footerNavigation(collapsed)}
      </aside>

      {/* Mobile Drawer Sheet */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[min(20rem,85vw)] p-0 lg:hidden">
          <SheetHeader className="border-b border-border/60 px-4 py-4 pr-14 flex flex-row items-center gap-2.5">
            <div className="size-8 rounded-lg bg-oxblood-primary text-white font-black text-xs tracking-tighter flex items-center justify-center">
              <span>{logoBadgeText}</span>
            </div>
            <SheetTitle className="font-heading font-extrabold text-lg">{n.brandName}</SheetTitle>
            <SheetDescription className="sr-only">{n.primaryNavigation}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            {navigation(false, true)}
            {footerNavigation(false, true)}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
