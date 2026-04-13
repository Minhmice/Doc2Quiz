"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import {
  ACTIVITY_STATS_CHANGED_EVENT,
  STUDY_SETS_LIST_CHANGED_EVENT,
} from "@/lib/appEvents";
import {
  ensureStudySetDb,
  getApprovedBank,
  getDraftQuestions,
  listStudySetMetas,
} from "@/lib/db/studySetDb";
import {
  getActivityStats,
  hasMistakesForStudySet,
  type ActivityStats,
} from "@/lib/studySet/activityTracking";
import type { StudySetMeta } from "@/types/studySet";

export type DashboardFilter = "all" | "ready" | "draft" | "in_review";
export type DashboardSort = "recent" | "title";

export type DashboardSetCounts = Record<
  string,
  { draft: number; approved: number }
>;

export function dispatchStudySetsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STUDY_SETS_LIST_CHANGED_EVENT));
  }
}

export function useDashboardHome() {
  const { search } = useLibrarySearch();
  const [sets, setSets] = useState<StudySetMeta[]>([]);
  const [counts, setCounts] = useState<DashboardSetCounts>({});
  const [mistakes, setMistakes] = useState<Record<string, boolean>>({});
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [sort, setSort] = useState<DashboardSort>("recent");

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      await ensureStudySetDb();
      const [list, act] = await Promise.all([
        listStudySetMetas(),
        getActivityStats(),
      ]);
      setSets(list);
      setActivity(act);
      const next: DashboardSetCounts = {};
      const mist: Record<string, boolean> = {};
      await Promise.all(
        list.map(async (s) => {
          const [draft, bank] = await Promise.all([
            getDraftQuestions(s.id),
            getApprovedBank(s.id),
          ]);
          next[s.id] = {
            draft: draft.length,
            approved: bank?.questions.length ?? 0,
          };
          mist[s.id] = await hasMistakesForStudySet(s.id);
        }),
      );
      setCounts(next);
      setMistakes(mist);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load study sets.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onActivity = () => void refresh();
    const onList = () => void refresh();
    window.addEventListener(ACTIVITY_STATS_CHANGED_EVENT, onActivity);
    window.addEventListener(STUDY_SETS_LIST_CHANGED_EVENT, onList);
    return () => {
      window.removeEventListener(ACTIVITY_STATS_CHANGED_EVENT, onActivity);
      window.removeEventListener(STUDY_SETS_LIST_CHANGED_EVENT, onList);
    };
  }, [refresh]);

  const setsWithDrafts = useMemo(
    () => sets.filter((s) => (counts[s.id]?.draft ?? 0) > 0).length,
    [sets, counts],
  );

  const setsWithApproved = useMemo(
    () => sets.filter((s) => (counts[s.id]?.approved ?? 0) > 0).length,
    [sets, counts],
  );

  const featuredDraft = useMemo(() => {
    const candidates = sets.filter((s) => (counts[s.id]?.draft ?? 0) > 0);
    if (candidates.length === 0) {
      return null;
    }
    const sorted = [...candidates].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const meta = sorted[0]!;
    return { meta, draftCount: counts[meta.id]?.draft ?? 0 };
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
    const q = search.trim().toLowerCase();
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
      const c = counts[s.id] ?? { draft: 0, approved: 0 };
      if (filter === "all") {
        return true;
      }
      if (filter === "ready") {
        return c.approved > 0 && c.draft === 0;
      }
      if (filter === "draft") {
        return c.approved === 0 && c.draft > 0;
      }
      /* in_review */
      return c.approved > 0 && c.draft > 0;
    });
  }, [searchFiltered, filter, counts]);

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
    setsWithDrafts,
    setsWithApproved,
    featuredDraft,
    resumeLatest,
    streakRingPercent,
    filteredSortedSets,
  };
}
