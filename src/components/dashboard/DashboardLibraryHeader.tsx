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

const FILTERS: DashboardFilter[] = ["all", "processing", "ready", "needs_review", "empty"];

export function DashboardLibraryHeader({ totalWorkspaces, filter, onFilterChange, sort, onSortChange }: DashboardLibraryHeaderProps) {
  const { locale, messages } = useLocale();
  const copy = messages.dashboard;
  return (
    <div className="flex flex-col justify-between gap-3 border-b border-border/60 pb-3 lg:flex-row lg:items-center">
      <div className="flex items-baseline gap-3">
        <h2 className="font-heading text-xl font-bold text-accent-foreground">{copy.workspaces}</h2>
        <span className="text-xs text-muted-foreground">{copy.totalWorkspaces(new Intl.NumberFormat(locale).format(totalWorkspaces))}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label={copy.filterAria}>
          {FILTERS.map((id) => <button key={id} type="button" onClick={() => onFilterChange(id)} aria-pressed={filter === id} className={cn("min-h-11 rounded-lg px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filter === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{copy.filters[id]}</button>)}
        </div>
        <div className="relative">
          <label className="sr-only" htmlFor="dashboard-workspace-sort">{copy.sortAria}</label>
          <select id="dashboard-workspace-sort" value={sort} onChange={(event) => onSortChange(event.target.value as DashboardSort)} className="min-h-11 appearance-none rounded-lg border border-border bg-card py-2 pl-3 pr-9 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-ring">
            <option value="recent">{copy.sortRecent}</option><option value="title">{copy.sortTitle}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>
      </div>
    </div>
  );
}
