/**
 * Canonical verbs for the Create → Review → Practice mental model.
 * URLs stay split by contentKind; labels stay consistent on dashboard / palette.
 */

import type { StudyContentKind } from "@/types/studySet";

/** Primary button on library cards when the set needs content approval first. */
export const DASHBOARD_OPEN_EDITOR_LABEL = "Open editor";

/** Primary button when the learner can enter practice session. */
export const DASHBOARD_PRACTICE_LABEL = "Practice";

/** When practice was started but set is not finalized yet. */
export const DASHBOARD_RESUME_PRACTICE_LABEL = "Resume practice";

/** Hero / library create CTAs */
export const DASHBOARD_CREATE_FIRST_SET_LABEL = "Create your first set";
export const DASHBOARD_CREATE_NEW_SET_LABEL = "Create new set";

/** Hero shortcuts when library is non-empty */
export const DASHBOARD_HERO_PRACTICE_LABEL = "Practice";
export const DASHBOARD_HERO_REVIEW_LATEST_LABEL = "Review latest";

/** Command palette + overflow menus */
export const COMMAND_REVIEW_LABEL = "Review";
export const COMMAND_PRACTICE_LABEL = "Practice";

export type DashboardCardPracticeVariant =
  | "needs_edit"
  | "ready"
  | "in_progress";

export function dashboardCardPrimaryCtaLabel(
  variant: DashboardCardPracticeVariant,
  contentKind?: StudyContentKind,
): string {
  if (variant === "needs_edit") {
    return DASHBOARD_OPEN_EDITOR_LABEL;
  }
  if (variant === "in_progress") {
    return DASHBOARD_RESUME_PRACTICE_LABEL;
  }
  if (contentKind === "flashcards") {
    return "Open flip study";
  }
  return "Open practice";
}
