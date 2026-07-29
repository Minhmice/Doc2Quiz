"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import {
  ACTIVITY_STATS_CHANGED_EVENT,
  STUDY_SETS_LIST_CHANGED_EVENT,
} from "@/lib/appEvents";
import {
  ensureStudySetDb,
  getApprovedBank,
  getApprovedFlashcardBank,
  listStudySetMetas,
} from "@/lib/client/studySetDb";
import {
  getDashboardCache,
  invalidateDashboardCache,
  setDashboardCache,
} from "@/lib/client/appDataCache";
import {
  getActivityStats,
  listUnfinishedStudySessions,
  listUnresolvedMistakeSets,
  hasMistakesForStudySet,
  selectSmartResume,
  type ActivityStats,
} from "@/lib/client/activityTracking";
import type { StudySetMeta } from "@/types/studySet";
import type { DashboardSetCounts } from "@/lib/client/appDataCache";

export type { DashboardSetCounts } from "@/lib/client/appDataCache";
export type DashboardFilter = "all" | "ready" | "needs_edit" | "in_review";
export type DashboardType = "all" | "quiz" | "flashcards";
export type DashboardStatus = "all" | "ready" | "needs_review" | "generating" | "failed";
export type DashboardPractice = "all" | "mistakes";
export type SmartResumeSelection = ReturnType<typeof selectSmartResume>;
export type DashboardSort = "recent" | "title";

export function parseDashboardParams(params: URLSearchParams | Readonly<Record<string, string | undefined>>) {
  const get = (key: string) => params instanceof URLSearchParams ? params.get(key) ?? undefined : params[key];
  const type = get("type");
  return {
    type: type === "quiz" || type === "flashcards" ? type : "all" as DashboardType,
    search: get("search") ?? "",
    status: (get("status") === "ready" || get("status") === "needs_review" || get("status") === "generating" || get("status") === "failed" ? get("status") : "all") as DashboardStatus,
    sort: get("sort") === "title" ? "title" as DashboardSort : "recent" as DashboardSort,
    practice: get("practice") === "mistakes" ? "mistakes" as DashboardPractice : "all" as DashboardPractice,
  };
}

function classifyDashboardSet(
  set: StudySetMeta,
  count: { editorStaging: number; approved: number },
): DashboardFilter {
  if (count.approved <= 0) {
    return "needs_edit";
  }
  if (set.pipelineStage === "quiz" || set.pipelineStage === "flashcards") {
    return "ready";
  }
  return "in_review";
}

