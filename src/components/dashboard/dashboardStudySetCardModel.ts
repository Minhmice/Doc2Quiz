import { drillMistakesHref, editHref, openOverviewHref, playHref, resultsHref, reviewHref } from "@/lib/dashboard/studySetDashboardLinks";
import type { StudySetMeta } from "@/types/studySet";

export type DashboardPreviewItem = Readonly<{ id: string; text: string; kind: string; number: number }>;
export type DashboardStudySetCardModel = Readonly<{
  overviewHref: string;
  primaryHref: string;
  primaryLabel: "View progress" | "Review content" | "Start studying" | "Drill mistakes";
  actions: { edit: string; review: string; results: string; duplicate: string; drillMistakes: string };
  totalCount: number;
  previews: DashboardPreviewItem[];
  previewTotal: number;
}>;

export function buildDashboardStudySetCardModel(input: {
  meta: StudySetMeta;
  items: ReadonlyArray<{ id: string; text: string; kind: string; flagged?: boolean; reviewed?: boolean }>;
  status: "generating" | "needs_review" | "ready" | "failed";
  hasMistakes: boolean;
}): DashboardStudySetCardModel {
  const prioritized = input.status === "needs_review"
    ? [...input.items].sort((a, b) => Number(Boolean(b.flagged)) - Number(Boolean(a.flagged)))
    : [...input.items];
  const previews = prioritized.slice(0, 3).map((item, index) => ({ id: item.id, text: item.text, kind: item.kind, number: index + 1 }));
  const primaryLabel = input.status === "generating" ? "View progress" : input.hasMistakes ? "Drill mistakes" : input.status === "needs_review" ? "Review content" : "Start studying";
  return {
    overviewHref: openOverviewHref(input.meta),
    primaryHref: primaryLabel === "View progress" ? reviewHref(input.meta) : primaryLabel === "Review content" ? reviewHref(input.meta) : primaryLabel === "Drill mistakes" ? drillMistakesHref(input.meta) : playHref(input.meta),
    primaryLabel,
    actions: { edit: editHref(input.meta), review: reviewHref(input.meta), results: resultsHref(input.meta), duplicate: openOverviewHref(input.meta), drillMistakes: drillMistakesHref(input.meta) },
    totalCount: input.items.length,
    previews,
    previewTotal: input.items.length,
  };
}
