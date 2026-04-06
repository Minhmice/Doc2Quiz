"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACTIVITY_STATS_CHANGED_EVENT,
  STUDY_SETS_LIST_CHANGED_EVENT,
} from "@/lib/appEvents";
import {
  ensureStudySetDb,
  getApprovedBank,
  listStudySetMetas,
} from "@/lib/db/studySetDb";
import { getActivityStats } from "@/lib/studySet/activityTracking";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DashboardStatsWidget() {
  const [totalSets, setTotalSets] = useState(0);
  const [streak, setStreak] = useState(0);
  const [daily, setDaily] = useState<{ date: string; count: number }[]>([]);

  const load = useCallback(async () => {
    try {
      await ensureStudySetDb();
      const [metas, activity] = await Promise.all([
        listStudySetMetas(),
        getActivityStats(),
      ]);
      let withApproved = 0;
      await Promise.all(
        metas.map(async (m) => {
          const bank = await getApprovedBank(m.id);
          if ((bank?.questions.length ?? 0) > 0) {
            withApproved++;
          }
        }),
      );
      setTotalSets(withApproved);
      setStreak(activity.currentStreakDays);
      setDaily(activity.dailyAnsweredLast7Days);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const onActivity = () => void load();
    const onList = () => void load();
    window.addEventListener(ACTIVITY_STATS_CHANGED_EVENT, onActivity);
    window.addEventListener(STUDY_SETS_LIST_CHANGED_EVENT, onList);
    return () => {
      window.removeEventListener(ACTIVITY_STATS_CHANGED_EVENT, onActivity);
      window.removeEventListener(STUDY_SETS_LIST_CHANGED_EVENT, onList);
    };
  }, [load]);

  const maxDay = Math.max(1, ...daily.map((d) => d.count));

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardDescription>Study sets</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totalSets}</CardTitle>
            <p className="text-xs text-muted-foreground">with approved questions</p>
          </CardHeader>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardDescription>Current streak</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{streak}</CardTitle>
            <p className="text-xs text-muted-foreground">days with a completed quiz</p>
          </CardHeader>
        </Card>
        <Card className="shadow-md sm:col-span-2 lg:col-span-2 lg:col-start-3">
          <CardHeader className="pb-2">
            <CardDescription>Last 7 days</CardDescription>
            <CardTitle className="text-base">Questions answered</CardTitle>
          </CardHeader>
          <div className="flex h-32 items-end gap-1.5 px-6 pb-6 pt-0 sm:h-36 sm:gap-2">
            {daily.map((d) => {
              const h = Math.round((d.count / maxDay) * 100);
              const label = d.date.slice(5);
              return (
                <div
                  key={d.date}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                >
                  <div
                    className="flex w-full min-h-[4px] flex-1 items-end justify-center"
                    title={`${d.count} on ${d.date}`}
                  >
                    <div
                      className="w-[min(100%,2.5rem)] rounded-t-md bg-primary/80"
                      style={{ height: `${Math.max(8, h)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground sm:text-xs">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
