"use client";

import { useEffect } from "react";
import { useLibrarySearch } from "@/components/layout/LibrarySearchContext";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardHomeSkeleton } from "@/components/dashboard/DashboardHomeSkeleton";
import { GlobalNavigationLoadingScreen } from "@/components/layout/GlobalNavigationLoadingScreen";
import { DashboardLibraryClient } from "@/components/dashboard/DashboardLibraryClient";
import { DashboardMobileBottomNav } from "@/components/dashboard/DashboardMobileBottomNav";
import { openEditorHref, playHref } from "@/lib/dashboard/studySetDashboardLinks";
import { createStudySet } from "@/lib/routes/studySetPaths";
import { useDashboardHome } from "@/hooks/useDashboardHome";

export function DashboardHomeClient() {
  const { search } = useLibrarySearch();
  const {
    loading,
    loadError,
    sets,
    counts,
    mistakes,
    filter,
    setFilter,
    sort,
    setSort,
    refresh,
    setsNeedingEditsCount,
    setsWithApproved,
    featuredNeedsEdit,
    resumeLatest,
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
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  const resumeHref = resumeLatest ? playHref(resumeLatest) : null;
  const featuredEditHref =
    featuredNeedsEdit ? openEditorHref(featuredNeedsEdit.meta) : null;

  if (loading) {
    return (
      <GlobalNavigationLoadingScreen message="LOADING YOUR STUDY DASHBOARD..." />
    );
  }

  return (
    <>
      <div className="relative z-[1] mx-auto w-full max-w-7xl min-w-0 space-y-8 py-6 sm:py-8">
          <DashboardHero
            totalSets={sets.length}
            setsNeedingEdits={setsNeedingEditsCount}
            setsWithApproved={setsWithApproved}
            resumePlayHref={resumeHref}
            editSetHref={featuredEditHref}
            createHref={createStudySet()}
          />

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
      </div>

      <DashboardMobileBottomNav />
      {/* reserve space for fixed mobile nav */}
      <div className="h-16 md:hidden" aria-hidden />
    </>
  );
}
