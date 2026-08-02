"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ACTIVITY_STATS_CHANGED_EVENT } from "@/lib/appEvents";
import { recoveryAvailable, streakTier, type LearningStreak } from "@/lib/streak";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale/LocaleProvider";

const emptyStreak: LearningStreak = { currentStreak: 0, lostStreak: 0, lostAt: null, recoveryStartedAt: null, recoveryQuizCount: 0, recoveriesThisMonth: 0 };
const tierClass = {
  base: "text-orange-500",
  "30": "text-yellow-500",
  "90": "scale-110 text-amber-500",
  "180": "scale-125 text-red-500",
  "365": "scale-150 text-fuchsia-500",
};

export function StreakButton() {
  const { messages } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [streak, setStreak] = useState<LearningStreak>(emptyStreak);
  const load = useCallback(async () => {
    const response = await fetch("/api/streak", { cache: "no-store", headers: { "x-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone } });
    if (!response.ok) return;
    const payload = await response.json() as { data: LearningStreak };
    setStreak(payload.data);
  }, []);

  useEffect(() => {
    setMounted(true);
    void load();
    window.addEventListener(ACTIVITY_STATS_CHANGED_EVENT, load);
    return () => window.removeEventListener(ACTIVITY_STATS_CHANGED_EVENT, load);
  }, [load]);

  const startRecovery = async () => {
    const response = await fetch("/api/streak", { method: "POST", headers: { "x-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone } });
    const payload = await response.json() as { data?: LearningStreak; error?: string };
    if (!response.ok || !payload.data) {
      toast.error(payload.error === "recovery_limit" ? messages.streak.recoveryLimit : messages.streak.unavailable);
      return;
    }
    setStreak(payload.data);
    toast.success(messages.streak.recoveryInstructions);
  };

  const canRecover = recoveryAvailable(streak);
  const tier = streakTier(streak.currentStreak);
  if (!mounted) return <span className="block h-10 w-12" aria-hidden="true" />;
  return <DropdownMenu>
    <DropdownMenuTrigger
      aria-label={messages.streak.aria(streak.currentStreak)}
      className={cn(
        buttonVariants({ variant: "ghost", size: "default" }),
        "h-10 gap-1.5 px-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <Flame className={`size-4 transition-transform ${tierClass[tier]}`} />
      <span className="font-label text-xs font-bold tabular-nums">{streak.currentStreak}</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuGroup>
        <DropdownMenuLabel>{messages.streak.dayStreak(streak.currentStreak)}</DropdownMenuLabel>
      </DropdownMenuGroup>
      <p className="px-1.5 pb-2 text-xs text-muted-foreground">{messages.streak.keepGoing}</p>
      {streak.recoveryStartedAt ? <><DropdownMenuSeparator /><p className="px-1.5 py-1.5 text-sm">{messages.streak.recoveryInProgress(streak.recoveryQuizCount)}</p></> : null}
      {canRecover ? <><DropdownMenuSeparator /><DropdownMenuItem className="cursor-pointer" onClick={() => void startRecovery()}><Flame />{messages.streak.recover(streak.lostStreak)}</DropdownMenuItem></> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}
