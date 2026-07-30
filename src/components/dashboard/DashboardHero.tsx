"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/buttons/button";
import { useLocale } from "@/components/locale/LocaleProvider";
import { DISPLAY_NAME_MAX_LEN, useDisplayName } from "@/components/profile/DisplayNameProvider";
import { Input } from "@/components/ui/input";

export type DashboardHeroProps = Readonly<{
  totalWorkspaces: number;
  resumeHref: string | null;
  reviewHref: string | null;
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

export function DashboardHero({ totalWorkspaces, resumeHref, reviewHref, createHref }: DashboardHeroProps) {
  const { displayName } = useDisplayName();
  const { locale, messages } = useLocale();
  const copy = messages.dashboard.hero;
  const name = displayName.trim() || copy.learner;
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="max-w-xl">
          <h1 className="text-balance font-heading text-2xl font-bold tracking-[-0.02em] text-accent-foreground">{copy.welcome(name)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{totalWorkspaces === 0 ? copy.emptyGuidance : copy.workspaceCount(new Intl.NumberFormat(locale).format(totalWorkspaces))}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {resumeHref ? <Link href={resumeHref} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy.continueStudying}</Link> : null}
          {reviewHref ? <Link href={reviewHref} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy.reviewPending}</Link> : null}
          <Link href={createHref} className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy.newWorkspace}</Link>
        </div>
      </div>
      <DisplayNamePromptRow />
    </section>
  );
}
