"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { SearchIcon } from "lucide-react";
import { ApiStatusIndicator } from "@/components/layout/ApiStatusIndicator";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import { useDisplayName } from "@/components/profile/DisplayNameProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/buttons/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { topBarCreateSetLinkClassName } from "@/lib/dashboard/createSetCtaLinks";
import { newRoot } from "@/lib/routes/studySetPaths";
import { cn } from "@/lib/utils";

function avatarInitial(displayName: string): string {
  const t = displayName.trim();
  if (!t) {
    return "?";
  }
  const first = Array.from(t.normalize("NFC"))[0];
  return first ? first.toLocaleUpperCase() : "?";
}

export function AppTopBar() {
  const router = useRouter();
  const {
    search,
    setSearch,
    mobileSearchOpen,
    setMobileSearchOpen,
    desktopSearchRef,
  } = useLibrarySearch();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { displayName } = useDisplayName();
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileSearchOpen) {
      queueMicrotask(() => mobileInputRef.current?.focus());
    }
  }, [mobileSearchOpen]);

  const toggleTheme = () => {
    const next =
      resolvedTheme === "dark" || theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <header
      className="sticky top-0 z-40 shrink-0 border-b border-border/60 bg-card/85 backdrop-blur-xl dark:bg-card/80"
      role="banner"
    >
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-3 sm:gap-6 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-8">
          <Link
            href="/dashboard"
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-sm pr-1 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-foreground shadow-sm"
              aria-hidden
            >
              D2
            </span>
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              Doc2Quiz
            </span>
          </Link>

          <div className="hidden min-w-0 flex-1 justify-center sm:flex md:px-2">
            <div className="relative w-full max-w-md lg:max-w-xl xl:max-w-2xl">
              <SearchIcon
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                ref={desktopSearchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search study sets…"
                className="h-9 w-full pl-9"
                aria-label="Search study sets"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 sm:hidden"
            aria-label="Search study sets"
            onClick={() => setMobileSearchOpen(true)}
          >
            <SearchIcon className="size-4" />
          </Button>

          <Link
            href={newRoot()}
            className={topBarCreateSetLinkClassName}
          >
            <span className="sm:hidden">New set</span>
            <span className="hidden sm:inline">Create New Set</span>
          </Link>

          <div className="hidden lg:block">
            <ApiStatusIndicator />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-10 shrink-0 cursor-pointer rounded-full",
              )}
              aria-label="Account menu"
            >
              <Avatar className="size-10 border-2 border-border">
                <AvatarFallback className="bg-gradient-to-br from-[color:var(--d2q-blue)] to-[color:var(--chart-4)] text-sm font-bold text-white">
                  {avatarInitial(displayName)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <div className="border-b border-border px-2 py-2 lg:hidden">
                <ApiStatusIndicator />
              </div>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => router.push("/settings")}
              >
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={toggleTheme}>
                Toggle theme
                {theme ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    ({theme})
                  </span>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="md:hidden"
                onClick={() => {
                  void import("@/lib/ai/aiReachability").then((m) =>
                    void m.runAiReachabilityCheck(),
                  );
                }}
              >
                Check API connection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Search study sets</DialogTitle>
          </DialogHeader>
          <div className="relative mt-2">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={mobileInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search study sets…"
              className="h-10 pl-9"
              aria-label="Search study sets"
            />
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
