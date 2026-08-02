"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/buttons/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale/LocaleProvider";
import { DISPLAY_NAME_MAX_LEN, useDisplayName } from "@/components/profile/DisplayNameProvider";
import { Input } from "@/components/ui/input";

export type DashboardHeroProps = Readonly<{
  totalWorkspaces: number;
  readyCount: number;
  needsAttentionCount: number;
  createHref: string;
}>;

function DisplayNamePromptRow() {
  const { setDisplayName, dismissPrompt, needsDisplayNamePrompt } = useDisplayName();
  const [nameInput, setNameInput] = useState("");
  if (!needsDisplayNamePrompt) return null;
  const save = () => {
    const value = nameInput.trim().slice(0, DISPLAY_NAME_MAX_LEN);
    if (!value) return;
    setDisplayName(value);
    setNameInput("");
  };
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center" role="region" aria-label="Display name">
      <Input value={nameInput} maxLength={DISPLAY_NAME_MAX_LEN} onChange={(event) => setNameInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); save(); } }} placeholder="Display name" aria-label="Display name" className="h-9 max-w-xs" />
      <div className="flex gap-2"><Button type="button" variant="ghost" size="sm" onClick={dismissPrompt}>Skip</Button><Button type="button" size="sm" disabled={!nameInput.trim()} onClick={save}>Save</Button></div>
    </div>
  );
}

export function DashboardHero({
  totalWorkspaces,
  readyCount,
  needsAttentionCount,
  createHref,
}: DashboardHeroProps) {
  const { displayName } = useDisplayName();
  const { messages } = useLocale();
  const copy = messages.dashboard.hero;
  const name = displayName.trim() || copy.learner;

  const statsText = totalWorkspaces === 0
    ? copy.emptyGuidance
    : `${totalWorkspaces} ${totalWorkspaces === 1 ? "workspace" : "workspaces"} · ${readyCount} ready · ${needsAttentionCount} need attention`;

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="max-w-2xl space-y-1">
          <h1 className="text-balance font-heading text-2xl font-bold tracking-[-0.02em] text-foreground">
            {copy.welcome(name)}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">{statsText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href={createHref}
            className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4 font-semibold")}
          >
            <Plus className="size-4" />
            {copy.newWorkspace}
          </Link>
        </div>
      </div>
      <DisplayNamePromptRow />
    </section>
  );
}
