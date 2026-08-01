"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/buttons/button";
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
    <section className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-2xs">
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
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-oxblood-primary px-4 text-sm font-semibold text-white shadow-2xs hover:bg-oxblood-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" />
            New workspace
          </Link>
        </div>
      </div>
      <DisplayNamePromptRow />
    </section>
  );
}
