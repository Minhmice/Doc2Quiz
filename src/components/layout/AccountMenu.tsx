"use client";

import { CircleHelp, LogOut, Settings, User } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDisplayName } from "@/components/profile/DisplayNameProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createSupabaseBrowserClient } from "@/lib/client/supabase";
import { cn } from "@/lib/utils";

type AccountMenuProps = {
  compact?: boolean;
  initial?: string;
  avatarUrl?: string | null;
  usageLabel?: string;
  onNavigate?: () => void;
};

export function AccountMenu({
  compact = true,
  avatarUrl,
  usageLabel,
  onNavigate,
}: AccountMenuProps) {
  const router = useRouter();
  const { displayName } = useDisplayName();
  const [avatarFailed, setAvatarFailed] = useState(false);
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex min-h-11 items-center rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all",
          compact ? "w-full justify-center" : "w-full gap-3 px-3 hover:bg-muted/60",
        )}
        aria-label="Account menu"
      >
        {/* Avatar Container with Oxblood Brand Background and Lucide User Icon Fallback */}
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground ring-2 ring-background/80 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 motion-reduce:transition-none shadow-2xs">
          {avatarUrl && !avatarFailed ? (
            <img src={avatarUrl} alt={`${name}'s avatar`} className="size-full object-cover" onError={() => setAvatarFailed(true)} />
          ) : (
            <User className="size-4.5 text-white stroke-[2.25]" aria-hidden="true" />
          )}
        </span>

        {!compact && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-foreground">{name}</span>
            {usageLabel && (
              <span className="mt-0.5 block truncate font-label text-[10px] font-bold text-muted-foreground">
                {usageLabel}
              </span>
            )}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/profile")}>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/help")}>
          <CircleHelp />
          Help
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onClick={() => void signOut()}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
