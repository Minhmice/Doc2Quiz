"use client";

import { useEffect } from "react";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import { DashboardBlueprintDecor } from "@/components/dashboard/DashboardBlueprintDecor";
import { DashboardDraftBanner } from "@/components/dashboard/DashboardDraftBanner";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardLibraryClient } from "@/components/dashboard/DashboardLibraryClient";
import { DashboardMobileBottomNav } from "@/components/dashboard/DashboardMobileBottomNav";
import { DashboardStatsRow } from "@/components/dashboard/DashboardStatsRow";
import { reviewDraftHref, playHref } from "@/lib/dashboard/studySetDashboardLinks";
import { newRoot } from "@/lib/routes/studySetPaths";
import { useDashboardHome } from "@/hooks/useDashboardHome";

export function DashboardHomeClient() {
  const { search } = useLibrarySearch();
  const {
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
  const featuredReviewHref =
    featuredDraft ? reviewDraftHref(featuredDraft.meta) : null;

  return (
    <>
      <div className="relative z-[1] mx-auto max-w-7xl space-y-8 py-6 sm:py-8">
        <DashboardHero
          totalSets={sets.length}
          setsWithDrafts={setsWithDrafts}
          setsWithApproved={setsWithApproved}
          resumePlayHref={resumeHref}
          reviewDraftHref={featuredReviewHref}
          createHref={newRoot()}
        />

        <DashboardStatsRow
          totalSets={sets.length}
          streakDays={activity?.currentStreakDays ?? 0}
          streakRingPercent={streakRingPercent}
          weeklyQuestions={activity?.questionsAnsweredThisWeek ?? 0}
        />

        {featuredDraft ? (
          <DashboardDraftBanner
            title={featuredDraft.meta.title}
            draftCount={featuredDraft.draftCount}
            reviewHref={reviewDraftHref(featuredDraft.meta)}
          />
        ) : null}

        <DashboardLibraryClient
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
      </div>

      <DashboardBlueprintDecor />
      <DashboardMobileBottomNav />
      {/* reserve space for fixed mobile nav */}
      <div className="h-16 md:hidden" aria-hidden />
    </>
  );
}
