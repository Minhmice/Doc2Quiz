"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import {
  DISPLAY_NAME_MAX_LEN,
  useDisplayName,
} from "@/components/profile/DisplayNameProvider";
import {
  dashboardHeroAccentPrimaryLinkClassName,
  dashboardHeroBluePrimaryLinkClassName,
  dashboardHeroFirstSetLinkClassName,
  dashboardHeroOutlineCreateLinkClassName,
} from "@/lib/dashboard/createSetCtaLinks";
import { useLocale } from "@/components/locale/LocaleProvider";
import { cn } from "@/lib/utils";

export type DashboardHeroProps = Readonly<{
  totalSets: number;
  setsNeedingEdits: number;
  setsWithApproved: number;
  resumePlayHref: string | null;
  editSetHref: string | null;
  createHref: string;
}>;

function DisplayNamePromptRow() {
  const { setDisplayName, dismissPrompt, needsDisplayNamePrompt } =
    useDisplayName();
  const [nameInput, setNameInput] = useState("");

  if (!needsDisplayNamePrompt) {
    return null;
  }

  const save = () => {
    const trimmed = nameInput.trim().slice(0, DISPLAY_NAME_MAX_LEN);
    if (!trimmed) {
      return;
    }
    setDisplayName(trimmed);
    setNameInput("");
  };

  return (
    <div
      className="mt-5 border-t border-border/40 pt-5 text-center md:text-left"
      role="region"
      aria-label="Display name"
    >
      <p className="text-sm text-muted-foreground">
        What should we call you? (optional — used in greetings and your avatar
        initial.)
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Input
          maxLength={DISPLAY_NAME_MAX_LEN}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Your display name"
          aria-label="Display name"
          className="h-10 max-w-md sm:flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
        <div className="flex shrink-0 justify-center gap-2 sm:justify-start">
          <Button type="button" variant="outline" size="sm" onClick={dismissPrompt}>
            Skip
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={!nameInput.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardHero({
  totalSets,
  setsNeedingEdits,
  setsWithApproved,
  resumePlayHref,
  editSetHref,
  createHref,
}: DashboardHeroProps) {
  const { displayName } = useDisplayName();
  const { locale, messages } = useLocale();
  const copy = messages.dashboard.hero;
  const format = (value: number) => new Intl.NumberFormat(locale).format(value);
  const greetingName = displayName.trim() || copy.learner;
  const isEmptyLibrary = totalSets === 0;
  const headline = copy.welcome(greetingName);

  return (
    <section className="flex flex-col items-center justify-between gap-8 rounded-lg border border-border/40 bg-card p-8 md:flex-row">
      <div className="max-w-xl text-center md:text-left">
        <h1 className="mb-2 text-balance font-heading text-3xl font-extrabold tracking-tight text-accent-foreground sm:text-4xl">
          {headline}
        </h1>
        <div className="mb-1 flex items-center justify-center gap-2 md:justify-start">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full bg-primary",
            )}
            aria-hidden
          />
          <p className="text-sm font-medium text-muted-foreground sm:text-base">
            {copy.summary(format(setsNeedingEdits), format(setsWithApproved))}
          </p>
        </div>
        <DisplayNamePromptRow />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 md:justify-end">
        {isEmptyLibrary ? (
          <Link
            href={createHref}
            className={cn(dashboardHeroFirstSetLinkClassName, "text-center")}
          >
            {copy.createFirst}
          </Link>
        ) : (
          <>
            {resumePlayHref ? (
              <Link
                href={resumePlayHref}
                className={dashboardHeroAccentPrimaryLinkClassName}
              >
                {copy.practice}
              </Link>
            ) : null}
            {editSetHref ? (
              <Link
                href={editSetHref}
                className={dashboardHeroBluePrimaryLinkClassName}
              >
                {copy.reviewLatest}
              </Link>
            ) : null}
            <Link
              href={createHref}
              className={dashboardHeroOutlineCreateLinkClassName}
            >
              {copy.createNew}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
