"use client";

import { ChevronDown } from "lucide-react";
import { useLocale } from "@/components/locale/LocaleProvider";
import { cn } from "@/lib/utils";
import type { DashboardFilter, DashboardSort } from "@/hooks/useDashboardHome";

export type DashboardLibraryHeaderProps = Readonly<{
  totalSets: number;
  filter: DashboardFilter;
  onFilterChange: (f: DashboardFilter) => void;
  sort: DashboardSort;
  onSortChange: (s: DashboardSort) => void;
}>;

const CHIP_IDS: DashboardFilter[] = ["all", "ready", "needs_edit", "in_review"];

export function DashboardLibraryHeader({
  totalSets,
  filter,
  onFilterChange,
  sort,
  onSortChange,
}: DashboardLibraryHeaderProps) {
  const { locale, messages } = useLocale();
  const copy = messages.dashboard;
  const number = new Intl.NumberFormat(locale).format(totalSets);

  return (
    <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-4 md:flex-row md:items-center">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-heading text-2xl font-black tracking-tight text-accent-foreground">
          {copy.library}
        </h2>
        <span className="font-label text-xs font-bold text-[color:var(--d2q-blue)]">
          {copy.totalSets(number)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex rounded-lg bg-muted p-1"
          role="group"
          aria-label={copy.filterAria}
        >
          {CHIP_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onFilterChange(id)}
              className={cn(
                "cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold transition-colors duration-200",
                filter === id
                  ? "bg-card font-black text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-accent-foreground",
              )}
            >
              {copy.filters[id]}
            </button>
          ))}
        </div>
        <div className="relative">
          <label className="sr-only" htmlFor="dashboard-library-sort">
            {copy.sortAria}
          </label>
          <select
            id="dashboard-library-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as DashboardSort)}
            className="cursor-pointer appearance-none rounded-lg border border-border/40 bg-card py-2.5 pl-4 pr-10 text-xs font-semibold text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="recent">{copy.sortRecent}</option>
            <option value="title">{copy.sortTitle}</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
