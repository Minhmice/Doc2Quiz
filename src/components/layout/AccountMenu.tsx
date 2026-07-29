"use client";

import { CircleHelp, LogOut, Moon, MoreHorizontal, Settings, Sun, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "@teispace/next-themes";
import { useDisplayName } from "@/components/profile/DisplayNameProvider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createSupabaseBrowserClient } from "@/lib/client/supabase";
import { cn } from "@/lib/utils";

type AccountMenuProps = {
  compact?: boolean;
  initial?: string;
  usageLabel?: string;
  onNavigate?: () => void;
};

export function AccountMenu({ compact = true, initial, usageLabel, onNavigate }: AccountMenuProps) {
  const router = useRouter();
  const { displayName } = useDisplayName();
  const { resolvedTheme, setTheme } = useTheme();
  const name = displayName.trim() || "Student";
  const navigate = (href: string) => {
    router.push(href);
    onNavigate?.();
  };
  const signOut = async () => {
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return <DropdownMenu>
    <DropdownMenuTrigger className={cn("group flex min-h-11 items-center rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact ? "size-11 justify-center" : "w-full gap-3 px-3 hover:bg-muted") } aria-label={compact ? "Account menu" : undefined}>
      {compact ? <MoreHorizontal className="size-5 text-muted-foreground" /> : <><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-hover:scale-105 motion-reduce:transition-none">{initial ?? name[0]?.toUpperCase() ?? "?"}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-foreground">{name}</span>{usageLabel && <span className="mt-0.5 block truncate font-label text-[10px] font-bold text-muted-foreground">{usageLabel}</span>}</span></>}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuLabel>{name}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/profile")}><User />Profile</DropdownMenuItem>
      <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}><Settings />Settings</DropdownMenuItem>
      <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/help")}><CircleHelp />Help</DropdownMenuItem>
      <DropdownMenuItem className="cursor-pointer" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun /> : <Moon />}{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={() => void signOut()}><LogOut />Sign out</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
