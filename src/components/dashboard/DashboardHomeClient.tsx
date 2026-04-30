"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import { DashboardBlueprintDecor } from "@/components/dashboard/DashboardBlueprintDecor";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardLibraryClient } from "@/components/dashboard/DashboardLibraryClient";
import { DashboardMobileBottomNav } from "@/components/dashboard/DashboardMobileBottomNav";
import { DashboardStatsRow } from "@/components/dashboard/DashboardStatsRow";
import { openEditorHref, playHref } from "@/lib/dashboard/studySetDashboardLinks";
import { newRoot } from "@/lib/routes/studySetPaths";
import { useDashboardHome } from "@/hooks/useDashboardHome";

export function DashboardHomeClient() {
  const { search } = useLibrarySearch();
  const reduceMotion = useReducedMotion();
  const {
    loading,
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
  } = useDashboardHome();

  useEffect(() => {
    const scrollToHash = () => {
      if (typeof window === "undefined") {
        return;
      }
      if (window.location.hash === "#library") {
        queueMicrotask(() =>
          document.getElementById("library")?.scrollIntoView({ behavior: "smooth" }),
        );
      }
      if (window.location.hash === "#stats") {
        queueMicrotask(() =>
          document
            .getElementById("dashboard-stats")
            ?.scrollIntoView({ behavior: "smooth" }),
        );
      }
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  const resumeHref = resumeLatest ? playHref(resumeLatest) : null;
  const featuredEditHref =
    featuredNeedsEdit ? openEditorHref(featuredNeedsEdit.meta) : null;

  return (
    <>
      <motion.div
        className="relative z-[1] mx-auto max-w-7xl space-y-8 py-6 sm:py-8"
        initial={reduceMotion ? false : "hidden"}
        animate={reduceMotion ? undefined : "show"}
        variants={{
          hidden: {},
          show: {
            transition: {
              staggerChildren: 0.22,
              delayChildren: 0.06,
            },
          },
        }}
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: -20 },
            show: {
              opacity: 1,
              y: 0,
              transition: {
                duration: 0.75,
                ease: [0.22, 1, 0.36, 1],
              },
            },
          }}
        >
          <DashboardHero
            totalSets={sets.length}
            setsNeedingEdits={setsNeedingEditsCount}
            setsWithApproved={setsWithApproved}
            resumePlayHref={resumeHref}
            editSetHref={featuredEditHref}
            createHref={newRoot()}
          />
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          <DashboardStatsRow
            totalSets={sets.length}
            streakDays={activity?.currentStreakDays ?? 0}
            streakRingPercent={streakRingPercent}
            weeklyItems={activity?.questionsAnsweredThisWeek ?? 0}
          />
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          <DashboardLibraryClient
            loading={loading}
            loadError={loadError}
            setsLength={sets.length}
            search={search}
            totalSets={sets.length}
            filter={filter}
            onFilterChange={setFilter}
            sort={sort}
            onSortChange={setSort}
            filteredSortedSets={filteredSortedSets}
            counts={counts}
            mistakes={mistakes}
            onRefresh={refresh}
          />
        </motion.div>
      </motion.div>

      <DashboardBlueprintDecor />
      <DashboardMobileBottomNav />
      {/* reserve space for fixed mobile nav */}
      <div className="h-16 md:hidden" aria-hidden />
    </>
  );
}
