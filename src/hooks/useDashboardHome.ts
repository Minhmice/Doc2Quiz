"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import {
  buildWorkspaceCardModel,
  filterAndSortWorkspaceCards,
  selectResumeRecommendation,
  selectReviewRecommendation,
  type WorkspaceFilter,
  type WorkspaceSort,
} from "@/components/dashboard/workspaceDashboardModel";
import { ACTIVITY_STATS_CHANGED_EVENT, STUDY_SETS_LIST_CHANGED_EVENT } from "@/lib/appEvents";
import { getDashboardCache, invalidateDashboardCache, setDashboardCache } from "@/lib/client/appDataCache";
import { getActivityStats, type ActivityStats } from "@/lib/client/activityTracking";
import { fetchWorkspaceSummaries } from "@/lib/client/workspaceApi";
import type { WorkspaceSummary } from "@/lib/workspaces/workspaceSummary";

export type DashboardFilter = WorkspaceFilter;
export type DashboardSort = WorkspaceSort;

export function parseDashboardParams(params: URLSearchParams | Readonly<Record<string, string | undefined>>) {
  const get = (key: string) => params instanceof URLSearchParams ? (params.get(key) ?? undefined) : params[key];
  const status = get("status");
  return {
    search: get("search") ?? "",
    status: (status === "processing" || status === "ready" || status === "needs_review" || status === "empty" ? status : "all") as DashboardFilter,
    sort: (get("sort") === "title" ? "title" : "recent") as DashboardSort,
  };
}

export function dispatchStudySetsChanged(): void {
  invalidateDashboardCache();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STUDY_SETS_LIST_CHANGED_EVENT));
}

export function useDashboardData() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshSeqRef = useRef(0);

  const refresh = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true;
    const seq = ++refreshSeqRef.current;
    setLoadError(null);
    background ? setRevalidating(true) : setLoading(true);
    try {
      const [list, nextActivity] = await Promise.all([fetchWorkspaceSummaries(), getActivityStats()]);
      if (refreshSeqRef.current !== seq) return;
      setWorkspaces(list);
      setActivity(nextActivity);
      setDashboardCache({ workspaces: list, activity: nextActivity });
    } catch (error) {
      if (refreshSeqRef.current !== seq) return;
      setLoadError(error instanceof Error ? error.message : "Could not load workspaces.");
    } finally {
      if (refreshSeqRef.current === seq) {
        setLoading(false);
        setRevalidating(false);
      }
    }
  }, []);

  useEffect(() => {
    const cached = getDashboardCache();
    if (cached) {
      setWorkspaces(cached.workspaces);
      setActivity(cached.activity);
      setLoading(false);
      void refresh({ background: true });
    } else {
      void refresh();
    }
  }, [refresh]);

  useEffect(() => {
    const onChange = () => {
      invalidateDashboardCache();
      void refresh({ background: workspaces.length > 0 });
    };
    window.addEventListener(ACTIVITY_STATS_CHANGED_EVENT, onChange);
    window.addEventListener(STUDY_SETS_LIST_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(ACTIVITY_STATS_CHANGED_EVENT, onChange);
      window.removeEventListener(STUDY_SETS_LIST_CHANGED_EVENT, onChange);
    };
  }, [refresh, workspaces.length]);

  return { workspaces, activity, loading, revalidating, loadError, refresh };
}

export function useWorkspaceFilters(workspaces: readonly WorkspaceSummary[]) {
  const { search: sharedSearch } = useLibrarySearch();
  const [urlState, setUrlState] = useState(() => parseDashboardParams(new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)));
  const updateUrl = useCallback((patch: Partial<typeof urlState>) => {
    setUrlState((current) => {
      const next = { ...current, ...patch };
      const query = new URLSearchParams();
      if (next.search) query.set("search", next.search);
      if (next.status !== "all") query.set("status", next.status);
      if (next.sort !== "recent") query.set("sort", next.sort);
      const suffix = query.toString();
      window.history.replaceState(null, "", suffix ? `/dashboard?${suffix}` : "/dashboard");
      return next;
    });
  }, []);
  const cards = useMemo(() => workspaces.map(buildWorkspaceCardModel), [workspaces]);
  const filteredSortedWorkspaces = useMemo(
    () => filterAndSortWorkspaceCards(cards, { search: urlState.search || sharedSearch, filter: urlState.status, sort: urlState.sort }),
    [cards, sharedSearch, urlState],
  );
  return {
    filter: urlState.status,
    setFilter: (status: DashboardFilter) => updateUrl({ status }),
    sort: urlState.sort,
    setSort: (sort: DashboardSort) => updateUrl({ sort }),
    filteredSortedWorkspaces,
    urlState,
  };
}

export function useResumeRecommendation(workspaces: readonly WorkspaceSummary[]) {
  return useMemo(() => ({
    resume: selectResumeRecommendation(workspaces),
    review: selectReviewRecommendation(workspaces),
  }), [workspaces]);
}

export function useDashboardHome() {
  const data = useDashboardData();
  const filters = useWorkspaceFilters(data.workspaces);
  const recommendations = useResumeRecommendation(data.workspaces);
  return { ...data, ...filters, ...recommendations };
}
