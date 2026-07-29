"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import {
  ACTIVITY_STATS_CHANGED_EVENT,
  STUDY_SETS_LIST_CHANGED_EVENT,
} from "@/lib/appEvents";
import {
  getDashboardCache,
  invalidateDashboardCache,
  setDashboardCache,
  type DashboardSetCounts,
} from "@/lib/client/appDataCache";
import {
  getActivityStats,
  selectSmartResume,
  type ActivityStats,
} from "@/lib/client/activityTracking";
import { fetchWorkspaceSummaries } from "@/lib/client/workspaceApi";
import type { WorkspaceSummary } from "@/lib/workspaces/workspaceSummary";

export type { DashboardSetCounts } from "@/lib/client/appDataCache";
export type DashboardFilter = "all" | "ready" | "needs_edit" | "in_review";
export type DashboardType = "all" | "quiz" | "flashcards";
export type DashboardStatus =
  | "all"
  | "ready"
  | "needs_review"
  | "generating"
  | "failed";
export type DashboardPractice = "all" | "mistakes";
export type SmartResumeSelection = ReturnType<typeof selectSmartResume>;
export type DashboardSort = "recent" | "title";

export function parseDashboardParams(
  params: URLSearchParams | Readonly<Record<string, string | undefined>>,
) {
  const get = (key: string) =>
    params instanceof URLSearchParams
      ? (params.get(key) ?? undefined)
      : params[key];
  const type = get("type");
  return {
    type:
      type === "quiz" || type === "flashcards"
        ? type
        : ("all" as DashboardType),
    search: get("search") ?? "",
    status: (get("status") === "ready" ||
    get("status") === "needs_review" ||
    get("status") === "generating" ||
    get("status") === "failed"
      ? get("status")
      : "all") as DashboardStatus,
    sort:
      get("sort") === "title"
        ? ("title" as DashboardSort)
        : ("recent" as DashboardSort),
    practice:
      get("practice") === "mistakes"
        ? ("mistakes" as DashboardPractice)
        : ("all" as DashboardPractice),
  };
}

function classifyWorkspace(workspace: WorkspaceSummary): DashboardFilter {
  const outputCount =
    workspace.quizOutputCount + workspace.flashcardOutputCount;
  if (outputCount > 0) {
    return "ready";
  }
  if (workspace.canonicalVersionCount > 0) {
    return "in_review";
  }
  return "needs_edit";
}

function isNeedsEditWorkspace(workspace: WorkspaceSummary): boolean {
  const category = classifyWorkspace(workspace);
  return category === "needs_edit" || category === "in_review";
}

export function dispatchStudySetsChanged(): void {
  invalidateDashboardCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STUDY_SETS_LIST_CHANGED_EVENT));
  }
}

