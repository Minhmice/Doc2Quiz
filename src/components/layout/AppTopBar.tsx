"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { SearchIcon } from "lucide-react";
import { ApiStatusIndicator } from "@/components/layout/ApiStatusIndicator";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

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
      className="sticky top-0 z-40 shrink-0 border-b border-border bg-card/95 backdrop-blur-md"
      role="banner"
    >
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-5 lg:gap-4">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2.5 rounded-lg pr-1 transition-opacity hover:opacity-90 sm:pr-2"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md"
            aria-hidden
          >
            D2
          </span>
          <span className="font-heading hidden text-lg font-bold tracking-tight text-foreground sm:inline">
            Doc2Quiz
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 justify-center px-2 sm:flex md:px-4">
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

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0 sm:gap-3">
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
            href="/sets/new"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "shrink-0 whitespace-nowrap font-semibold shadow-sm",
            )}
          >
            <span className="sm:hidden">+ New</span>
            <span className="hidden sm:inline">+ Create New Set</span>
          </Link>

          <div className="hidden flex-col items-end gap-0.5 lg:flex">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Study mode
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Study partner
              </p>
            </div>
            <ApiStatusIndicator />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "rounded-full",
              )}
              aria-label="Account menu"
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-gradient-to-br from-primary to-chart-4 text-sm font-bold text-primary-foreground">
                  S
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
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
