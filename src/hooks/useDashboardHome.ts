"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import {
  buildWorkspaceCardModel,
  extractRecentDashboardOutputs,
  filterAndSortWorkspaceCards,
  selectResumeRecommendation,
  selectReviewRecommendation,
  type DashboardOutputCardModel,
  type WorkspaceFilter,
  type WorkspaceKindFilter,
  type WorkspaceSort,
} from "@/components/dashboard/workspaceDashboardModel";
import { STUDY_SETS_LIST_CHANGED_EVENT } from "@/lib/appEvents";
import { getDashboardCache, invalidateDashboardCache, setDashboardCache } from "@/lib/client/appDataCache";
import { fetchWorkspaceSummaries } from "@/lib/client/workspaceApi";
import type { WorkspaceSummary } from "@/lib/workspaces/workspaceSummary";

export type DashboardFilter = WorkspaceFilter;
export type DashboardSort = WorkspaceSort;
export type DashboardKind = WorkspaceKindFilter;

export function parseDashboardParams(params: URLSearchParams | Readonly<Record<string, string | undefined>>) {
  const get = (key: string) => (params instanceof URLSearchParams ? (params.get(key) ?? undefined) : params[key]);
  const status = get("status");
  const kind = get("kind") ?? get("type");
  const validStatus: DashboardFilter =
    status === "processing" ||
    status === "ready" ||
    status === "needs_review" ||
    status === "needs_attention" ||
    status === "processing_failed" ||
    status === "empty"
      ? status
      : "all";

  const validKind: DashboardKind = kind === "quiz" || kind === "flashcards" ? kind : "all";

  return {
    search: get("search") ?? "",
    status: validStatus,
    kind: validKind,
    sort: (get("sort") === "title" ? "title" : "recent") as DashboardSort,
    section: get("section") ?? get("practice"),
  };
}

export function dispatchStudySetsChanged(): void {
  invalidateDashboardCache();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STUDY_SETS_LIST_CHANGED_EVENT));
}

export function useDashboardData() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshSeqRef = useRef(0);

  const refresh = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true;
    const seq = ++refreshSeqRef.current;
    setLoadError(null);
    if (background) setRevalidating(true);
    else setLoading(true);
    try {
      const list = await fetchWorkspaceSummaries();
      if (refreshSeqRef.current !== seq) return;
      setWorkspaces(list);
      setDashboardCache({ workspaces: list, activity: null });
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
    if (cached?.workspaces) {
      setWorkspaces(cached.workspaces);
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
    window.addEventListener(STUDY_SETS_LIST_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(STUDY_SETS_LIST_CHANGED_EVENT, onChange);
    };
  }, [refresh, workspaces.length]);

  return { workspaces, loading, revalidating, loadError, refresh };
}

export function useWorkspaceFilters(workspaces: readonly WorkspaceSummary[]) {
  const { search: sharedSearch } = useLibrarySearch();
  const [urlState, setUrlState] = useState(() =>
    parseDashboardParams(new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)),
  );

  const updateUrl = useCallback((patch: Partial<typeof urlState>) => {
    setUrlState((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    const query = new URLSearchParams();
    if (urlState.search) query.set("search", urlState.search);
    if (urlState.status !== "all") query.set("status", urlState.status);
    if (urlState.kind !== "all") query.set("kind", urlState.kind);
    if (urlState.sort !== "recent") query.set("sort", urlState.sort);
    if (urlState.section) query.set("section", urlState.section);
    const suffix = query.toString();
    window.history.replaceState(
      null,
      "",
      suffix ? `/dashboard?${suffix}` : "/dashboard",
    );
  }, [urlState]);

  const cards = useMemo(() => workspaces.map(buildWorkspaceCardModel), [workspaces]);

  const filteredSortedWorkspaces = useMemo(
    () =>
      filterAndSortWorkspaceCards(cards, {
        search: urlState.search || sharedSearch,
        filter: urlState.status,
        sort: urlState.sort,
        kind: urlState.kind,
      }),
    [cards, sharedSearch, urlState],
  );

  const recentOutputs: DashboardOutputCardModel[] = useMemo(
    () => extractRecentDashboardOutputs(workspaces, 3),
    [workspaces],
  );

  const counts = useMemo(() => {
    let ready = 0;
    let needsAttention = 0;
    for (const c of cards) {
      if (c.status === "ready") ready++;
      else if (c.status === "needs_review" || c.status === "processing_failed" || c.status === "processing") {
        needsAttention++;
      }
    }
    return { ready, needsAttention };
  }, [cards]);

  return {
    filter: urlState.status,
    setFilter: (status: DashboardFilter) => updateUrl({ status }),
    kind: urlState.kind,
    setKind: (kind: DashboardKind) => updateUrl({ kind }),
    sort: urlState.sort,
    setSort: (sort: DashboardSort) => updateUrl({ sort }),
    filteredSortedWorkspaces,
    recentOutputs,
    counts,
    urlState,
  };
}

export function useResumeRecommendation(workspaces: readonly WorkspaceSummary[]) {
  return useMemo(
    () => ({
      resume: selectResumeRecommendation(workspaces),
      review: selectReviewRecommendation(workspaces),
    }),
    [workspaces],
  );
}

export function useDashboardHome() {
  const data = useDashboardData();
  const filters = useWorkspaceFilters(data.workspaces);
  return { ...data, ...filters };
}