export function useDashboardHome() {
  const { search } = useLibrarySearch();
  const [urlState, setUrlState] = useState(() =>
    parseDashboardParams(
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      ),
    ),
  );
  const updateUrl = useCallback(
    (patch: Partial<typeof urlState>) => {
      const next = { ...urlState, ...patch };
      const query = new URLSearchParams();
      query.set("type", next.type);
      if (next.search) query.set("search", next.search);
      if (next.status !== "all") query.set("status", next.status);
      if (next.sort !== "recent") query.set("sort", next.sort);
      if (next.practice !== "all") query.set("practice", next.practice);
      window.history.replaceState(null, "", `/dashboard?${query.toString()}`);
      setUrlState(next);
    },
    [urlState],
  );
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const filter: DashboardFilter =
    urlState.status === "needs_review"
      ? "needs_edit"
      : urlState.status === "all"
        ? "all"
        : urlState.status === "ready"
          ? "ready"
          : "in_review";
  const setFilter = useCallback(
    (value: DashboardFilter) =>
      updateUrl({
        status:
          value === "needs_edit"
            ? "needs_review"
            : value === "in_review"
              ? "needs_review"
              : value === "all"
                ? "all"
                : value,
      }),
    [updateUrl],
  );
  const sort = urlState.sort;
  const setSort = useCallback(
    (value: DashboardSort) => updateUrl({ sort: value }),
    [updateUrl],
  );
  const refreshSeqRef = useRef(0);

  const refresh = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true;
    setLoadError(null);
    const seq = ++refreshSeqRef.current;
    if (!background) {
      setLoading(true);
    } else {
      setRevalidating(true);
    }
    try {
      const [list, act] = await Promise.all([
        fetchWorkspaceSummaries(),
        getActivityStats(),
      ]);
      if (refreshSeqRef.current !== seq) {
        return;
      }
      setWorkspaces(list);
      setActivity(act);
      setDashboardCache({
        workspaces: list,
        activity: act,
      });
    } catch (e) {
      if (refreshSeqRef.current !== seq) {
        return;
      }
      setLoadError(
        e instanceof Error ? e.message : "Could not load workspaces.",
      );
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
      return;
    }
    void refresh({ background: false });
  }, [refresh]);

  useEffect(() => {
    const onActivity = () => {
      invalidateDashboardCache();
      void refresh({ background: false });
    };
    const onList = () => {
      invalidateDashboardCache();
      void refresh({ background: false });
    };
    window.addEventListener(ACTIVITY_STATS_CHANGED_EVENT, onActivity);
    window.addEventListener(STUDY_SETS_LIST_CHANGED_EVENT, onList);
    return () => {
      window.removeEventListener(ACTIVITY_STATS_CHANGED_EVENT, onActivity);
      window.removeEventListener(STUDY_SETS_LIST_CHANGED_EVENT, onList);
    };
  }, [refresh]);

  const setsNeedingEditsCount = useMemo(
    () => workspaces.filter((workspace) => isNeedsEditWorkspace(workspace)).length,
    [workspaces],
  );

  const setsWithApproved = useMemo(
    () =>
      workspaces.filter(
        (workspace) =>
          workspace.quizOutputCount + workspace.flashcardOutputCount > 0,
      ).length,
    [workspaces],
  );

  const featuredNeedsEdit = useMemo(() => {
    const candidates = workspaces.filter((workspace) =>
      isNeedsEditWorkspace(workspace),
    );
    if (candidates.length === 0) {
      return null;
    }
    const sorted = [...candidates].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return sorted[0] ?? null;
  }, [workspaces]);

  const resumeLatest = useMemo(() => {
    const playable = workspaces.filter(
      (workspace) =>
        workspace.quizOutputCount + workspace.flashcardOutputCount > 0,
    );
    if (playable.length === 0) {
      return null;
    }
    return [...playable].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0]!;
  }, [workspaces]);

  const streakRingPercent = useMemo(() => {
    if (!activity) {
      return 0;
    }
    const activeDays = activity.dailyAnsweredLast7Days.filter(
      (d) => d.count > 0,
    ).length;
    return Math.min(100, Math.round((activeDays / 7) * 100));
  }, [activity]);

  const searchFiltered = useMemo(() => {
    const q = (urlState.search || search).trim().toLowerCase();
    if (!q) {
      return workspaces;
    }
    return workspaces.filter((workspace) => {
      const title = workspace.title.toLowerCase();
      const subtitle = (workspace.subtitle ?? "").toLowerCase();
      return title.includes(q) || subtitle.includes(q);
    });
  }, [workspaces, search, urlState.search]);

  const chipFiltered = useMemo(() => {
    return searchFiltered.filter((workspace) => {
      if (urlState.type === "quiz" && workspace.quizOutputCount <= 0) {
        return false;
      }
      if (
        urlState.type === "flashcards" &&
        workspace.flashcardOutputCount <= 0
      ) {
        return false;
      }
      // Mistakes drill requires per-set reads; aggregate summary omits them.
      if (urlState.practice === "mistakes") {
        return false;
      }
      if (filter === "all") {
        return true;
      }
      return classifyWorkspace(workspace) === filter;
    });
  }, [searchFiltered, filter, urlState.type, urlState.practice]);

  const filteredSortedWorkspaces = useMemo(() => {
    const list = [...chipFiltered];
    if (sort === "title") {
      list.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      );
    } else {
      list.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
    return list;
  }, [chipFiltered, sort]);

  /** Legacy empty counts map — library consumers that still expect the shape. */
  const counts: DashboardSetCounts = {};
  const mistakes: Record<string, boolean> = {};

  return {
    loading,
    revalidating,
    loadError,
    workspaces,
    counts,
    mistakes,
    activity,
    filter,
    setFilter,
    sort,
    setSort,
    refresh,
    setsNeedingEditsCount,
    setsWithApproved,
    featuredNeedsEdit,
    resumeLatest,
    streakRingPercent,
    filteredSortedWorkspaces,
    urlState,
    setType: (type: DashboardType) => updateUrl({ type }),
    setPractice: (practice: DashboardPractice) => updateUrl({ practice }),
    resume: async () => {
      const recent = resumeLatest?.recentOutputs[0];
      if (!recent) return selectSmartResume(null);
      return selectSmartResume({
        studySetId: recent.bridgeStudySetId,
        mode: recent.kind === "flashcards" ? "flashcard" : "quiz",
      });
    },
  };
}