function isNeedsEditSet(
  set: StudySetMeta,
  count: { editorStaging: number; approved: number },
): boolean {
  const category = classifyDashboardSet(set, count);
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
  const [urlState, setUrlState] = useState(() => parseDashboardParams(new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)));
  const updateUrl = useCallback((patch: Partial<typeof urlState>) => {
    const next = { ...urlState, ...patch };
    const query = new URLSearchParams();
    query.set("type", next.type);
    if (next.search) query.set("search", next.search);
    if (next.status !== "all") query.set("status", next.status);
    if (next.sort !== "recent") query.set("sort", next.sort);
    if (next.practice !== "all") query.set("practice", next.practice);
    window.history.replaceState(null, "", `/dashboard?${query.toString()}`);
    setUrlState(next);
  }, [urlState]);
  const [sets, setSets] = useState<StudySetMeta[]>([]);
  const [counts, setCounts] = useState<DashboardSetCounts>({});
  const [mistakes, setMistakes] = useState<Record<string, boolean>>({});
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const filter: DashboardFilter = urlState.status === "needs_review" ? "needs_edit" : urlState.status === "all" ? "all" : urlState.status === "ready" ? "ready" : "in_review";
  const setFilter = useCallback((value: DashboardFilter) => updateUrl({ status: value === "needs_edit" ? "needs_review" : value === "in_review" ? "needs_review" : value === "all" ? "all" : value }), [updateUrl]);
  const sort = urlState.sort;
  const setSort = useCallback((value: DashboardSort) => updateUrl({ sort: value }), [updateUrl]);
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
      await ensureStudySetDb();
      const [list, act] = await Promise.all([
        listStudySetMetas(),
        getActivityStats(),
      ]);
      const next: DashboardSetCounts = {};
      const mist: Record<string, boolean> = {};
      await Promise.all(
        list.map(async (s) => {
          if (s.contentKind === "flashcards") {
            const fc = await getApprovedFlashcardBank(s.id);
            next[s.id] = {
              editorStaging: 0,
              approved: fc?.items.length ?? 0,
            };
          } else {
            const bank = await getApprovedBank(s.id);
            next[s.id] = {
              editorStaging: 0,
              approved: bank?.questions.length ?? 0,
            };
          }
          mist[s.id] = await hasMistakesForStudySet(s.id);
        }),
      );
      if (refreshSeqRef.current !== seq) {
        return;
      }
      setSets(list);
      setActivity(act);
      setCounts(next);
      setMistakes(mist);
      setDashboardCache({
        sets: list,
        counts: next,
        mistakes: mist,
        activity: act,
      });
    } catch (e) {
      if (refreshSeqRef.current !== seq) {
        return;
      }
      setLoadError(
        e instanceof Error ? e.message : "Could not load study sets.",
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
      setSets(cached.sets);
      setCounts(cached.counts);
      setMistakes(cached.mistakes);
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
    () =>
      sets.filter((s) => {
        const c = counts[s.id] ?? { editorStaging: 0, approved: 0 };
        return isNeedsEditSet(s, c);
      }).length,
    [sets, counts],
  );

  const setsWithApproved = useMemo(
    () => sets.filter((s) => (counts[s.id]?.approved ?? 0) > 0).length,
    [sets, counts],
  );

  const featuredNeedsEdit = useMemo(() => {
    const candidates = sets.filter((s) => {
      const c = counts[s.id] ?? { editorStaging: 0, approved: 0 };
      return isNeedsEditSet(s, c);
    });
    if (candidates.length === 0) {
      return null;
    }
    const sorted = [...candidates].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const meta = sorted[0]!;
    return { meta };
  }, [sets, counts]);

  const resumeLatest = useMemo(() => {
    const playable = sets.filter((s) => (counts[s.id]?.approved ?? 0) > 0);
    if (playable.length === 0) {
      return null;
    }
    return [...playable].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0]!;
  }, [sets, counts]);

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
      return sets;
    }
    return sets.filter((s) => {
      const t = s.title.toLowerCase();
      const f = (s.sourceFileName ?? "").toLowerCase();
      const sub = (s.subtitle ?? "").toLowerCase();
      return t.includes(q) || f.includes(q) || sub.includes(q);
    });
  }, [sets, search]);

  const chipFiltered = useMemo(() => {
    return searchFiltered.filter((s) => {
      if (urlState.type !== "all" && s.contentKind !== urlState.type) return false;
      if (urlState.practice === "mistakes" && !mistakes[s.id]) return false;
      const c = counts[s.id] ?? { editorStaging: 0, approved: 0 };
      if (filter === "all") {
        return true;
      }
      return classifyDashboardSet(s, c) === filter;
    });
  }, [searchFiltered, filter, counts, mistakes, urlState.type, urlState.practice]);

  const filteredSortedSets = useMemo(() => {
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

  return {
    loading,
    revalidating,
    loadError,
    sets,
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
    filteredSortedSets,
    urlState,
    setType: (type: DashboardType) => updateUrl({ type }),
    setPractice: (practice: DashboardPractice) => updateUrl({ practice }),
    resume: async () => selectSmartResume(resumeLatest ? { studySetId: resumeLatest.id, mode: resumeLatest.contentKind === "flashcards" ? "flashcard" : "quiz" } : null),
  };
}
