"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/components/locale/LocaleProvider";
import type { DashboardFilter, DashboardSort } from "@/hooks/useDashboardHome";

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
    <div className="flex flex-col gap-3 border-b border-border/60 pb-3 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex items-baseline gap-3">
        <h2 className="font-heading text-xl font-bold text-foreground">{copy.workspaces}</h2>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {copy.totalWorkspaces(new Intl.NumberFormat(locale).format(totalWorkspaces))}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 overflow-x-auto pb-1 sm:pb-0">
          <Tabs value={filter} onValueChange={(value) => onFilterChange(value as DashboardFilter)}>
            <TabsList aria-label={copy.filterAria} className="w-max border border-border/60 bg-muted/40">
              {FILTER_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="min-h-11 min-w-11 px-3 text-xs font-semibold">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <Select value={sort} onValueChange={(value) => onSortChange(value as DashboardSort)}>
          <SelectTrigger aria-label={copy.sortAria} className="min-h-11 w-full border-border/60 bg-card text-xs font-semibold sm:min-h-9 sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="recent">{copy.sortRecent}</SelectItem>
              <SelectItem value="title">{copy.sortTitle}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
