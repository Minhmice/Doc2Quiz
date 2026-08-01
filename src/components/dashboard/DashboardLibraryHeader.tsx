"use client";

import { ChevronDown } from "lucide-react";
import { useLocale } from "@/components/locale/LocaleProvider";
import type { DashboardFilter, DashboardSort } from "@/hooks/useDashboardHome";
import { cn } from "@/lib/utils";

export type DashboardLibraryHeaderProps = Readonly<{
  totalWorkspaces: number;
  filter: DashboardFilter;
  onFilterChange: (filter: DashboardFilter) => void;
  sort: DashboardSort;
  onSortChange: (sort: DashboardSort) => void;
}>;

const FILTER_TABS: Array<{ id: DashboardFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "processing", label: "Processing" },
];

export function DashboardLibraryHeader({
  totalWorkspaces,
  filter,
  onFilterChange,
  sort,
  onSortChange,
}: DashboardLibraryHeaderProps) {
  const { locale, messages } = useLocale();
  const copy = messages.dashboard;

  return (
    <div className="flex flex-col justify-between gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center">
      <div className="flex items-baseline gap-3">
        <h2 className="font-heading text-xl font-bold text-foreground">{copy.workspaces}</h2>
        <span className="text-xs text-muted-foreground font-medium">
          {copy.totalWorkspaces(new Intl.NumberFormat(locale).format(totalWorkspaces))}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Horizontal filter tabs */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1" role="tablist" aria-label={copy.filterAria}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              onClick={() => onFilterChange(tab.id)}
              aria-selected={filter === tab.id}
              className={cn(
                "min-h-8 rounded-md px-3 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === tab.id
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="relative shrink-0">
          <label className="sr-only" htmlFor="dashboard-workspace-sort">
            {copy.sortAria}
          </label>
          <select
            id="dashboard-workspace-sort"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as DashboardSort)}
            className="h-9 appearance-none rounded-lg border border-border/60 bg-card pl-3 pr-8 text-xs font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="recent">{copy.sortRecent}</option>
            <option value="title">{copy.sortTitle}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>
      </div>
    </div>
  );
}
