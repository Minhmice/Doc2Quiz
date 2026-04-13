import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardFilter, DashboardSort } from "@/hooks/useDashboardHome";

export type DashboardLibraryHeaderProps = Readonly<{
  totalSets: number;
  filter: DashboardFilter;
  onFilterChange: (f: DashboardFilter) => void;
  sort: DashboardSort;
  onSortChange: (s: DashboardSort) => void;
}>;

const CHIPS: { id: DashboardFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "draft", label: "Draft" },
  { id: "in_review", label: "In review" },
];

export function DashboardLibraryHeader({
  totalSets,
  filter,
  onFilterChange,
  sort,
  onSortChange,
}: DashboardLibraryHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-4 md:flex-row md:items-center">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-heading text-2xl font-black tracking-tight text-accent-foreground">
          Your library
        </h2>
        <span className="font-label text-xs font-bold text-[color:var(--d2q-blue)]">
          {totalSets} {totalSets === 1 ? "set" : "sets"} total
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex rounded-lg bg-muted p-1"
          role="group"
          aria-label="Filter study sets"
        >
          {CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onFilterChange(c.id)}
              className={cn(
                "cursor-pointer rounded-md px-4 py-1.5 font-label text-[10px] font-bold uppercase tracking-widest transition-colors duration-200",
                filter === c.id
                  ? "bg-card font-black text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-accent-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <label className="sr-only" htmlFor="dashboard-library-sort">
            Sort study sets
          </label>
          <select
            id="dashboard-library-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as DashboardSort)}
            className="cursor-pointer appearance-none rounded-lg border border-border/40 bg-card py-2.5 pl-4 pr-10 font-label text-[10px] font-bold uppercase tracking-widest text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="recent">Sort by: Recent</option>
            <option value="title">Sort by: Title</option>
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
